"""
Self-play пайплайн + статистика + сравнение версий.
"""

import random
import time
import json
import os
import numpy as np
from collections import deque
from game import (GameState, Action, apply_action, encode_state,
                  sample_random_action_fast, NUM_STANDS, GOLDEN_STAND, MAX_CHIPS)
from mcts import MCTSAgent, RandomAgent
from network import NumpyNet


# ─── Рандомные партии ─────────────────────────────────────────
def run_random_games(num_games=5000, num_stands=NUM_STANDS):
    """Детальная статистика рандомных партий."""
    agent = RandomAgent()
    stats = {
        'p1_wins': 0, 'p2_wins': 0, 'draws': 0,
        'turns': [],
        'golden_owner': {0: 0, 1: 0},
        'close_order': [[] for _ in range(num_stands)],
        'close_counts': {0: [], 1: []},
        'swap_used': 0,
        'decisive_golden': 0,
        'turns_by_winner': {0: [], 1: []},
        'stand_closed_by': [{'p0': 0, 'p1': 0} for _ in range(num_stands)],
    }

    for _ in range(num_games):
        state = GameState(num_stands=num_stands)
        close_idx = 0
        swap = False

        while not state.game_over:
            action = sample_random_action_fast(state)
            if action.swap:
                swap = True
            old = set(state.closed.keys())
            state = apply_action(state, action)
            for idx in set(state.closed.keys()) - old:
                stats['close_order'][idx].append(close_idx)
                stats['stand_closed_by'][idx][f'p{state.closed[idx]}'] += 1
                close_idx += 1
            if state.turn > 300:
                state.game_over = True
                state.winner = -1
                break

        stats['turns'].append(state.turn)
        if swap:
            stats['swap_used'] += 1
        if state.winner == 0:
            stats['p1_wins'] += 1
            stats['turns_by_winner'][0].append(state.turn)
        elif state.winner == 1:
            stats['p2_wins'] += 1
            stats['turns_by_winner'][1].append(state.turn)
        else:
            stats['draws'] += 1

        if GOLDEN_STAND in state.closed:
            stats['golden_owner'][state.closed[GOLDEN_STAND]] += 1

        c0, c1 = state.count_closed(0), state.count_closed(1)
        if c0 == c1 and c0 == num_stands // 2 and num_stands % 2 == 0:
            stats['decisive_golden'] += 1
        stats['close_counts'][0].append(c0)
        stats['close_counts'][1].append(c1)

    return stats


# ─── MCTS vs Random ──────────────────────────────────────────
def mcts_vs_random(num_games=30, simulations=80, network=None, max_children=12):
    mcts = MCTSAgent(num_simulations=simulations, network=network,
                     temperature=0.05, max_children=max_children)
    rand_a = RandomAgent()

    results = {
        'mcts_wins': 0, 'rand_wins': 0, 'draws': 0,
        'p1_wins': 0, 'turns': [],
        'mcts_p1_w': 0, 'mcts_p1_g': 0,
        'mcts_p2_w': 0, 'mcts_p2_g': 0,
        'golden_control': {0: 0, 1: 0},
        'close_counts': [],
    }

    for g in range(num_games):
        mcts_p0 = (g % 2 == 0)
        state = GameState()
        if mcts_p0:
            results['mcts_p1_g'] += 1
        else:
            results['mcts_p2_g'] += 1

        while not state.game_over:
            if (state.current_player == 0) == mcts_p0:
                a, _ = mcts.choose_action(state)
            else:
                a, _ = rand_a.choose_action(state)
            state = apply_action(state, a)
            if state.turn > 200:
                state.game_over = True
                state.winner = -1
                break

        results['turns'].append(state.turn)
        if state.winner == 0:
            results['p1_wins'] += 1
        if GOLDEN_STAND in state.closed:
            results['golden_control'][state.closed[GOLDEN_STAND]] += 1

        mcts_player = 0 if mcts_p0 else 1
        results['close_counts'].append(state.count_closed(mcts_player))

        if state.winner == -1:
            results['draws'] += 1
        elif (state.winner == 0) == mcts_p0:
            results['mcts_wins'] += 1
            if mcts_p0:
                results['mcts_p1_w'] += 1
            else:
                results['mcts_p2_w'] += 1
        else:
            results['rand_wins'] += 1

    return results


