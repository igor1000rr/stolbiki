"""
Стойки — GPU Self-Play v7 (AlphaZero Policy+Value)
Policy head + Value head, PUCT MCTS, candidate scoring.

Изменения от v6:
  - Policy head: backbone 256→64 (ctx) + action 35→64 (embed) → dot product
  - PUCT MCTS с policy priors вместо равномерного UCB1
  - Dual loss: policy CE + value MSE
  - Фикс: gen_smart_candidates возвращает Action, не dict
  - ~859K params (+19K к 840K)

py -3.12 gpu_trainer_v7.py
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
from concurrent.futures import ProcessPoolExecutor
import multiprocessing as mp

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'analysis'))
from game import GameState, Action, apply_action, get_valid_transfers, NUM_STANDS, MAX_CHIPS
from train import sample_random_action_fast

DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
NUM_CPU = max(1, min(8, mp.cpu_count() // 2))

def print_gpu_info():
    print(f'Устройство: {DEVICE}')
    if DEVICE.type == 'cuda':
        print(f'GPU: {torch.cuda.get_device_name(0)}')
        print(f'VRAM: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB')
    print(f'CPU ядер: {NUM_CPU}')


# ═══ Encoding: State (107 фич) ═══

INPUT_SIZE = 107

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


# ═══ Encoding: Action (35 фич) ═══

ACTION_FEAT_SIZE = 35

def encode_action(state, action):
    """Кодирование хода в вектор фич для policy head.

    [0]:     swap
    [1]:     has_transfer
    [2-11]:  src one-hot (10)
    [12-21]: dst one-hot (10)
    [22]:    transfer group_size / 11
    [23]:    is_closing (transfer заполняет стойку до 11+)
    [24-33]: placement count per stand / 3 (10)
    [34]:    total_placed / 3
    """
    f = np.zeros(ACTION_FEAT_SIZE, dtype=np.float32)
    if action.swap:
        f[0] = 1.0
        return f
    if action.transfer:
        src, dst = action.transfer
        f[1] = 1.0
        f[2 + src] = 1.0
        f[12 + dst] = 1.0
        tc, gs = state.top_group(src)
        f[22] = gs / 11.0
        if len(state.stands[dst]) + gs >= MAX_CHIPS:
            f[23] = 1.0
    if action.placement:
        total = 0
        for stand_idx, count in action.placement.items():
            f[24 + int(stand_idx)] = count / 3.0
            total += count
        f[34] = total / 3.0
    return f


# ═══ Эвристики ═══

def heuristic_score(state, player):
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
    exclude = exclude or []
    can_close = state.can_close_by_placement()
    min_space = 0 if can_close else 1
    avail = [i for i in state.open_stands() if i not in exclude and state.stand_space(i) > min_space]
    if not avail:
        return {}
    max_place = 1 if state.is_first_turn() else 3
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
    """Генерация кандидатов: закрывающие + подготовительные + умные + рандомные.
    ФИКС v7: все возвращают Action, не dict.
    """
    cands = []
    transfers = get_valid_transfers(state)

    # Закрывающие переносы
    for src, dst in transfers:
        tc, gs = state.top_group(src)
        if len(state.stands[dst]) + gs >= MAX_CHIPS:
            cands.append(Action(transfer=(src, dst), placement=smart_placement(state, player, [src, dst])))
            cands.append(Action(transfer=(src, dst), placement={}))

    # Подготовительные переносы (строим к 7+)
    for src, dst in transfers:
        tc, gs = state.top_group(src)
        total_after = len(state.stands[dst]) + gs
        if total_after >= MAX_CHIPS:
            continue
        if tc == player and total_after >= 7:
            cands.append(Action(transfer=(src, dst), placement=smart_placement(state, player, [src, dst])))

    # Умные установки
    for _ in range(2):
        pl = smart_placement(state, player)
        if pl:
            cands.append(Action(placement=pl))

    # Рандомные
    for _ in range(n_random):
        cands.append(sample_random_action_fast(state))

    return cands if cands else [sample_random_action_fast(state)]


# ═══ Сеть v7: Policy + Value ═══

class ResBlock(nn.Module):
    def __init__(self, d):
        super().__init__()
        self.fc1, self.ln1 = nn.Linear(d, d), nn.LayerNorm(d)
        self.fc2, self.ln2 = nn.Linear(d, d), nn.LayerNorm(d)

    def forward(self, x):
        return F.relu(self.ln2(self.fc2(F.relu(self.ln1(self.fc1(x))))) + x)


class StoykaNet(nn.Module):
    """ResNet с двумя головами: value + policy (candidate scoring)."""

    def __init__(self, hidden=256, blocks=6):
        super().__init__()
        self.proj = nn.Sequential(nn.Linear(INPUT_SIZE, hidden), nn.LayerNorm(hidden), nn.ReLU())
        self.blocks = nn.ModuleList([ResBlock(hidden) for _ in range(blocks)])
        # Value head (без изменений)
        self.value = nn.Sequential(nn.Linear(hidden, 64), nn.ReLU(), nn.Linear(64, 1), nn.Tanh())
        # Policy head: candidate scoring через dot product
        self.policy_ctx = nn.Sequential(nn.Linear(hidden, 64), nn.ReLU())
        self.action_enc = nn.Linear(ACTION_FEAT_SIZE, 64)

    def backbone(self, x):
        """Прогон backbone, возвращает trunk features (batch, hidden)."""
        h = self.proj(x)
        for b in self.blocks:
            h = b(h)
        return h

    def forward(self, x):
        """Возвращает (value, trunk) для совместимости."""
        h = self.backbone(x)
        return self.value(h), h

    def value_only(self, x):
        """Только value (для eval и backward-совместимости)."""
        h = self.backbone(x)
        return self.value(h)

    def policy_logits(self, trunk, action_feats):
        """Policy logits для кандидатов.

        trunk: (batch, hidden)
        action_feats: (batch, K, ACTION_FEAT_SIZE) — K кандидатов
        Returns: (batch, K) logits
        """
        ctx = self.policy_ctx(trunk)           # (batch, 64)
        act = self.action_enc(action_feats)    # (batch, K, 64)
        logits = (ctx.unsqueeze(1) * act).sum(-1)  # (batch, K)
        return logits


# ═══ Vectorized Self-Play v7: PUCT MCTS ═══

MAX_CANDIDATES = 32  # Паддинг для батча policy targets

class VectorizedSelfPlay:
    """N партий параллельно, PUCT MCTS с policy priors."""

    def __init__(self, net, num_parallel=20, num_candidates=8, mcts_sims=50, max_turns=100):
        self.net = net
        self.num_parallel = num_parallel
        self.num_candidates = num_candidates
        self.mcts_sims = mcts_sims
        self.max_turns = max_turns

    def play_batch(self):
        """Играет num_parallel партий → (value_samples, policy_samples)."""
        self.net.eval()
        N = self.num_parallel
        K = self.num_candidates

        games = [GameState() for _ in range(N)]
        # Траектории: (state_feat, player, action_feats, visit_probs, num_cands)
        traj_value = [[] for _ in range(N)]
        traj_policy = [[] for _ in range(N)]
        active = list(range(N))

        while active:
            # ── Шаг 1: Генерация кандидатов ──
            all_cand_feats = []   # Encoded next states для value
            game_cands = {}       # gi → [(action, next_state, player)]

            for gi in active:
                state = games[gi]
                player = state.current_player
                cands_raw = gen_smart_candidates(state, player, n_random=K)
                valid = []
                for a in cands_raw:
                    if len(valid) >= MAX_CANDIDATES:
                        break
                    try:
                        ns = apply_action(state, a)
                        valid.append((a, ns, player))
                    except:
                        pass
                if not valid:
                    a = sample_random_action_fast(state)
                    ns = apply_action(state, a)
                    valid.append((a, ns, player))
                game_cands[gi] = valid
                for (a, ns, p) in valid:
                    all_cand_feats.append(encode_state(ns))

            # ── Шаг 2: Батч GPU — value для всех кандидатов ──
            with torch.no_grad():
                x_cands = torch.tensor(np.array(all_cand_feats), dtype=torch.float32).to(DEVICE)
                all_vals = self.net.value_only(x_cands).cpu().numpy().flatten()

            # ── Шаг 3: Батч GPU — policy priors ──
            # Собираем текущие состояния и action features
            state_feats_list = []
            action_feats_list = []  # (N_active, max_K, 35)
            num_cands_list = []

            for gi in active:
                state = games[gi]
                state_feats_list.append(encode_state(state))
                cands = game_cands[gi]
                k = len(cands)
                num_cands_list.append(k)
                af = np.zeros((MAX_CANDIDATES, ACTION_FEAT_SIZE), dtype=np.float32)
                for j, (a, ns, p) in enumerate(cands):
                    af[j] = encode_action(state, a)
                action_feats_list.append(af)

            with torch.no_grad():
                x_states = torch.tensor(np.array(state_feats_list), dtype=torch.float32).to(DEVICE)
                x_actions = torch.tensor(np.array(action_feats_list), dtype=torch.float32).to(DEVICE)
                trunk = self.net.backbone(x_states)
                policy_logits = self.net.policy_logits(trunk, x_actions).cpu().numpy()

            # ── Шаг 4: PUCT MCTS для каждой партии ──
            val_idx = 0
            new_active = []

            for ai, gi in enumerate(active):
                state = games[gi]
                player = state.current_player
                cands = game_cands[gi]
                k = len(cands)

                # Значения кандидатов (из value head)
                cand_vals = np.zeros(k)
                for j in range(k):
                    _, ns, p = cands[j]
                    v = all_vals[val_idx + j]
                    cand_vals[j] = v if ns.current_player == player else -v
                val_idx += k

                # Hybrid: 60% NN + 40% heuristic (policy управляет exploration)
                scores = np.zeros(k)
                for j in range(k):
                    _, ns, p = cands[j]
                    h_v = heuristic_score(ns, player)
                    scores[j] = cand_vals[j] * 0.6 + h_v * 0.4

                # Policy priors + Dirichlet noise (AlphaZero стандарт)
                logits = policy_logits[ai, :k]
                priors = _softmax(logits)
                noise = np.random.dirichlet([0.3] * k)
                priors = 0.75 * priors + 0.25 * noise

                # PUCT MCTS (flat — кешированные values + шум для разнообразия)
                visits = np.zeros(k)
                total_vals = np.zeros(k)
                c_puct = 2.5

                for sim in range(self.mcts_sims):
                    total_n = visits.sum() + 1
                    best_score = -1e9
                    best_j = 0
                    for j in range(k):
                        if visits[j] == 0:
                            q = 0.0
                        else:
                            q = total_vals[j] / visits[j]
                        u = c_puct * priors[j] * np.sqrt(total_n) / (1 + visits[j])
                        s = q + u
                        if s > best_score:
                            best_score = s
                            best_j = j
                    visits[best_j] += 1
                    # Value + небольшой шум, чтобы Q варьировалось между симуляциями
                    total_vals[best_j] += scores[best_j] + np.random.normal(0, 0.03)

                # Visit distribution → policy target
                visit_probs = visits / visits.sum()

                # Сохраняем policy target
                af_valid = np.zeros((MAX_CANDIDATES, ACTION_FEAT_SIZE), dtype=np.float32)
                vp_valid = np.zeros(MAX_CANDIDATES, dtype=np.float32)
                for j in range(k):
                    af_valid[j] = encode_action(state, cands[j][0])
                    vp_valid[j] = visit_probs[j]
                traj_policy[gi].append((encode_state(state), af_valid, vp_valid, k))
                traj_value[gi].append((encode_state(state), player))

                # Выбор хода: proportional to visits (с temperature)
                temp = 1.0 if state.turn < 15 else 0.3
                if temp <= 0.01:
                    best = np.argmax(visits)
                else:
                    exp_v = np.power(visits, 1.0 / temp)
                    pick_probs = exp_v / exp_v.sum()
                    best = np.random.choice(k, p=pick_probs)

                games[gi] = apply_action(state, cands[best][0])

                if not games[gi].game_over and games[gi].turn <= self.max_turns:
                    new_active.append(gi)
                elif not games[gi].game_over:
                    games[gi].game_over = True
                    games[gi].winner = -1

            active = new_active

        # ── Собираем samples ──
        value_samples = []
        policy_samples = []

        for gi in range(N):
            winner = games[gi].winner
            for features, player in traj_value[gi]:
                if winner == player:
                    v = 1.0
                elif winner == 1 - player:
                    v = -1.0
                else:
                    v = 0.0
                value_samples.append((features, v))

            for features, action_feats, visit_probs, num_cands in traj_policy[gi]:
                # value target тот же
                player_idx = len(value_samples) - len(traj_value[gi])  # approx
                policy_samples.append((features, action_feats, visit_probs, num_cands))

        return value_samples, policy_samples


def _softmax(x):
    e = np.exp(x - x.max())
    return e / e.sum()


# ═══ Warmup (рандомный, без policy) ═══

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
            if s.turn > 100:
                s.game_over = True
                s.winner = -1
                break
        for f, p in traj:
            v = 1.0 if s.winner == p else (-1.0 if s.winner == 1 - p else 0.0)
            samples.append((f, v))
    return samples


def warmup_parallel(total_games, num_workers=None):
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
    """Оценка: hybrid AI (NN + policy + heuristics) vs random."""
    net.eval()
    wins = 0
    for g in range(num_games):
        state = GameState()
        net_player = g % 2
        while not state.game_over:
            if state.current_player == net_player:
                cands_raw = gen_smart_candidates(state, net_player, n_random=8)
                feats, valid = [], []
                for a in cands_raw:
                    try:
                        ns = apply_action(state, a)
                        feats.append(encode_state(ns))
                        valid.append((a, ns))
                    except:
                        pass
                if not valid:
                    state = apply_action(state, sample_random_action_fast(state))
                    if state.turn > 150:
                        break
                    continue
                with torch.no_grad():
                    x = torch.tensor(np.array(feats), dtype=torch.float32).to(DEVICE)
                    vals = net.value_only(x).cpu().numpy().flatten()
                # Hybrid + policy priors для выбора
                scores = []
                for j, (a, ns) in enumerate(valid):
                    nn_v = vals[j] if ns.current_player == net_player else -vals[j]
                    h_v = heuristic_score(ns, net_player)
                    scores.append(nn_v * 0.6 + h_v * 0.4)
                action = valid[int(np.argmax(scores))][0]
            else:
                action = sample_random_action_fast(state)
            state = apply_action(state, action)
            if state.turn > 150:
                break
        if state.winner == net_player:
            wins += 1
    return wins / num_games


# ═══ Тренер v7 ═══

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
        self.num_candidates = c.get('num_candidates', 8)
        self.mcts_sims = c.get('mcts_sims', 100)
        self.eval_games = c.get('eval_games', 40)
        self.num_iterations = c.get('num_iterations', 500)
        self.buffer_size = c.get('buffer_size', 300000)
        self.warmup = c.get('warmup_games', 1000)
        self.ckpt_dir = c.get('checkpoint_dir', 'gpu_checkpoint_v7')
        self.policy_weight = c.get('policy_weight', 1.0)  # Вес policy loss

        self.net = StoykaNet(self.hidden, self.num_blocks).to(DEVICE)
        self.opt = optim.Adam(self.net.parameters(), lr=self.lr, weight_decay=1e-4)
        self.sched = optim.lr_scheduler.CosineAnnealingLR(self.opt, T_max=300, eta_min=0.0001)

        # Буферы: value + policy
        self.buf_x, self.buf_y = [], []  # State features, value targets
        self.buf_pstate = []    # State features для policy
        self.buf_paction = []   # (MAX_CANDIDATES, 35) action features
        self.buf_pprobs = []    # (MAX_CANDIDATES,) visit probs
        self.buf_pnum = []      # num valid candidates
        self.history = []
        self.version = 0

        os.makedirs(self.ckpt_dir, exist_ok=True)
        tp = sum(p.numel() for p in self.net.parameters())
        print(f'Сеть v7: {self.hidden}×{self.num_blocks}, {tp:,} параметров (policy+value)')

    def train_on_buffer(self):
        """Dual loss: value MSE + policy CE."""
        n_val = len(self.buf_x)
        n_pol = len(self.buf_pstate)
        if n_val < self.bs:
            return 0.0, 0.0

        self.net.train()

        # Value буфер
        sz_v = min(n_val, self.buffer_size)
        X_v = torch.tensor(np.array(self.buf_x[-sz_v:]), dtype=torch.float32).to(DEVICE)
        Y_v = torch.tensor(np.array(self.buf_y[-sz_v:]), dtype=torch.float32).unsqueeze(1).to(DEVICE)

        # Policy буфер (может быть меньше, пока нет policy данных)
        has_policy = n_pol >= self.bs
        if has_policy:
            sz_p = min(n_pol, self.buffer_size)
            X_ps = torch.tensor(np.array(self.buf_pstate[-sz_p:]), dtype=torch.float32).to(DEVICE)
            X_pa = torch.tensor(np.array(self.buf_paction[-sz_p:]), dtype=torch.float32).to(DEVICE)
            Y_pp = torch.tensor(np.array(self.buf_pprobs[-sz_p:]), dtype=torch.float32).to(DEVICE)
            N_pc = torch.tensor(np.array(self.buf_pnum[-sz_p:]), dtype=torch.long).to(DEVICE)

        tl_v, tl_p, nb = 0.0, 0.0, 0
        for _ in range(self.epochs):
            # Value training
            pm = torch.randperm(len(X_v))
            for s in range(0, len(X_v), self.bs):
                idx = pm[s:s + self.bs]
                val_pred = self.net.value_only(X_v[idx])
                loss_v = F.mse_loss(val_pred, Y_v[idx])

                # Policy training (если есть данные)
                loss_p = torch.tensor(0.0, device=DEVICE)
                if has_policy:
                    # Берём батч из policy буфера (случайные индексы)
                    pidx = torch.randint(0, len(X_ps), (min(len(idx), len(X_ps)),), device=DEVICE)
                    trunk = self.net.backbone(X_ps[pidx])
                    logits = self.net.policy_logits(trunk, X_pa[pidx])  # (B, MAX_CANDIDATES)
                    targets = Y_pp[pidx]  # (B, MAX_CANDIDATES)
                    nums = N_pc[pidx]     # (B,)
                    # Маска: только валидные кандидаты
                    mask = torch.arange(MAX_CANDIDATES, device=DEVICE).unsqueeze(0) < nums.unsqueeze(1)
                    # Маскированный softmax + CE
                    logits_masked = logits.masked_fill(~mask, -1e9)
                    log_probs = F.log_softmax(logits_masked, dim=-1)
                    # CE per sample = -sum(target * log_prob), затем mean по батчу
                    # targets=0 для невалидных → 0*(-1e9)=0, NaN не будет
                    loss_p = -(targets * log_probs).sum(dim=-1).mean()

                loss = loss_v + self.policy_weight * loss_p
                self.opt.zero_grad()
                loss.backward()
                torch.nn.utils.clip_grad_norm_(self.net.parameters(), 1.0)
                self.opt.step()
                tl_v += loss_v.item()
                tl_p += loss_p.item()
                nb += 1

        self.sched.step()
        return tl_v / max(nb, 1), tl_p / max(nb, 1)

    def run(self):
        sp = VectorizedSelfPlay(
            self.net, self.parallel, self.num_candidates,
            mcts_sims=self.mcts_sims
        )
        games_per_iter = self.parallel * self.rounds

        print(f'\n{"═"*65}')
        print(f'AlphaZero Self-Play v7: {self.num_iterations} итер')
        print(f'  {self.parallel} параллельных × {self.rounds} раундов = {games_per_iter} партий/итер')
        print(f'  {self.num_candidates} кандидатов, {self.mcts_sims} PUCT симуляций/ход')
        print(f'  GPU batch={self.bs}, epochs={self.epochs}')
        print(f'  Policy weight: {self.policy_weight}')
        print(f'{"═"*65}')

        if self.version == 0 and len(self.buf_x) < 5000:
            print(f'\nWarmup: {self.warmup} рандомных партий на {NUM_CPU} ядрах...')
            t0 = time.time()
            samples = warmup_parallel(self.warmup)
            for f, v in samples:
                self.buf_x.append(f)
                self.buf_y.append(v)
            loss_v, loss_p = self.train_on_buffer()
            wr = evaluate_net(self.net, self.eval_games)
            print(f'  {len(samples):,} сэмплов, loss_v={loss_v:.4f}, wr={wr:.0%}, {time.time()-t0:.0f}с')

        print()

        for it in range(1, self.num_iterations + 1):
            self.version += 1
            t0 = time.time()

            for r in range(self.rounds):
                val_samples, pol_samples = sp.play_batch()
                for f, v in val_samples:
                    self.buf_x.append(f)
                    self.buf_y.append(v)
                for sf, af, vp, nc in pol_samples:
                    self.buf_pstate.append(sf)
                    self.buf_paction.append(af)
                    self.buf_pprobs.append(vp)
                    self.buf_pnum.append(nc)

            # Обрезка буферов
            if len(self.buf_x) > self.buffer_size:
                self.buf_x = self.buf_x[-self.buffer_size:]
                self.buf_y = self.buf_y[-self.buffer_size:]
            if len(self.buf_pstate) > self.buffer_size:
                self.buf_pstate = self.buf_pstate[-self.buffer_size:]
                self.buf_paction = self.buf_paction[-self.buffer_size:]
                self.buf_pprobs = self.buf_pprobs[-self.buffer_size:]
                self.buf_pnum = self.buf_pnum[-self.buffer_size:]

            loss_v, loss_p = self.train_on_buffer()
            elapsed = time.time() - t0
            lr = self.sched.get_last_lr()[0]

            wr_str = '—'
            wr_val = None
            if it == 1 or it % 25 == 0:
                wr_val = evaluate_net(self.net, self.eval_games)
                wr_str = f'{wr_val:.0%}'

            self.history.append({
                'version': self.version, 'loss_v': round(loss_v, 5), 'loss_p': round(loss_p, 5),
                'vs_random': round(wr_val, 3) if wr_val is not None else None,
                'buffer': len(self.buf_x), 'policy_buf': len(self.buf_pstate),
                'time': round(elapsed, 1),
            })

            print(f'  v{self.version:3d} | Lv={loss_v:.4f} Lp={loss_p:.4f} | wr={wr_str:>4s} | buf={len(self.buf_x):>7,}/{len(self.buf_pstate):>7,} | lr={lr:.6f} | {elapsed:.0f}с')

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
        sd = ckpt['model']
        # Совместимость: если нет policy ключей — загружаем только backbone+value
        missing = [k for k in self.net.state_dict() if k not in sd]
        if missing:
            print(f'  ⚠ Новые ключи ({len(missing)}): {", ".join(missing[:5])}...')
            print(f'  → Policy head инициализируется рандомно')
            # Загружаем частично
            own_sd = self.net.state_dict()
            for k, v in sd.items():
                if k in own_sd and own_sd[k].shape == v.shape:
                    own_sd[k] = v
            self.net.load_state_dict(own_sd)
        else:
            self.net.load_state_dict(sd)
        if 'optimizer' in ckpt:
            try:
                self.opt.load_state_dict(ckpt['optimizer'])
            except:
                print('  ⚠ Optimizer state не совместим, пересоздан')
        self.version = ckpt.get('version', 0)
        self.history = ckpt.get('history', [])
        print(f'Загружена v{self.version}')

    def load_v6(self, path):
        """Загрузка весов v6 (только value head) — для миграции."""
        ckpt = torch.load(path, map_location=DEVICE, weights_only=False)
        sd = ckpt['model']
        own_sd = self.net.state_dict()
        loaded = 0
        for k, v in sd.items():
            if k in own_sd and own_sd[k].shape == v.shape:
                own_sd[k] = v
                loaded += 1
        self.net.load_state_dict(own_sd)
        self.version = ckpt.get('version', 0)
        self.history = ckpt.get('history', [])
        print(f'Миграция v6→v7: загружено {loaded} тензоров, policy head рандомный')
        print(f'  Версия: v{self.version}')


if __name__ == '__main__':
    import argparse
    mp.set_start_method('spawn', force=True)
    print_gpu_info()

    parser = argparse.ArgumentParser(description='GPU Self-Play тренер v7 (AlphaZero)')
    parser.add_argument('--checkpoint', help='Путь к чекпоинту (.pt)')
    parser.add_argument('--v6-checkpoint', help='Миграция с v6: путь к старому чекпоинту')
    parser.add_argument('--iterations', type=int, default=2000, help='Кол-во итераций')
    parser.add_argument('--parallel', type=int, default=20, help='Параллельных партий')
    parser.add_argument('--mcts-sims', type=int, default=100, help='PUCT симуляций на ход')
    parser.add_argument('--export-json', default='../src/engine/gpu_weights.json', help='Экспорт весов')
    args = parser.parse_args()

    config = {
        'hidden': 256,
        'num_blocks': 6,
        'lr': 0.001,
        'batch_size': 4096 if args.parallel >= 40 else 1024,
        'epochs': 20,
        'parallel': args.parallel,
        'rounds_per_iter': 5 if args.parallel >= 40 else 3,
        'num_candidates': 12 if args.parallel >= 40 else 8,
        'mcts_sims': args.mcts_sims,
        'eval_games': 60 if args.parallel >= 40 else 40,
        'num_iterations': args.iterations,
        'buffer_size': 500000 if args.parallel >= 40 else 300000,
        'warmup_games': 1000 if args.parallel >= 40 else 500,
        'checkpoint_dir': 'gpu_checkpoint_v7',
        'policy_weight': 1.0,
    }

    trainer = GPUTrainer(config)

    # Миграция с v6
    if args.v6_checkpoint and os.path.exists(args.v6_checkpoint):
        trainer.load_v6(args.v6_checkpoint)
    elif args.checkpoint and os.path.exists(args.checkpoint):
        trainer.load(args.checkpoint)
    else:
        ckpt_dir = config['checkpoint_dir']
        ckpts = sorted([f for f in os.listdir(ckpt_dir) if f.endswith('.pt')]) if os.path.exists(ckpt_dir) else []
        if ckpts:
            trainer.load(os.path.join(ckpt_dir, ckpts[-1]))

    print(f'\nСтарт с v{trainer.version}, {args.iterations} итераций')
    trainer.run()

    # Экспорт весов
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
        print(f'   Далее: node scripts/convert_weights_bin.js && git add src/engine/gpu_weights.bin')
