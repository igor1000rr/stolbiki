"""
Стойки — GPU Self-Play v5
Нейросеть участвует в КАЖДОМ ходе через batch-prediction на GPU.
Ход = генерируем N рандомных кандидатов → батч-оценка на GPU → лучший.
Это аналог AlphaZero без дерева: neural policy через sampling.

py -3.12 gpu_trainer.py
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
from game import GameState, apply_action
from train import sample_random_action_fast

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
            total / 11.0, my / 11.0, op / 11.0, ts / 11.0,
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

INPUT_SIZE = 107


# ═══ Нейросеть ═══

class ResBlock(nn.Module):
    def __init__(self, dim):
        super().__init__()
        self.fc1 = nn.Linear(dim, dim)
        self.ln1 = nn.LayerNorm(dim)
        self.fc2 = nn.Linear(dim, dim)
        self.ln2 = nn.LayerNorm(dim)

    def forward(self, x):
        return F.relu(self.ln2(self.fc2(F.relu(self.ln1(self.fc1(x))))) + x)


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


# ═══ Нейро-ход: GPU batch-prediction ═══

def neural_choose_action(state, net, num_candidates=12, temperature=0.1):
    """Генерируем N рандомных ходов → batch-оценка на GPU → лучший"""
    candidates = []
    features = []

    for _ in range(num_candidates):
        a = sample_random_action_fast(state)
        ns = apply_action(state, a)
        candidates.append(a)
        features.append(encode_state(ns))

    # Batch prediction на GPU
    with torch.no_grad():
        x = torch.tensor(np.array(features), dtype=torch.float32).to(DEVICE)
        vals = net(x).cpu().numpy().flatten()

    # Минус — оценка с точки зрения СЛЕДУЮЩЕГО игрока
    scores = -vals

    if temperature <= 0:
        best = np.argmax(scores)
    else:
        # Softmax selection для exploration
        exp = np.exp((scores - scores.max()) / temperature)
        probs = exp / exp.sum()
        best = np.random.choice(len(candidates), p=probs)

    return candidates[best]


# ═══ Self-Play: нейросеть играет обе стороны ═══

def play_one_game_neural(net, num_candidates=6, explore_turns=20, temperature=0.3):
    """Партия где нейросеть выбирает ходы"""
    trajectory = []
    state = GameState()

    while not state.game_over:
        features = encode_state(state)
        player = state.current_player
        temp = temperature if state.turn < explore_turns else 0.05
        action = neural_choose_action(state, net, num_candidates, temp)
        trajectory.append((features, player))
        state = apply_action(state, action)
        if state.turn > 100:
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


def play_batch_neural(net, num_games, num_candidates=6):
    net.eval()
    all_samples = []
    for g in range(num_games):
        all_samples.extend(play_one_game_neural(net, num_candidates))
        if (g + 1) % 5 == 0:
            print(f'    {g+1}/{num_games}', end='\r')
    return all_samples


# Рандомные партии для начального заполнения буфера
def play_batch_random(num_games):
    all_samples = []
    for _ in range(num_games):
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
        for features, player in trajectory:
            v = 1.0 if state.winner == player else (-1.0 if state.winner == 1 - player else 0.0)
            all_samples.append((features, v))
    return all_samples


# ═══ Оценка ═══

def evaluate_net(net, num_games=100):
    """Нейросеть (12 кандидатов) vs рандом"""
    net.eval()
    wins = 0
    for g in range(num_games):
        state = GameState()
        net_player = g % 2
        while not state.game_over:
            if state.current_player == net_player:
                action = neural_choose_action(state, net, num_candidates=12, temperature=0.0)
            else:
                action = sample_random_action_fast(state)
            state = apply_action(state, action)
            if state.turn > 200:
                break
        if state.winner == net_player:
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
        self.epochs = c.get('epochs', 20)
        self.games_per_iter = c.get('games_per_iter', 40)
        self.num_candidates = c.get('num_candidates', 12)
        self.eval_games = c.get('eval_games', 60)
        self.num_iterations = c.get('num_iterations', 500)
        self.buffer_size = c.get('buffer_size', 200000)
        self.warmup_games = c.get('warmup_games', 500)
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
        print(f'Сеть: {self.hidden}×{self.num_blocks} блоков, {total_params:,} параметров')

    def train_on_buffer(self):
        n = len(self.buffer_x)
        if n < self.batch_size:
            return 0.0
        self.net.train()
        size = min(n, self.buffer_size)
        X = torch.tensor(np.array(self.buffer_x[-size:]), dtype=torch.float32).to(DEVICE)
        Y = torch.tensor(np.array(self.buffer_y[-size:]), dtype=torch.float32).unsqueeze(1).to(DEVICE)
        total_loss = 0.0
        num_b = 0
        for _ in range(self.epochs):
            perm = torch.randperm(len(X))
            for start in range(0, len(X), self.batch_size):
                idx = perm[start:start + self.batch_size]
                loss = F.mse_loss(self.net(X[idx]), Y[idx])
                self.optimizer.zero_grad()
                loss.backward()
                torch.nn.utils.clip_grad_norm_(self.net.parameters(), 1.0)
                self.optimizer.step()
                total_loss += loss.item()
                num_b += 1
        self.scheduler.step()
        return total_loss / max(num_b, 1)

    def run(self):
        print(f'\n{"═"*60}')
        print(f'Self-Play: {self.num_iterations} итер × {self.games_per_iter} нейро-партий')
        print(f'Нейро-ход: {self.num_candidates} кандидатов → GPU batch → лучший')
        print(f'GPU: {DEVICE}, batch={self.batch_size}, epochs={self.epochs}')
        print(f'{"═"*60}')

        # Warmup: рандомные партии для начального обучения
        if self.version == 0 and len(self.buffer_x) < 5000:
            print(f'\nWarmup: {self.warmup_games} рандомных партий...')
            t0 = time.time()
            samples = play_batch_random(self.warmup_games)
            for f, v in samples:
                self.buffer_x.append(f)
                self.buffer_y.append(v)
            loss = self.train_on_buffer()
            print(f'  {len(samples)} сэмплов, loss={loss:.4f}, {time.time()-t0:.0f}с')
            wr = evaluate_net(self.net, 60)
            print(f'  vs random: {wr:.0%}')

        print()

        for it in range(1, self.num_iterations + 1):
            self.version += 1
            t0 = time.time()

            # Neural self-play
            samples = play_batch_neural(self.net, self.games_per_iter, self.num_candidates)
            for f, v in samples:
                self.buffer_x.append(f)
                self.buffer_y.append(v)

            if len(self.buffer_x) > self.buffer_size:
                self.buffer_x = self.buffer_x[-self.buffer_size:]
                self.buffer_y = self.buffer_y[-self.buffer_size:]

            # GPU обучение
            loss = self.train_on_buffer()
            elapsed = time.time() - t0
            lr = self.scheduler.get_last_lr()[0]

            # Eval каждые 25 итераций
            wr_str = '—'
            if it == 1 or it % 25 == 0:
                wr = evaluate_net(self.net, self.eval_games)
                wr_str = f'{wr:.0%}'
                self.history.append({
                    'version': self.version, 'loss': round(loss, 5),
                    'vs_random': round(wr, 3), 'buffer': len(self.buffer_x),
                    'time': round(elapsed, 1),
                })
            else:
                self.history.append({
                    'version': self.version, 'loss': round(loss, 5),
                    'vs_random': None, 'buffer': len(self.buffer_x),
                    'time': round(elapsed, 1),
                })

            print(f'  v{self.version:3d} | loss={loss:.4f} | wr={wr_str:>4s} | buf={len(self.buffer_x):,} | lr={lr:.6f} | {elapsed:.0f}с')

            if it % 50 == 0:
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
        'epochs': 25,               # Больше GPU-обучения
        'games_per_iter': 20,       # 40→20 (меньше Python)
        'num_candidates': 6,        # 12→6 (быстрее ходы)
        'eval_games': 40,           # 60→40
        'num_iterations': 500,
        'buffer_size': 200000,
        'warmup_games': 300,        # 500→300
        'checkpoint_dir': 'gpu_checkpoint',
    }

    trainer = GPUTrainer(config)

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
            print(f'vs Random: {[f"{w:.0%}" for w in wrs[-5:]]}')
    print(f'{"═"*60}')