# ─── MCTS vs MCTS (оценка первого хода) ─────────────────────
def mcts_vs_mcts(num_games=30, simulations=60, max_children=10):
    """MCTS vs MCTS — чистая оценка преимущества первого хода."""
    agent = MCTSAgent(num_simulations=simulations, temperature=0.1,
                      max_children=max_children)

    p1_wins = 0
    p2_wins = 0
    draws = 0
    turns = []
    golden = {0: 0, 1: 0}

    for g in range(num_games):
        state = GameState()
        while not state.game_over:
            a, _ = agent.choose_action(state)
            state = apply_action(state, a)
            if state.turn > 200:
                state.game_over = True
                state.winner = -1
                break

        turns.append(state.turn)
        if state.winner == 0:
            p1_wins += 1
        elif state.winner == 1:
            p2_wins += 1
        else:
            draws += 1

        if GOLDEN_STAND in state.closed:
            golden[state.closed[GOLDEN_STAND]] += 1

    return {
        'p1_wins': p1_wins, 'p2_wins': p2_wins, 'draws': draws,
        'turns': turns, 'golden': golden,
    }


# ─── Self-play тренер ─────────────────────────────────────────
class SelfPlayTrainer:
    def __init__(self, config=None):
        self.config = config or {
            'num_iterations': 10,
            'games_per_iter': 20,
            'mcts_sims': 60,
            'eval_games': 16,
            'eval_sims': 60,
            'batch_size': 64,
            'epochs': 10,
            'lr': 0.003,
            'hidden': 64,
            'buffer_size': 5000,
            'temp_threshold': 20,
            'max_children': 12,
        }
        self.net = NumpyNet(hidden=self.config['hidden'])
        self.buffer = deque(maxlen=self.config['buffer_size'])
        self.history = []
        self.version = 0

    def run(self):
        cfg = self.config
        print(f"\nSelf-play: {cfg['num_iterations']} iter, "
              f"{cfg['games_per_iter']} games/iter, "
              f"{cfg['mcts_sims']} sims")

        for it in range(cfg['num_iterations']):
            t0 = time.time()
            print(f"\n--- Итерация {it+1}/{cfg['num_iterations']} ---")

            # Self-play
            data = self._self_play()
            self.buffer.extend(data)
            print(f"  Self-play: +{len(data)} (буфер: {len(self.buffer)})")

            # Обучение
            loss = self._train()
            self.version += 1
            print(f"  Обучение v{self.version}: loss={loss:.4f}")

            # Оценка
            ev = mcts_vs_random(cfg['eval_games'], cfg['eval_sims'],
                                network=self.net, max_children=cfg['max_children'])
            wr = ev['mcts_wins'] / max(cfg['eval_games'], 1)
            print(f"  vs Random: {wr:.0%} "
                  f"(P1:{ev['mcts_p1_w']}/{ev['mcts_p1_g']}, "
                  f"P2:{ev['mcts_p2_w']}/{ev['mcts_p2_g']})")

            elapsed = time.time() - t0
            self.history.append({
                'iter': it + 1, 'version': self.version,
                'loss': round(loss, 5), 'vs_random': round(wr, 3),
                'p1_wr': round(ev['p1_wins'] / max(cfg['eval_games'], 1), 3),
                'buffer': len(self.buffer), 'time': round(elapsed, 1),
            })
            print(f"  Время: {elapsed:.0f}с")

        return self.history

    def _self_play(self):
        cfg = self.config
        agent = MCTSAgent(
            num_simulations=cfg['mcts_sims'],
            network=self.net if self.version > 0 else None,
            temperature=1.0,
            max_children=cfg['max_children'],
        )
        all_data = []

        for _ in range(cfg['games_per_iter']):
            state = GameState()
            game_states = []
            while not state.game_over:
                if state.turn >= cfg['temp_threshold']:
                    agent.temperature = 0.1
                else:
                    agent.temperature = 1.0
                a, _ = agent.choose_action(state)
                game_states.append((encode_state(state), state.current_player))
                state = apply_action(state, a)
                if state.turn > 200:
                    state.game_over = True
                    state.winner = -1
                    break

            for sv, player in game_states:
                if state.winner == -1:
                    val = 0.0
                elif state.winner == player:
                    val = 1.0
                else:
                    val = -1.0
                all_data.append((sv, val))

        return all_data

    def _train(self):
        cfg = self.config
        if len(self.buffer) < cfg['batch_size']:
            return 0.0
        total_loss = 0.0
        for _ in range(cfg['epochs']):
            batch = random.sample(list(self.buffer),
                                  min(cfg['batch_size'], len(self.buffer)))
            states = [b[0] for b in batch]
            values = [b[1] for b in batch]
            loss = self.net.train_batch(states, values, lr=cfg['lr'])
            total_loss += loss
        return total_loss / cfg['epochs']

    def save(self, path='checkpoint'):
        os.makedirs(path, exist_ok=True)
        self.net.save(f'{path}/net_v{self.version}.npz')
        with open(f'{path}/history.json', 'w') as f:
            json.dump(self.history, f, indent=2, ensure_ascii=False)
