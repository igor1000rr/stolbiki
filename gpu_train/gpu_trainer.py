"""
Стойки — GPU Self-Play тренер (PyTorch)
Запуск: python gpu_trainer.py
Требования: pip install torch numpy
GPU: NVIDIA GTX 1080+ (CUDA)
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
import numpy as np
import json
import time
import os
import sys

# Добавляем путь к движку
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'analysis'))
from game import GameState, get_legal_actions, apply_action, get_valid_transfers, get_valid_placements
from mcts import MCTSAgent
from train import mcts_vs_random

DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f'Устройство: {DEVICE}')
if DEVICE.type == 'cuda':
    print(f'GPU: {torch.cuda.get_device_name(0)}')
    print(f'VRAM: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB')


# ═══════════════════════════════════════════
# Нейросеть — ResNet-подобная
# ═══════════════════════════════════════════

def encode_state(state):
    """Кодирует состояние в вектор признаков"""
    f = []
    player = state.current_player
    opponent = 1 - player

    for i in range(state.num_stands):
        chips = state.stands[i]
        total = len(chips)
        my = sum(1 for c in chips if c == player)
        opp = sum(1 for c in chips if c == opponent)
        top_color, top_size = state.top_group(i)
        is_mine_top = 1.0 if top_color == player else 0.0
        is_opp_top = 1.0 if top_color == opponent else 0.0
        is_closed = 1.0 if i in state.closed else 0.0
        closed_by_me = 1.0 if state.closed.get(i) == player else 0.0
        is_golden = 1.0 if i == 0 else 0.0
        space = max(0, 11 - total) / 11.0

        f.extend([
            total / 11.0,
            my / 11.0,
            opp / 11.0,
            top_size / 11.0,
            is_mine_top,
            is_opp_top,
            is_closed,
            closed_by_me,
            is_golden,
            space,
        ])

    my_closed = state.count_closed(player)
    opp_closed = state.count_closed(opponent)
    f.extend([
        my_closed / 5.0,
        opp_closed / 5.0,
        (my_closed - opp_closed) / 5.0,
        state.num_open() / 10.0,
        state.turn / 100.0,
        1.0 if state.swap_available else 0.0,
        1.0 if state.can_close_by_placement() else 0.0,
    ])

    return np.array(f, dtype=np.float32)


INPUT_SIZE = 10 * 10 + 7  # 107


class ResBlock(nn.Module):
    def __init__(self, dim):
        super().__init__()
        self.fc1 = nn.Linear(dim, dim)
        self.bn1 = nn.BatchNorm1d(dim)
        self.fc2 = nn.Linear(dim, dim)
        self.bn2 = nn.BatchNorm1d(dim)

    def forward(self, x):
        residual = x
        out = F.relu(self.bn1(self.fc1(x)))
        out = self.bn2(self.fc2(out))
        return F.relu(out + residual)


class StoykaNet(nn.Module):
    def __init__(self, input_dim=INPUT_SIZE, hidden=256, num_blocks=6):
        super().__init__()
        self.input_proj = nn.Sequential(
            nn.Linear(input_dim, hidden),
            nn.BatchNorm1d(hidden),
            nn.ReLU(),
        )
        self.blocks = nn.ModuleList([ResBlock(hidden) for _ in range(num_blocks)])

        # Value head
        self.value_head = nn.Sequential(
            nn.Linear(hidden, 64),
            nn.ReLU(),
            nn.Linear(64, 1),
            nn.Tanh(),
        )

    def forward(self, x):
        h = self.input_proj(x)
        for block in self.blocks:
            h = block(h)
        return self.value_head(h)

    def predict(self, state):
        """Предсказание для одного состояния"""
        self.eval()
        with torch.no_grad():
            x = torch.tensor(encode_state(state), dtype=torch.float32).unsqueeze(0).to(DEVICE)
            v = self.forward(x).item()
        return v


# ═══════════════════════════════════════════
# Быстрый MCTS с нейросетью
# ═══════════════════════════════════════════

class NeuralMCTS:
    def __init__(self, net, num_simulations=150, temperature=0.1, max_children=16):
        self.net = net
        self.num_simulations = num_simulations
        self.temperature = temperature
        self.max_children = max_children

    def choose_action(self, state):
        if state.game_over:
            return None, 0.0

        actions = self._generate_actions(state)
        if not actions:
            return {}, 0.0

        visits = [0] * len(actions)
        values = [0.0] * len(actions)
        player = state.current_player

        # Симуляции
        for _ in range(self.num_simulations):
            total_visits = sum(visits) + 1
            best_idx = 0
            best_score = -float('inf')

            for i in range(len(actions)):
                if visits[i] == 0:
                    score = 1000 + np.random.random()
                else:
                    score = values[i] / visits[i] + 1.4 * np.sqrt(np.log(total_visits) / visits[i])
                if score > best_score:
                    best_score = score
                    best_idx = i

            # Применяем и оцениваем
            ns = apply_action(state, actions[best_idx])

            if ns.game_over:
                if ns.winner == player:
                    v = 1.0
                elif ns.winner == 1 - player:
                    v = -1.0
                else:
                    v = 0.0
            else:
                # Нейросеть оценивает
                v = -self.net.predict(ns)  # Минус — оценка с точки зрения текущего игрока

            visits[best_idx] += 1
            values[best_idx] += v

        # Выбираем лучший ход
        best_idx = max(range(len(actions)), key=lambda i: visits[i])
        value = values[best_idx] / max(visits[best_idx], 1)

        return actions[best_idx], value

    def _generate_actions(self, state):
        """Генерация умных ходов (как в numpy-версии)"""
        from game import Action, get_valid_transfers, get_valid_placements, MAX_CHIPS, MAX_PLACE, FIRST_TURN_MAX

        actions = []
        player = state.current_player
        max_p = FIRST_TURN_MAX if state.is_first_turn() else MAX_PLACE

        if state.turn == 1 and state.swap_available:
            actions.append(Action(swap=True))

        transfers = get_valid_transfers(state)

        # Закрывающие переносы
        for src, dst in transfers:
            gc, gs = state.top_group(src)
            if state.stands[dst].__len__() + gs >= MAX_CHIPS and gc == player:
                for pl in self._sample_placements(state, [src, dst], max_p, 2):
                    actions.append(Action(transfer=(src, dst), placement=pl))

        # Стратегические переносы
        strat = [(s, d) for s, d in transfers
                 if state.stands[d].__len__() + state.top_group(s)[1] < MAX_CHIPS]
        for t in strat[:4]:
            for pl in self._sample_placements(state, [t[0], t[1]], max_p, 1):
                actions.append(Action(transfer=t, placement=pl))

        # Только установка
        for pl in self._sample_placements(state, [], max_p, 4):
            actions.append(Action(placement=pl))

        # Рандом для разнообразия
        from train import sample_random_action_fast
        while len(actions) < self.max_children:
            actions.append(sample_random_action_fast(state))

        return actions[:self.max_children]

    def _sample_placements(self, state, exclude, max_p, count):
        avail = [i for i in state.open_stands() if i not in exclude and state.stand_space(i) > 1]
        if not avail:
            return [{}]
        results = []
        for _ in range(count):
            pl = {}
            rem = max_p
            np.random.shuffle(avail)
            for idx in avail[:2]:
                if rem <= 0:
                    break
                cap = min(state.stand_space(idx) - 1, rem)
                if cap > 0:
                    c = np.random.randint(1, cap + 1)
                    pl[idx] = c
                    rem -= c
            results.append(pl)
        return results


# ═══════════════════════════════════════════
# Self-Play тренер
# ═══════════════════════════════════════════

class GPUTrainer:
    def __init__(self, config=None):
        self.config = config or {}
        self.hidden = self.config.get('hidden', 256)
        self.num_blocks = self.config.get('num_blocks', 6)
        self.lr = self.config.get('lr', 0.001)
        self.batch_size = self.config.get('batch_size', 256)
        self.epochs = self.config.get('epochs', 30)
        self.games_per_iter = self.config.get('games_per_iter', 50)
        self.mcts_sims = self.config.get('mcts_sims', 150)
        self.eval_games = self.config.get('eval_games', 20)
        self.eval_sims = self.config.get('eval_sims', 150)
        self.num_iterations = self.config.get('num_iterations', 50)
        self.buffer_size = self.config.get('buffer_size', 50000)
        self.max_children = self.config.get('max_children', 16)
        self.checkpoint_dir = self.config.get('checkpoint_dir', 'gpu_checkpoint')

        self.net = StoykaNet(hidden=self.hidden, num_blocks=self.num_blocks).to(DEVICE)
        self.optimizer = optim.Adam(self.net.parameters(), lr=self.lr, weight_decay=1e-4)
        self.scheduler = optim.lr_scheduler.CosineAnnealingLR(self.optimizer, T_max=self.num_iterations)

        self.buffer = []
        self.history = []
        self.version = 0

        os.makedirs(self.checkpoint_dir, exist_ok=True)

        total_params = sum(p.numel() for p in self.net.parameters())
        print(f'Сеть: {self.hidden} hidden, {self.num_blocks} блоков, {total_params:,} параметров')

    def self_play(self):
        """Одна партия self-play → список (state_features, value)"""
        self.net.eval()
        agent = NeuralMCTS(self.net, self.mcts_sims, max_children=self.max_children)
        trajectory = []

        state = GameState()
        while not state.game_over:
            features = encode_state(state)
            action, _ = agent.choose_action(state)
            trajectory.append((features, state.current_player))
            state = apply_action(state, action)
            if state.turn > 200:
                state.game_over = True
                state.winner = -1
                break

        # Назначаем rewards
        samples = []
        for features, player in trajectory:
            if state.winner == player:
                value = 1.0
            elif state.winner == 1 - player:
                value = -1.0
            else:
                value = 0.0
            samples.append((features, value))

        return samples

    def train_step(self):
        """Обучение на буфере"""
        if len(self.buffer) < self.batch_size:
            return 0.0

        self.net.train()
        indices = np.random.choice(len(self.buffer), min(len(self.buffer), self.batch_size * 4), replace=False)
        batch = [self.buffer[i] for i in indices]

        features = torch.tensor(np.array([b[0] for b in batch]), dtype=torch.float32).to(DEVICE)
        targets = torch.tensor(np.array([b[1] for b in batch]), dtype=torch.float32).unsqueeze(1).to(DEVICE)

        total_loss = 0
        for epoch in range(self.epochs):
            perm = torch.randperm(len(features))
            for start in range(0, len(features), self.batch_size):
                end = min(start + self.batch_size, len(features))
                idx = perm[start:end]

                pred = self.net(features[idx])
                loss = F.mse_loss(pred, targets[idx])

                self.optimizer.zero_grad()
                loss.backward()
                torch.nn.utils.clip_grad_norm_(self.net.parameters(), 1.0)
                self.optimizer.step()

                total_loss += loss.item()

        self.scheduler.step()
        avg_loss = total_loss / (self.epochs * max(1, len(features) // self.batch_size))
        return avg_loss

    def evaluate(self):
        """Оценка vs рандом"""
        self.net.eval()
        agent = NeuralMCTS(self.net, self.eval_sims, max_children=self.max_children)
        wins = 0
        total = self.eval_games

        for g in range(total):
            state = GameState()
            mcts_player = g % 2  # Чередуем стороны
            while not state.game_over:
                if state.current_player == mcts_player:
                    action, _ = agent.choose_action(state)
                else:
                    from train import sample_random_action_fast
                    action = sample_random_action_fast(state)
                state = apply_action(state, action)
                if state.turn > 200:
                    break
            if state.winner == mcts_player:
                wins += 1

        return wins / total

    def run(self):
        """Основной цикл обучения"""
        print(f'\n{"═"*60}')
        print(f'Self-Play: {self.num_iterations} итер, {self.games_per_iter} партий, {self.mcts_sims} сим')
        print(f'{"═"*60}\n')

        for iteration in range(1, self.num_iterations + 1):
            self.version += 1
            t0 = time.time()

            # Self-play
            new_samples = []
            for g in range(self.games_per_iter):
                samples = self.self_play()
                new_samples.extend(samples)
                if (g + 1) % 10 == 0:
                    print(f'  Партия {g+1}/{self.games_per_iter}...', end='\r')

            self.buffer.extend(new_samples)
            if len(self.buffer) > self.buffer_size:
                self.buffer = self.buffer[-self.buffer_size:]

            # Обучение
            loss = self.train_step()

            # Оценка
            wr = self.evaluate()

            elapsed = time.time() - t0
            lr = self.scheduler.get_last_lr()[0]

            print(f'v{self.version:3d} | loss={loss:.4f} | vs_rand={wr:.0%} | '
                  f'buf={len(self.buffer):,} | lr={lr:.6f} | {elapsed:.0f}с')

            self.history.append({
                'version': self.version,
                'loss': round(loss, 5),
                'vs_random': round(wr, 3),
                'buffer': len(self.buffer),
                'time': round(elapsed, 1),
            })

            # Чекпоинт каждые 10 итераций
            if iteration % 10 == 0:
                self.save()
                print(f'  → Чекпоинт сохранён (v{self.version})')

        # Финальный чекпоинт
        self.save()
        return self.history

    def save(self):
        path = os.path.join(self.checkpoint_dir, f'model_v{self.version}.pt')
        torch.save({
            'model': self.net.state_dict(),
            'optimizer': self.optimizer.state_dict(),
            'version': self.version,
            'history': self.history,
        }, path)

        # Также сохраняем историю отдельно
        with open(os.path.join(self.checkpoint_dir, 'history.json'), 'w') as f:
            json.dump(self.history, f, indent=2)

    def load(self, path):
        checkpoint = torch.load(path, map_location=DEVICE)
        self.net.load_state_dict(checkpoint['model'])
        if 'optimizer' in checkpoint:
            self.optimizer.load_state_dict(checkpoint['optimizer'])
        if 'version' in checkpoint:
            self.version = checkpoint['version']
        if 'history' in checkpoint:
            self.history = checkpoint['history']
        print(f'Загружена модель v{self.version}')


# ═══════════════════════════════════════════
# Точка входа
# ═══════════════════════════════════════════

if __name__ == '__main__':
    config = {
        'hidden': 256,           # 64 → 256 (4x больше)
        'num_blocks': 6,         # 3 → 6 residual блоков
        'lr': 0.001,
        'batch_size': 256,
        'epochs': 25,
        'games_per_iter': 50,    # 30 → 50 партий
        'mcts_sims': 150,        # 100 → 150 симуляций
        'eval_games': 20,        # 14 → 20 оценочных
        'eval_sims': 150,
        'num_iterations': 100,   # Первый прогон
        'buffer_size': 50000,    # 25K → 50K
        'max_children': 16,
        'checkpoint_dir': 'gpu_checkpoint',
    }

    trainer = GPUTrainer(config)

    # Если есть предыдущий чекпоинт — загружаем
    ckpt_dir = config['checkpoint_dir']
    if os.path.exists(ckpt_dir):
        ckpts = sorted([f for f in os.listdir(ckpt_dir) if f.endswith('.pt')])
        if ckpts:
            latest = os.path.join(ckpt_dir, ckpts[-1])
            trainer.load(latest)

    print(f'\nСтарт обучения с v{trainer.version}')
    print(f'Конфиг: {json.dumps(config, indent=2)}')

    history = trainer.run()

    print(f'\n{"═"*60}')
    print(f'Обучение завершено: {len(history)} итераций')
    if history:
        print(f'Loss: {history[0]["loss"]:.4f} → {history[-1]["loss"]:.4f}')
        last5 = [h['vs_random'] for h in history[-5:]]
        print(f'Последние 5 vs_random: {[f"{x:.0%}" for x in last5]}')
    print(f'{"═"*60}')
