"""
Стойки — GPU Self-Play v6 (Vectorized)
20 партий параллельно, все кандидаты в один GPU-батч.
Максимальная утилизация GPU + CPU.

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
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
import multiprocessing as mp

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'analysis'))
from game import GameState, apply_action, get_valid_transfers
from train import sample_random_action_fast

DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
NUM_CPU = max(1, min(8, mp.cpu_count() // 2))  # Макс 8 воркеров для warmup

def print_gpu_info():
    print(f'Устройство: {DEVICE}')
    if DEVICE.type == 'cuda':
        print(f'GPU: {torch.cuda.get_device_name(0)}')
        print(f'VRAM: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB')
    print(f'CPU ядер: {NUM_CPU}')


# ═══ Encoding ═══

def encode_state(state):
    f = []
    p = state.current_player
    o = 1 - p
    for i in range(state.num_stands):
        ch = state.stands[i]
        t = len(ch)
        tc, ts = state.top_group(i)
        f.extend([
            t/11, sum(1 for c in ch if c==p)/11, sum(1 for c in ch if c==o)/11,
            ts/11, float(tc==p), float(tc==o),
            float(i in state.closed), float(state.closed.get(i)==p),
            float(i==0), max(0,11-t)/11,
        ])
    mc, oc = state.count_closed(p), state.count_closed(o)
    f.extend([mc/5, oc/5, (mc-oc)/5, state.num_open()/10, state.turn/100,
              float(state.swap_available), float(state.can_close_by_placement())])
    return np.array(f, dtype=np.float32)

INPUT_SIZE = 107


def heuristic_score(state, player):
    """Тактическая эвристика — синхронизирована с JS hybrid evaluator"""
    opp = 1 - player
    score = 0.0
    score += (state.count_closed(player) - state.count_closed(opp)) * 0.15
    if 0 in state.closed:
        score += 0.12 if state.closed[0] == player else -0.12
    for i in range(state.num_stands):
        if i in state.closed:
            continue
        ch = state.stands[i]
        if not ch:
            continue
        tc, ts = state.top_group(i)
        total = len(ch)
        if total >= 8 and tc == player:
            score += 0.08 if i == 0 else 0.05
        if total >= 8 and tc == opp:
            score -= 0.08 if i == 0 else 0.05
        if ts >= 3 and tc == player:
            score += 0.02
        if ts >= 3 and tc == opp:
            score -= 0.02
    return max(-1.0, min(1.0, score))


def smart_placement(state, player, exclude=None):
    """Умная установка — приоритет своим высоким стойкам"""
    exclude = exclude or []
    can_close = state.can_close_by_placement()
    min_space = 0 if can_close else 1
    avail = [i for i in state.open_stands() if i not in exclude and state.stand_space(i) > min_space]
    if not avail:
        return {}
    max_place = 5 if state.is_first_turn() else 3
    opp = 1 - player
    scored = []
    for i in avail:
        tc, ts = state.top_group(i)
        total = len(state.stands[i])
        s = total * 2
        if tc == player: s += 10 + ts * 3
        if tc == opp: s -= 5
        if i == 0: s += 5
        if total >= 7 and tc == player: s += 20
        scored.append((i, s))
    scored.sort(key=lambda x: -x[1])
    pl = {}
    rem = max_place
    for idx, _ in scored[:2]:
        if rem <= 0: break
        cap = min(state.stand_space(idx), rem) if can_close else min(state.stand_space(idx) - 1, rem)
        if cap > 0:
            pl[idx] = min(cap, rem)
            rem -= pl[idx]
    return pl


def gen_smart_candidates(state, player, n_random=6):
    """Генерация кандидатов: закрывающие + подготовительные + умные + рандомные"""
    cands = []
    transfers = get_valid_transfers(state)
    # Закрывающие переносы
    for src, dst in transfers:
        tc, gs = state.top_group(src)
        if len(state.stands[dst]) + gs >= 11:
            cands.append({'transfer': (src, dst), 'placement': smart_placement(state, player, [src, dst])})
            cands.append({'transfer': (src, dst), 'placement': {}})
    # Подготовительные переносы (строим к 7+)
    for src, dst in transfers:
        tc, gs = state.top_group(src)
        total_after = len(state.stands[dst]) + gs
        if total_after >= 11: continue
        if tc == player and total_after >= 7:
            cands.append({'transfer': (src, dst), 'placement': smart_placement(state, player, [src, dst])})
    # Умные установки
    for _ in range(2):
        pl = smart_placement(state, player)
        if pl: cands.append({'placement': pl})
    # Рандомные
    for _ in range(n_random):
        cands.append(sample_random_action_fast(state))
    return cands if cands else [sample_random_action_fast(state)]


# ═══ Сеть ═══

class ResBlock(nn.Module):
    def __init__(self, d):
        super().__init__()
        self.fc1, self.ln1 = nn.Linear(d,d), nn.LayerNorm(d)
        self.fc2, self.ln2 = nn.Linear(d,d), nn.LayerNorm(d)
    def forward(self, x):
        return F.relu(self.ln2(self.fc2(F.relu(self.ln1(self.fc1(x))))) + x)

class StoykaNet(nn.Module):
    def __init__(self, hidden=256, blocks=6):
        super().__init__()
        self.proj = nn.Sequential(nn.Linear(INPUT_SIZE, hidden), nn.LayerNorm(hidden), nn.ReLU())
        self.blocks = nn.ModuleList([ResBlock(hidden) for _ in range(blocks)])
        self.value = nn.Sequential(nn.Linear(hidden,64), nn.ReLU(), nn.Linear(64,1), nn.Tanh())
    def forward(self, x):
        h = self.proj(x)
        for b in self.blocks: h = b(h)
        return self.value(h)


# ═══ Vectorized Self-Play: N партий одновременно ═══

class VectorizedSelfPlay:
    """Играет N партий параллельно, все GPU-вызовы в одном батче."""

    def __init__(self, net, num_parallel=20, num_candidates=6, max_turns=100):
        self.net = net
        self.num_parallel = num_parallel
        self.num_candidates = num_candidates
        self.max_turns = max_turns

    def play_batch(self):
        """Играет num_parallel партий → возвращает все сэмплы"""
        self.net.eval()
        N = self.num_parallel
        K = self.num_candidates

        # Инициализация
        games = [GameState() for _ in range(N)]
        trajectories = [[] for _ in range(N)]
        active = list(range(N))  # Индексы незавершённых

        while active:
            # Генерируем K кандидатов для каждой активной партии
            all_features = []    # Все encoded states для GPU
            game_map = []        # (game_idx, candidate_idx)
            candidates = {}      # game_idx → [actions]

            for gi in active:
                state = games[gi]
                player = state.current_player
                cands = gen_smart_candidates(state, player, n_random=K)
                valid_cands = []
                for a in cands:
                    try:
                        ns = apply_action(state, a)
                        all_features.append(encode_state(ns))
                        game_map.append((gi, len(valid_cands)))
                        valid_cands.append((a, ns, player))
                    except:
                        pass
                if not valid_cands:
                    a = sample_random_action_fast(state)
                    ns = apply_action(state, a)
                    all_features.append(encode_state(ns))
                    game_map.append((gi, 0))
                    valid_cands.append((a, ns, player))
                candidates[gi] = valid_cands

            # ОДИН батч на GPU для ВСЕХ кандидатов ВСЕХ партий
            with torch.no_grad():
                x = torch.tensor(np.array(all_features), dtype=torch.float32).to(DEVICE)
                all_vals = self.net(x).cpu().numpy().flatten()

            # Выбираем лучший ход для каждой партии
            val_idx = 0
            new_active = []

            for gi in active:
                state = games[gi]
                K_actual = len(candidates[gi])
                nn_scores = all_vals[val_idx:val_idx + K_actual]
                val_idx += K_actual

                # Hybrid: 60% NN + 40% heuristic
                scores = np.zeros(K_actual)
                for j in range(K_actual):
                    _, ns, player = candidates[gi][j]
                    nn_v = nn_scores[j] if ns.current_player == player else -nn_scores[j]
                    h_v = heuristic_score(ns, player)
                    scores[j] = nn_v * 0.6 + h_v * 0.4

                # Exploration через softmax
                temp = 0.3 if state.turn < 20 else 0.05
                if temp <= 0:
                    best = np.argmax(scores)
                else:
                    exp = np.exp((scores - scores.max()) / max(temp, 0.01))
                    probs = exp / exp.sum()
                    best = np.random.choice(K_actual, p=probs)

                # Сохраняем траекторию
                trajectories[gi].append((encode_state(state), state.current_player))

                # Применяем ход
                games[gi] = apply_action(state, candidates[gi][best][0])

                if not games[gi].game_over and games[gi].turn <= self.max_turns:
                    new_active.append(gi)
                elif not games[gi].game_over:
                    games[gi].game_over = True
                    games[gi].winner = -1

            active = new_active

        # Собираем samples
        all_samples = []
        for gi in range(N):
            winner = games[gi].winner
            for features, player in trajectories[gi]:
                if winner == player: v = 1.0
                elif winner == 1 - player: v = -1.0
                else: v = 0.0
                all_samples.append((features, v))

        return all_samples


# ═══ Быстрый рандомный warmup (multiprocess) ═══

def _play_random_games(num):
    samples = []
    for _ in range(num):
        traj = []
        s = GameState()
        while not s.game_over:
            f = encode_state(s)
            p = s.current_player
            s = apply_action(s, sample_random_action_fast(s))
            traj.append((f, p))
            if s.turn > 100: s.game_over = True; s.winner = -1; break
        for f, p in traj:
            v = 1.0 if s.winner == p else (-1.0 if s.winner == 1-p else 0.0)
            samples.append((f, v))
    return samples


def warmup_parallel(total_games, num_workers=None):
    """Рандомные партии на всех CPU ядрах"""
    nw = num_workers or NUM_CPU
    per_worker = total_games // nw
    with ProcessPoolExecutor(max_workers=nw) as pool:
        futures = [pool.submit(_play_random_games, per_worker) for _ in range(nw)]
        all_samples = []
        for f in futures:
            all_samples.extend(f.result())
    return all_samples


# ═══ Eval ═══

def evaluate_net(net, num_games=40):
    """Оценка: hybrid AI (NN + heuristics) vs random"""
    net.eval()
    wins = 0
    for g in range(num_games):
        state = GameState()
        net_player = g % 2
        while not state.game_over:
            if state.current_player == net_player:
                cands = gen_smart_candidates(state, net_player, n_random=8)
                feats, valid = [], []
                for a in cands:
                    try:
                        ns = apply_action(state, a)
                        feats.append(encode_state(ns))
                        valid.append((a, ns))
                    except:
                        pass
                if not valid:
                    state = apply_action(state, sample_random_action_fast(state))
                    if state.turn > 150: break
                    continue
                with torch.no_grad():
                    vals = net(torch.tensor(np.array(feats), dtype=torch.float32).to(DEVICE)).cpu().numpy().flatten()
                # Hybrid: 60% NN + 40% heuristic
                scores = []
                for j, (a, ns) in enumerate(valid):
                    nn_v = vals[j] if ns.current_player == net_player else -vals[j]
                    h_v = heuristic_score(ns, net_player)
                    scores.append(nn_v * 0.6 + h_v * 0.4)
                action = valid[int(np.argmax(scores))][0]
            else:
                action = sample_random_action_fast(state)
            state = apply_action(state, action)
            if state.turn > 150: break
        if state.winner == net_player: wins += 1
    return wins / num_games


# ═══ Тренер ═══

class GPUTrainer:
    def __init__(self, cfg=None):
        c = cfg or {}
        self.hidden = c.get('hidden', 256)
        self.num_blocks = c.get('num_blocks', 6)
        self.lr = c.get('lr', 0.001)
        self.bs = c.get('batch_size', 1024)
        self.epochs = c.get('epochs', 25)
        self.parallel = c.get('parallel', 30)
        self.rounds = c.get('rounds_per_iter', 3)
        self.num_candidates = c.get('num_candidates', 6)
        self.eval_games = c.get('eval_games', 40)
        self.num_iterations = c.get('num_iterations', 500)
        self.buffer_size = c.get('buffer_size', 300000)
        self.warmup = c.get('warmup_games', 1000)
        self.ckpt_dir = c.get('checkpoint_dir', 'gpu_checkpoint')

        self.net = StoykaNet(self.hidden, self.num_blocks).to(DEVICE)
        self.opt = optim.Adam(self.net.parameters(), lr=self.lr, weight_decay=1e-4)
        self.sched = optim.lr_scheduler.CosineAnnealingLR(self.opt, T_max=300, eta_min=0.0001)

        self.buf_x, self.buf_y = [], []
        self.history = []
        self.version = 0

        os.makedirs(self.ckpt_dir, exist_ok=True)
        tp = sum(p.numel() for p in self.net.parameters())
        print(f'Сеть: {self.hidden}×{self.num_blocks}, {tp:,} параметров')

    def train_on_buffer(self):
        n = len(self.buf_x)
        if n < self.bs: return 0.0
        self.net.train()
        sz = min(n, self.buffer_size)
        X = torch.tensor(np.array(self.buf_x[-sz:]), dtype=torch.float32).to(DEVICE)
        Y = torch.tensor(np.array(self.buf_y[-sz:]), dtype=torch.float32).unsqueeze(1).to(DEVICE)
        tl, nb = 0.0, 0
        for _ in range(self.epochs):
            pm = torch.randperm(len(X))
            for s in range(0, len(X), self.bs):
                idx = pm[s:s+self.bs]
                loss = F.mse_loss(self.net(X[idx]), Y[idx])
                self.opt.zero_grad(); loss.backward()
                torch.nn.utils.clip_grad_norm_(self.net.parameters(), 1.0)
                self.opt.step(); tl += loss.item(); nb += 1
        self.sched.step()
        return tl / max(nb, 1)

    def run(self):
        sp = VectorizedSelfPlay(self.net, self.parallel, self.num_candidates)
        games_per_iter = self.parallel * self.rounds

        print(f'\n{"═"*60}')
        print(f'Vectorized Self-Play: {self.num_iterations} итер')
        print(f'  {self.parallel} параллельных партий × {self.rounds} раундов = {games_per_iter} партий/итер')
        print(f'  {self.num_candidates} кандидатов → 1 GPU батч ({self.parallel * self.num_candidates} инференсов/ход)')
        print(f'  GPU batch={self.bs}, epochs={self.epochs}')
        print(f'{"═"*60}')

        if self.version == 0 and len(self.buf_x) < 5000:
            print(f'\nWarmup: {self.warmup} рандомных партий на {NUM_CPU} ядрах...')
            t0 = time.time()
            samples = warmup_parallel(self.warmup)
            for f, v in samples: self.buf_x.append(f); self.buf_y.append(v)
            loss = self.train_on_buffer()
            wr = evaluate_net(self.net, self.eval_games)
            print(f'  {len(samples):,} сэмплов, loss={loss:.4f}, wr={wr:.0%}, {time.time()-t0:.0f}с')

        print()

        for it in range(1, self.num_iterations + 1):
            self.version += 1
            t0 = time.time()

            # Vectorized self-play
            for r in range(self.rounds):
                samples = sp.play_batch()
                for f, v in samples: self.buf_x.append(f); self.buf_y.append(v)

            if len(self.buf_x) > self.buffer_size:
                self.buf_x = self.buf_x[-self.buffer_size:]
                self.buf_y = self.buf_y[-self.buffer_size:]

            # GPU обучение
            loss = self.train_on_buffer()
            elapsed = time.time() - t0
            lr = self.sched.get_last_lr()[0]

            wr_str = '—'
            wr_val = None
            if it == 1 or it % 25 == 0:
                wr_val = evaluate_net(self.net, self.eval_games)
                wr_str = f'{wr_val:.0%}'

            self.history.append({
                'version': self.version, 'loss': round(loss, 5),
                'vs_random': round(wr_val, 3) if wr_val is not None else None,
                'buffer': len(self.buf_x), 'time': round(elapsed, 1),
            })

            print(f'  v{self.version:3d} | loss={loss:.4f} | wr={wr_str:>4s} | buf={len(self.buf_x):>7,} | lr={lr:.6f} | {elapsed:.0f}с')

            if it % 50 == 0:
                self.save()
                print(f'  → Чекпоинт v{self.version}')

        self.save()
        return self.history

    def save(self):
        torch.save({
            'model': self.net.state_dict(), 'optimizer': self.opt.state_dict(),
            'version': self.version, 'history': self.history,
        }, os.path.join(self.ckpt_dir, f'model_v{self.version}.pt'))
        with open(os.path.join(self.ckpt_dir, 'history.json'), 'w') as f:
            json.dump(self.history, f, indent=2)

    def load(self, path):
        ckpt = torch.load(path, map_location=DEVICE, weights_only=False)
        self.net.load_state_dict(ckpt['model'])
        if 'optimizer' in ckpt: self.opt.load_state_dict(ckpt['optimizer'])
        self.version = ckpt.get('version', 0)
        self.history = ckpt.get('history', [])
        print(f'Загружена v{self.version}')


if __name__ == '__main__':
    import argparse
    mp.set_start_method('spawn', force=True)
    print_gpu_info()

    parser = argparse.ArgumentParser(description='GPU Self-Play тренер')
    parser.add_argument('--checkpoint', help='Путь к чекпоинту (.pt)')
    parser.add_argument('--iterations', type=int, default=2000, help='Кол-во итераций')
    parser.add_argument('--parallel', type=int, default=20, help='Параллельных партий')
    parser.add_argument('--export-json', default='../src/engine/gpu_weights.json', help='Экспорт весов')
    args = parser.parse_args()

    config = {
        'hidden': 256,
        'num_blocks': 6,
        'lr': 0.001,
        'batch_size': 4096 if args.parallel >= 40 else 1024,  # RTX 5090 = 4096
        'epochs': 20,
        'parallel': args.parallel,
        'rounds_per_iter': 5 if args.parallel >= 40 else 3,  # RTX 5090 = 5 раундов
        'num_candidates': 12 if args.parallel >= 40 else 8,  # Больше кандидатов = точнее ходы
        'eval_games': 60 if args.parallel >= 40 else 40,     # Точнее WR оценка
        'num_iterations': args.iterations,
        'buffer_size': 500000 if args.parallel >= 40 else 300000,  # Больше буфер
        'warmup_games': 1000 if args.parallel >= 40 else 500,
        'checkpoint_dir': 'gpu_checkpoint',
    }

    trainer = GPUTrainer(config)

    # Загружаем чекпоинт
    if args.checkpoint and os.path.exists(args.checkpoint):
        trainer.load(args.checkpoint)
    else:
        ckpts = sorted([f for f in os.listdir(config['checkpoint_dir']) if f.endswith('.pt')]) if os.path.exists(config['checkpoint_dir']) else []
        if ckpts:
            trainer.load(os.path.join(config['checkpoint_dir'], ckpts[-1]))

    print(f'\nСтарт с v{trainer.version}, {args.iterations} итераций')
    trainer.run()

    # Экспорт весов в JSON
    if args.export_json:
        weights = {}
        total = 0
        for k, v in trainer.net.state_dict().items():
            arr = np.round(v.cpu().numpy().astype(np.float32), 4).flatten()
            weights[k] = arr.tolist()
            total += arr.size
        with open(args.export_json, 'w') as f:
            json.dump(weights, f, separators=(',', ':'))
        print(f'\n✅ Экспорт: {total:,} params → {args.export_json}')
        print(f'   git add {args.export_json} && git commit && git push')
