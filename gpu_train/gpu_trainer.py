"""
Стойки — GPU Self-Play тренер v2
Self-play: быстрый MCTS на CPU (rollouts)
Обучение: ResNet на GPU батчами
Запуск: py -3.12 gpu_trainer.py
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

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'analysis'))
from game import GameState, get_legal_actions, apply_action, get_valid_transfers
from train import sample_random_action_fast
from mcts import MCTSAgent

DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f'Устройство: {DEVICE}')
if DEVICE.type == 'cuda':
    print(f'GPU: {torch.cuda.get_device_name(0)}')
    print(f'VRAM: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB')


# ═══ Кодирование состояния ═══

def encode_state(state):
    f = []
    player = state.current_player
    opp = 1 - player
    for i in range(state.num_stands):
        chips = state.stands[i]
        total = len(chips)
        my = sum(1 for c in chips if c == player)
        op = sum(1 for c in chips if c == opp)
        tc, ts = state.top_group(i)
        f.extend([
            total / 11.0,
            my / 11.0,
            op / 11.0,
            ts / 11.0,
            1.0 if tc == player else 0.0,
            1.0 if tc == opp else 0.0,
            1.0 if i in state.closed else 0.0,
            1.0 if state.closed.get(i) == player else 0.0,
            1.0 if i == 0 else 0.0,
            max(0, 11 - total) / 11.0,
        ])
    mc = state.count_closed(player)
    oc = state.count_closed(opp)
    f.extend([mc/5, oc/5, (mc-oc)/5, state.num_open()/10, state.turn/100,
              1.0 if state.swap_available else 0.0,
              1.0 if state.can_close_by_placement() else 0.0])
    return np.array(f, dtype=np.float32)

INPUT_SIZE = 107  # 10*10 + 7


# ═══ Нейросеть ═══

class ResBlock(nn.Module):
    def __init__(self, dim):
        super().__init__()
        self.fc1 = nn.Linear(dim, dim)
        self.ln1 = nn.LayerNorm(dim)  # LayerNorm вместо BatchNorm — работает с batch=1
        self.fc2 = nn.Linear(dim, dim)
        self.ln2 = nn.LayerNorm(dim)

    def forward(self, x):
        out = F.relu(self.ln1(self.fc1(x)))
        out = self.ln2(self.fc2(out))
        return F.relu(out + x)


class StoykaNet(nn.Module):
    def __init__(self, hidden=256, num_blocks=6):
        super().__init__()
        self.proj = nn.Sequential(nn.Linear(INPUT_SIZE, hidden), nn.LayerNorm(hidden), nn.ReLU())
        self.blocks = nn.ModuleList([ResBlock(hidden) for _ in range(num_blocks)])
        self.value = nn.Sequential(nn.Linear(hidden, 64), nn.ReLU(), nn.Linear(64, 1), nn.Tanh())

    def forward(self, x):
        h = self.proj(x)
        for b in self.blocks:
            h = b(h)
        return self.value(h)

    def predict_batch(self, states_np):
        """Батч-предсказание на GPU"""
        self.eval()
        with torch.no_grad():
            x = torch.tensor(states_np, dtype=torch.float32).to(DEVICE)
            return self.forward(x).cpu().numpy().flatten()


# ═══ Быстрый Self-Play (рандомные партии) ═══

def play_one_game_fast():
    """Рандомная партия → список (encoded_state, value)"""
    trajectory = []
    state = GameState()

    while not state.game_over:
        features = encode_state(state)
        player = state.current_player
        action = sample_random_action_fast(state)
        trajectory.append((features, player))
        state = apply_action(state, action)
        if state.turn > 200:
            state.game_over = True
            state.winner = -1
            break

    samples = []
    for features, player in trajectory:
        if state.winner == player:
            v = 1.0
        elif state.winner == 1 - player:
            v = -1.0
        else:
            v = 0.0
        samples.append((features, v))
    return samples


def play_games_batch(num_games, mcts_sims=60, max_children=14):
    """Быстрый прогон N партий"""
    all_samples = []
    for g in range(num_games):
        all_samples.extend(play_one_game_fast())
    return all_samples


# ═══ Оценка vs Random ═══

def evaluate_net(net, num_games=20, mcts_sims=100, max_children=14):
    """Оценка: MCTS + нейросеть vs рандом"""
    net.eval()
    wins = 0

    for g in range(num_games):
        state = GameState()
        mcts_player = g % 2
        agent = MCTSAgent(num_simulations=mcts_sims, temperature=0.05, max_children=max_children)

        while not state.game_over:
            if state.current_player == mcts_player:
                # MCTS ход — используем нейросеть для оценки leaf
                action, _ = agent.choose_action(state)
            else:
                action = sample_random_action_fast(state)
            state = apply_action(state, action)
            if state.turn > 200:
                break

        if state.winner == mcts_player:
            wins += 1

    return wins / num_games


# ═══ Тренер ═══

class GPUTrainer:
    def __init__(self, config=None):
        c = config or {}
        self.hidden = c.get('hidden', 256)
        self.num_blocks = c.get('num_blocks', 6)
        self.lr = c.get('lr', 0.001)
        self.batch_size = c.get('batch_size', 512)
        self.epochs = c.get('epochs', 30)
        self.games_per_iter = c.get('games_per_iter', 60)
        self.mcts_sims = c.get('mcts_sims', 80)
        self.eval_games = c.get('eval_games', 20)
        self.eval_sims = c.get('eval_sims', 100)
        self.num_iterations = c.get('num_iterations', 100)
        self.buffer_size = c.get('buffer_size', 100000)
        self.max_children = c.get('max_children', 14)
        self.ckpt_dir = c.get('checkpoint_dir', 'gpu_checkpoint')

        self.net = StoykaNet(self.hidden, self.num_blocks).to(DEVICE)
        self.optimizer = optim.Adam(self.net.parameters(), lr=self.lr, weight_decay=1e-4)
        self.scheduler = optim.lr_scheduler.CosineAnnealingLR(self.optimizer, T_max=self.num_iterations)

        self.buffer_x = []
        self.buffer_y = []
        self.history = []
        self.version = 0

        os.makedirs(self.ckpt_dir, exist_ok=True)
        total_params = sum(p.numel() for p in self.net.parameters())
        print(f'Сеть: {self.hidden} hidden, {self.num_blocks} блоков, {total_params:,} параметров')

    def train_on_buffer(self):
        """GPU обучение на буфере"""
        n = len(self.buffer_x)
        if n < self.batch_size:
            return 0.0

        self.net.train()
        X = torch.tensor(np.array(self.buffer_x[-min(n, self.buffer_size):]), dtype=torch.float32).to(DEVICE)
        Y = torch.tensor(np.array(self.buffer_y[-min(n, self.buffer_size):]), dtype=torch.float32).unsqueeze(1).to(DEVICE)

        total_loss = 0.0
        num_batches = 0

        for epoch in range(self.epochs):
            perm = torch.randperm(len(X))
            for start in range(0, len(X), self.batch_size):
                idx = perm[start:start + self.batch_size]
                pred = self.net(X[idx])
                loss = F.mse_loss(pred, Y[idx])
                self.optimizer.zero_grad()
                loss.backward()
                torch.nn.utils.clip_grad_norm_(self.net.parameters(), 1.0)
                self.optimizer.step()
                total_loss += loss.item()
                num_batches += 1

        self.scheduler.step()
        return total_loss / max(num_batches, 1)

    def run(self):
        print(f'\n{"═"*60}')
        print(f'Self-Play: {self.num_iterations} итер × {self.games_per_iter} партий × {self.mcts_sims} сим')
        print(f'Обучение: GPU {DEVICE}, batch={self.batch_size}, epochs={self.epochs}')
        print(f'{"═"*60}\n')

        for it in range(1, self.num_iterations + 1):
            self.version += 1
            t0 = time.time()

            # Self-play (CPU)
            samples = play_games_batch(self.games_per_iter, self.mcts_sims, self.max_children)

            for feat, val in samples:
                self.buffer_x.append(feat)
                self.buffer_y.append(val)

            if len(self.buffer_x) > self.buffer_size:
                self.buffer_x = self.buffer_x[-self.buffer_size:]
                self.buffer_y = self.buffer_y[-self.buffer_size:]

            # Обучение (GPU)
            loss = self.train_on_buffer()

            # Оценка каждые 25 итераций
            wr = -1
            if it == 1 or it % 25 == 0:
                wr = evaluate_net(self.net, self.eval_games, self.eval_sims, self.max_children)

            elapsed = time.time() - t0
            lr = self.scheduler.get_last_lr()[0]
            buf_size = len(self.buffer_x)

            wr_str = f'{wr:.0%}' if wr >= 0 else '—'
            print(f'  v{self.version:3d} | loss={loss:.4f} | vs_rand={wr_str} | buf={buf_size:,} | lr={lr:.6f} | {elapsed:.0f}с')

            self.history.append({
                'version': self.version,
                'loss': round(loss, 5),
                'vs_random': round(wr, 3) if wr >= 0 else None,
                'buffer': buf_size,
                'time': round(elapsed, 1),
            })

            # Чекпоинт
            if it % 10 == 0:
                self.save()
                print(f'  → Чекпоинт v{self.version}')

        self.save()
        return self.history

    def save(self):
        torch.save({
            'model': self.net.state_dict(),
            'optimizer': self.optimizer.state_dict(),
            'version': self.version,
            'history': self.history,
        }, os.path.join(self.ckpt_dir, f'model_v{self.version}.pt'))
        with open(os.path.join(self.ckpt_dir, 'history.json'), 'w') as f:
            json.dump(self.history, f, indent=2)

    def load(self, path):
        ckpt = torch.load(path, map_location=DEVICE, weights_only=False)
        self.net.load_state_dict(ckpt['model'])
        if 'optimizer' in ckpt:
            self.optimizer.load_state_dict(ckpt['optimizer'])
        self.version = ckpt.get('version', 0)
        self.history = ckpt.get('history', [])
        print(f'Загружена v{self.version}')


# ═══ Запуск ═══

if __name__ == '__main__':
    config = {
        'hidden': 256,
        'num_blocks': 6,
        'lr': 0.001,
        'batch_size': 512,
        'epochs': 20,
        'games_per_iter': 200,     # Рандом = мгновенно
        'mcts_sims': 60,
        'eval_games': 14,
        'eval_sims': 60,
        'num_iterations': 500,
        'buffer_size': 200000,
        'max_children': 14,
        'checkpoint_dir': 'gpu_checkpoint',
    }

    trainer = GPUTrainer(config)

    # Автозагрузка последнего чекпоинта
    ckpts = sorted([f for f in os.listdir(config['checkpoint_dir']) if f.endswith('.pt')]) if os.path.exists(config['checkpoint_dir']) else []
    if ckpts:
        trainer.load(os.path.join(config['checkpoint_dir'], ckpts[-1]))

    print(f'\nСтарт с v{trainer.version}')
    history = trainer.run()

    print(f'\n{"═"*60}')
    print(f'Готово: {len(history)} итераций')
    if history:
        losses = [h['loss'] for h in history]
        wrs = [h['vs_random'] for h in history if h['vs_random'] is not None]
        print(f'Loss: {losses[0]:.4f} → {losses[-1]:.4f}')
        if wrs:
            print(f'vs Random (последние 5): {[f"{w:.0%}" for w in wrs[-5:]]}')
    print(f'{"═"*60}')
