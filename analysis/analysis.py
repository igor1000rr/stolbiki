"""
Расширенный анализ: варианты правил, heatmap, стратегии, value-кривые.
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import time
from collections import defaultdict

from game import (GameState, Action, apply_action, encode_state,
                  sample_random_action_fast, get_valid_transfers,
                  NUM_STANDS, GOLDEN_STAND, MAX_CHIPS, _apply_transfer)
from mcts import MCTSAgent, RandomAgent
from network import NumpyNet
from train import run_random_games, mcts_vs_mcts

CHARTS_DIR = 'charts'


# ═══════════════════════════════════════════════════════════════
# 1. ТЕСТИРОВАНИЕ ВАРИАНТОВ ПРАВИЛ
# ═══════════════════════════════════════════════════════════════

def test_stand_variants(stand_counts=[7, 8, 9, 10, 12], games_per=2000):
    """Тестирование с разным количеством стоек."""
    results = {}
    for n in stand_counts:
        t = time.time()
        stats = run_random_games(games_per, num_stands=n)
        p1_wr = stats['p1_wins'] / games_per
        avg_turns = np.mean(stats['turns'])
        decisive = stats['decisive_golden'] / games_per
        results[n] = {
            'p1_wr': p1_wr,
            'avg_turns': avg_turns,
            'decisive_golden': decisive,
            'std_turns': float(np.std(stats['turns'])),
        }
        print(f"  {n} стоек: P1={p1_wr:.1%}, ходов={avg_turns:.0f}, "
              f"золотая решает={decisive:.1%} ({time.time()-t:.0f}с)")
    return results


def test_golden_height(heights=[7, 9, 11, 13], games_per=3000):
    """Тестирование с разной высотой золотой стойки (MAX_CHIPS)."""
    import game as game_module
    original_max = game_module.MAX_CHIPS
    results = {}

    for h in heights:
        game_module.MAX_CHIPS = h
        t = time.time()
        stats = run_random_games(games_per)
        p1_wr = stats['p1_wins'] / games_per
        avg_turns = np.mean(stats['turns'])
        decisive = stats['decisive_golden'] / games_per
        results[h] = {
            'p1_wr': p1_wr,
            'avg_turns': avg_turns,
            'decisive_golden': decisive,
        }
        print(f"  Высота {h}: P1={p1_wr:.1%}, ходов={avg_turns:.0f}, "
              f"золотая={decisive:.1%} ({time.time()-t:.0f}с)")

    game_module.MAX_CHIPS = original_max  # Восстанавливаем
    return results


def plot_golden_height(results):
    """График зависимости от высоты стойки."""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 4))

    heights = sorted(results.keys())
    p1_wrs = [results[h]['p1_wr']*100 for h in heights]
    avg_turns = [results[h]['avg_turns'] for h in heights]

    ax1.plot(heights, p1_wrs, 'o-', color='#9b59b6', linewidth=2, markersize=8)
    ax1.axhline(y=50, color='gray', linestyle='--', alpha=0.5)
    ax1.set_xlabel('Максимум фишек на стойке')
    ax1.set_ylabel('Винрейт P1, %')
    ax1.set_title('Баланс vs высота стойки', fontweight='bold')
    ax1.set_ylim(40, 60)

    ax2.plot(heights, avg_turns, 's-', color='#e67e22', linewidth=2, markersize=8)
    ax2.set_xlabel('Максимум фишек на стойке')
    ax2.set_ylabel('Средняя длина, ходов')
    ax2.set_title('Длина партии vs высота стойки', fontweight='bold')

    plt.tight_layout()
    plt.savefig(f'{CHARTS_DIR}/golden_height.png', dpi=150)
    plt.close()


def test_stand_variants_mcts(stand_counts=[8, 10, 12], games_per=16, sims=50):
    """MCTS vs MCTS с разным количеством стоек."""
    results = {}
    for n in stand_counts:
        t = time.time()
        mm = mcts_vs_mcts(games_per, simulations=sims, max_children=10)
        total = mm['p1_wins'] + mm['p2_wins'] + mm['draws']
        p1_wr = mm['p1_wins'] / total if total > 0 else 0.5
        results[n] = {
            'p1_wr': p1_wr,
            'avg_turns': float(np.mean(mm['turns'])),
        }
        print(f"  {n} стоек (MCTS): P1={p1_wr:.0%}, ходов={np.mean(mm['turns']):.0f} ({time.time()-t:.0f}с)")
    return results


def plot_stand_variants(results):
    """График зависимости баланса от количества стоек."""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 4))

    stands = sorted(results.keys())
    p1_wrs = [results[n]['p1_wr'] * 100 for n in stands]
    avg_turns = [results[n]['avg_turns'] for n in stands]
    golden = [results[n]['decisive_golden'] * 100 for n in stands]

    ax1.plot(stands, p1_wrs, 'o-', color='#3498db', linewidth=2, markersize=8, label='Винрейт P1')
    ax1.axhline(y=50, color='gray', linestyle='--', alpha=0.5)
    ax1.set_xlabel('Количество стоек')
    ax1.set_ylabel('Винрейт P1, %')
    ax1.set_title('Баланс vs кол-во стоек', fontweight='bold')
    ax1.set_ylim(40, 60)
    ax1.legend()

    ax2.plot(stands, avg_turns, 's-', color='#e74c3c', linewidth=2, markersize=8, label='Средняя длина')
    ax2b = ax2.twinx()
    ax2b.plot(stands, golden, 'D-', color='#e67e22', linewidth=2, markersize=8, label='Золотая решает')
    ax2.set_xlabel('Количество стоек')
    ax2.set_ylabel('Ходов', color='#e74c3c')
    ax2b.set_ylabel('Золотая решает, %', color='#e67e22')
    ax2.set_title('Длина и золотая стойка', fontweight='bold')
    ax2.legend(loc='upper left')
    ax2b.legend(loc='upper right')

    plt.tight_layout()
    plt.savefig(f'{CHARTS_DIR}/stand_variants.png', dpi=150)
    plt.close()


# ═══════════════════════════════════════════════════════════════
# 2. HEATMAP: КУДА СТАВЯТ И ПЕРЕНОСЯТ
# ═══════════════════════════════════════════════════════════════

def collect_action_heatmap(num_games=2000):
    """Собирает статистику куда ставят/переносят, отдельно для победителей."""
    placement_heat = {0: np.zeros(NUM_STANDS), 1: np.zeros(NUM_STANDS)}
    transfer_src = {0: np.zeros(NUM_STANDS), 1: np.zeros(NUM_STANDS)}
    transfer_dst = {0: np.zeros(NUM_STANDS), 1: np.zeros(NUM_STANDS)}
    winner_placement = {'win': np.zeros(NUM_STANDS), 'lose': np.zeros(NUM_STANDS)}
    winner_transfer_dst = {'win': np.zeros(NUM_STANDS), 'lose': np.zeros(NUM_STANDS)}

    for _ in range(num_games):
        state = GameState()
        history = []  # (player, action)

        while not state.game_over:
            action = sample_random_action_fast(state)
            player = state.current_player
            history.append((player, action))

            if action.placement:
                for idx, count in action.placement.items():
                    placement_heat[player][idx] += count
            if action.transfer:
                transfer_src[player][action.transfer[0]] += 1
                transfer_dst[player][action.transfer[1]] += 1

            state = apply_action(state, action)
            if state.turn > 300:
                state.game_over = True
                state.winner = -1
                break

        # Распределяем по winner/loser
        if state.winner in (0, 1):
            for player, action in history:
                tag = 'win' if player == state.winner else 'lose'
                if action.placement:
                    for idx, count in action.placement.items():
                        winner_placement[tag][idx] += count
                if action.transfer:
                    winner_transfer_dst[tag][action.transfer[1]] += 1

    return {
        'placement': placement_heat,
        'transfer_src': transfer_src,
        'transfer_dst': transfer_dst,
        'winner_placement': winner_placement,
        'winner_transfer_dst': winner_transfer_dst,
    }


def plot_heatmaps(heatmap_data):
    """Графики heatmap."""
    stand_names = ['★' if i == 0 else str(i) for i in range(NUM_STANDS)]

    fig, axes = plt.subplots(2, 2, figsize=(11, 8))

    # 1. Установка P1 vs P2
    ax = axes[0, 0]
    x = np.arange(NUM_STANDS)
    w = 0.35
    p0 = heatmap_data['placement'][0]
    p1 = heatmap_data['placement'][1]
    ax.bar(x - w/2, p0, w, label='Игрок 1', color='#3498db')
    ax.bar(x + w/2, p1, w, label='Игрок 2', color='#e74c3c')
    ax.set_xticks(x)
    ax.set_xticklabels(stand_names)
    ax.set_title('Установка фишек по стойкам', fontweight='bold')
    ax.set_ylabel('Фишек')
    ax.legend()

    # 2. Цели переносов
    ax = axes[0, 1]
    t0 = heatmap_data['transfer_dst'][0]
    t1 = heatmap_data['transfer_dst'][1]
    ax.bar(x - w/2, t0, w, label='Игрок 1', color='#3498db')
    ax.bar(x + w/2, t1, w, label='Игрок 2', color='#e74c3c')
    ax.set_xticks(x)
    ax.set_xticklabels(stand_names)
    ax.set_title('Цели переносов по стойкам', fontweight='bold')
    ax.set_ylabel('Переносов')
    ax.legend()

    # 3. Установка: победители vs проигравшие
    ax = axes[1, 0]
    wp = heatmap_data['winner_placement']['win']
    lp = heatmap_data['winner_placement']['lose']
    # Нормализуем
    wp_n = wp / wp.sum() * 100 if wp.sum() > 0 else wp
    lp_n = lp / lp.sum() * 100 if lp.sum() > 0 else lp
    ax.bar(x - w/2, wp_n, w, label='Победители', color='#2ecc71')
    ax.bar(x + w/2, lp_n, w, label='Проигравшие', color='#e74c3c', alpha=0.7)
    ax.set_xticks(x)
    ax.set_xticklabels(stand_names)
    ax.set_title('Установка: победители vs проигравшие', fontweight='bold')
    ax.set_ylabel('Доля, %')
    ax.legend()

    # 4. Переносы: победители vs проигравшие
    ax = axes[1, 1]
    wt = heatmap_data['winner_transfer_dst']['win']
    lt = heatmap_data['winner_transfer_dst']['lose']
    wt_n = wt / wt.sum() * 100 if wt.sum() > 0 else wt
    lt_n = lt / lt.sum() * 100 if lt.sum() > 0 else lt
    ax.bar(x - w/2, wt_n, w, label='Победители', color='#2ecc71')
    ax.bar(x + w/2, lt_n, w, label='Проигравшие', color='#e74c3c', alpha=0.7)
    ax.set_xticks(x)
    ax.set_xticklabels(stand_names)
    ax.set_title('Цели переносов: победители vs проигравшие', fontweight='bold')
    ax.set_ylabel('Доля, %')
    ax.legend()

    plt.tight_layout()
    plt.savefig(f'{CHARTS_DIR}/heatmaps.png', dpi=150)
    plt.close()


# ═══════════════════════════════════════════════════════════════
# 3. VALUE ПО ХОДУ ПАРТИИ (где теряется контроль)
# ═══════════════════════════════════════════════════════════════

def collect_value_curves(network, num_games=50, mcts_sims=40):
    """Собирает кривые value по ходам партии."""
    agent = MCTSAgent(num_simulations=mcts_sims, network=network, temperature=0.1)

    curves = {'p1_win': [], 'p2_win': []}

    for g in range(num_games):
        state = GameState()
        values_p1 = []  # Value с точки зрения P1 по ходам

        while not state.game_over:
            val = network.predict_value(state)
            # val с точки зрения current_player
            if state.current_player == 0:
                values_p1.append(val)
            else:
                values_p1.append(-val)

            a, _ = agent.choose_action(state)
            state = apply_action(state, a)
            if state.turn > 150:
                state.game_over = True
                state.winner = -1
                break

        if state.winner == 0:
            curves['p1_win'].append(values_p1)
        elif state.winner == 1:
            curves['p2_win'].append(values_p1)

    return curves


def plot_value_curves(curves):
    """График value по ходу партии."""
    fig, ax = plt.subplots(figsize=(8, 4))

    # Усредняем кривые
    for label, games, color in [
        ('Победа P1', curves['p1_win'], '#3498db'),
        ('Победа P2', curves['p2_win'], '#e74c3c'),
    ]:
        if not games:
            continue
        # Выровняем длины
        max_len = max(len(g) for g in games)
        padded = []
        for g in games:
            padded.append(g + [g[-1]] * (max_len - len(g)))
        avg = np.mean(padded, axis=0)
        std = np.std(padded, axis=0)
        x = range(len(avg))
        ax.plot(x, avg, color=color, linewidth=2, label=label)
        ax.fill_between(x, avg - std, avg + std, color=color, alpha=0.15)

    ax.axhline(y=0, color='gray', linestyle='--', alpha=0.5)
    ax.set_xlabel('Номер хода')
    ax.set_ylabel('Оценка позиции (P1)')
    ax.set_title('Оценка позиции по ходу партии', fontweight='bold')
    ax.legend()
    plt.tight_layout()
    plt.savefig(f'{CHARTS_DIR}/value_curves.png', dpi=150)
    plt.close()


# ═══════════════════════════════════════════════════════════════
# 4. АНАЛИЗ СТРАТЕГИЙ MCTS
# ═══════════════════════════════════════════════════════════════

def analyze_mcts_strategies(num_games=30, sims=60):
    """Анализ: как MCTS играет (частота переносов, установок, закрытий по этапам)."""
    agent = MCTSAgent(num_simulations=sims, temperature=0.1)

    stats = {
        'transfer_rate_early': [],  # % ходов с переносом (ходы 0-15)
        'transfer_rate_mid': [],    # ходы 16-35
        'transfer_rate_late': [],   # ходы 36+
        'placement_per_turn': [],
        'closing_turn': [],  # На каком ходу закрывали стойки
        'first_close_turn': [],  # Первое закрытие
    }

    for g in range(num_games):
        state = GameState()
        transfers_early = 0
        turns_early = 0
        transfers_mid = 0
        turns_mid = 0
        transfers_late = 0
        turns_late = 0
        first_close = None

        while not state.game_over:
            a, _ = agent.choose_action(state)

            # Трекаем
            turn = state.turn
            has_transfer = a.transfer is not None
            placed = sum(a.placement.values()) if a.placement else 0
            stats['placement_per_turn'].append(placed)

            if turn < 16:
                turns_early += 1
                if has_transfer:
                    transfers_early += 1
            elif turn < 36:
                turns_mid += 1
                if has_transfer:
                    transfers_mid += 1
            else:
                turns_late += 1
                if has_transfer:
                    transfers_late += 1

            old_closed = set(state.closed.keys())
            state = apply_action(state, a)

            for idx in set(state.closed.keys()) - old_closed:
                stats['closing_turn'].append(turn)
                if first_close is None:
                    first_close = turn

            if state.turn > 150:
                break

        if turns_early > 0:
            stats['transfer_rate_early'].append(transfers_early / turns_early)
        if turns_mid > 0:
            stats['transfer_rate_mid'].append(transfers_mid / turns_mid)
        if turns_late > 0:
            stats['transfer_rate_late'].append(transfers_late / turns_late)
        if first_close is not None:
            stats['first_close_turn'].append(first_close)

    return stats


def plot_strategies(strats):
    """График стратегий по этапам."""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 4))

    # Частота переносов по этапам
    labels = ['Ранний\n(0-15)', 'Средний\n(16-35)', 'Поздний\n(36+)']
    rates = [
        np.mean(strats['transfer_rate_early']) * 100 if strats['transfer_rate_early'] else 0,
        np.mean(strats['transfer_rate_mid']) * 100 if strats['transfer_rate_mid'] else 0,
        np.mean(strats['transfer_rate_late']) * 100 if strats['transfer_rate_late'] else 0,
    ]
    ax1.bar(labels, rates, color=['#3498db', '#2ecc71', '#e74c3c'], width=0.5, edgecolor='white')
    ax1.set_ylabel('Переносов, %')
    ax1.set_title('Частота переносов по этапам (MCTS)', fontweight='bold')

    # Распределение закрытий по ходам
    if strats['closing_turn']:
        ax2.hist(strats['closing_turn'], bins=15, color='#e67e22', edgecolor='white', alpha=0.8)
        ax2.axvline(x=np.mean(strats['closing_turn']), color='#e74c3c', linestyle='--',
                    label=f'Среднее: {np.mean(strats["closing_turn"]):.0f}')
        ax2.set_xlabel('Ход')
        ax2.set_ylabel('Закрытий')
        ax2.set_title('Когда закрываются стойки (MCTS)', fontweight='bold')
        ax2.legend()

    plt.tight_layout()
    plt.savefig(f'{CHARTS_DIR}/strategies.png', dpi=150)
    plt.close()


# ═══════════════════════════════════════════════════════════════
# ЗАПУСК ВСЕГО
# ═══════════════════════════════════════════════════════════════

def run_extended_analysis(network=None):
    """Запускает весь расширенный анализ."""
    results = {}

    # 1. Варианты правил (рандом)
    print("\n  Варианты правил (рандом):")
    results['stand_variants'] = test_stand_variants([7, 8, 9, 10, 12], games_per=2000)
    plot_stand_variants(results['stand_variants'])

    # 2. Heatmap
    print("\n  Heatmap (2000 партий):")
    t = time.time()
    heatmap = collect_action_heatmap(2000)
    plot_heatmaps(heatmap)
    print(f"    Готово ({time.time()-t:.0f}с)")
    results['heatmap'] = 'generated'

    # 3. Стратегии MCTS
    print("\n  Стратегии MCTS (20 партий):")
    t = time.time()
    strats = analyze_mcts_strategies(20, sims=50)
    plot_strategies(strats)
    print(f"    Готово ({time.time()-t:.0f}с)")
    results['strategies'] = {
        'transfer_early': round(np.mean(strats['transfer_rate_early'])*100, 1) if strats['transfer_rate_early'] else 0,
        'transfer_mid': round(np.mean(strats['transfer_rate_mid'])*100, 1) if strats['transfer_rate_mid'] else 0,
        'transfer_late': round(np.mean(strats['transfer_rate_late'])*100, 1) if strats['transfer_rate_late'] else 0,
        'avg_first_close': round(np.mean(strats['first_close_turn']), 1) if strats['first_close_turn'] else 0,
        'avg_placement': round(np.mean(strats['placement_per_turn']), 2) if strats['placement_per_turn'] else 0,
    }

    # 4. Value curves (если есть сеть)
    if network:
        print("\n  Value-кривые (30 партий):")
        t = time.time()
        curves = collect_value_curves(network, 30, mcts_sims=30)
        plot_value_curves(curves)
        print(f"    Готово ({time.time()-t:.0f}с)")
        results['value_curves'] = 'generated'

    return results


if __name__ == '__main__':
    print("Расширенный анализ...")
    run_extended_analysis()
    print("Готово!")


# ═══════════════════════════════════════════════════════════════
# 5. КОНТРОЛЬ НАД СТОЙКАМИ (время сверху)
# ═══════════════════════════════════════════════════════════════

def collect_control_data(num_games=5000):
    """Сколько ходов каждый игрок контролирует (сверху) каждую стойку."""
    from game import GameState, apply_action, sample_random_action_fast, NUM_STANDS

    # control_turns[player][stand] = суммарное кол-во ходов сверху
    control_turns = {0: np.zeros(NUM_STANDS), 1: np.zeros(NUM_STANDS)}
    total_turns_all = 0

    # Корреляция: кто контролировал стойку дольше → кто её закрыл
    control_winner = {i: {'controller_wins': 0, 'total': 0} for i in range(NUM_STANDS)}

    # Эндгейм: контроль в последних 10 ходах
    endgame_control_winner = np.zeros(NUM_STANDS)  # % что контролёр в конце = победитель
    endgame_total = np.zeros(NUM_STANDS)

    for _ in range(num_games):
        state = GameState()
        # Трекаем контроль по ходам
        stand_control = {i: {0: 0, 1: 0} for i in range(NUM_STANDS)}
        history_control = []  # [(turn, {stand: top_player}), ...]

        while not state.game_over:
            # Записываем кто сверху
            snap = {}
            for i in state.open_stands():
                top_c, top_s = state.top_group(i)
                if top_c in (0, 1):
                    stand_control[i][top_c] += 1
                    control_turns[top_c][i] += 1
                    snap[i] = top_c
            history_control.append(snap)
            total_turns_all += 1

            action = sample_random_action_fast(state)
            state = apply_action(state, action)
            if state.turn > 300:
                state.game_over = True
                state.winner = -1
                break

        if state.winner not in (0, 1):
            continue

        # Кто контролировал стойку дольше → закрыл её?
        for i in range(NUM_STANDS):
            if i in state.closed:
                dominant = 0 if stand_control[i][0] >= stand_control[i][1] else 1
                control_winner[i]['total'] += 1
                if dominant == state.closed[i]:
                    control_winner[i]['controller_wins'] += 1

        # Эндгейм контроль (последние 10 ходов)
        last_snaps = history_control[-10:] if len(history_control) >= 10 else history_control
        for i in range(NUM_STANDS):
            eg_control = {0: 0, 1: 0}
            for snap in last_snaps:
                if i in snap:
                    eg_control[snap[i]] += 1
            dominant_eg = 0 if eg_control[0] >= eg_control[1] else 1
            if i in state.closed:
                endgame_total[i] += 1
                if dominant_eg == state.closed[i]:
                    endgame_control_winner[i] += 1

    return {
        'control_turns': control_turns,
        'total_turns': total_turns_all,
        'control_winner': control_winner,
        'endgame_control_winner': endgame_control_winner,
        'endgame_total': endgame_total,
    }


def plot_control(control_data):
    """Графики контроля над стойками."""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 4))
    stand_names = ['★' if i == 0 else str(i) for i in range(NUM_STANDS)]
    x = np.arange(NUM_STANDS)
    w = 0.35

    # 1. Время контроля P1 vs P2
    c0 = control_data['control_turns'][0]
    c1 = control_data['control_turns'][1]
    total = c0 + c1
    c0_pct = np.where(total > 0, c0 / total * 100, 50)
    c1_pct = np.where(total > 0, c1 / total * 100, 50)

    ax1.bar(x - w/2, c0_pct, w, label='Игрок 1', color='#3498db')
    ax1.bar(x + w/2, c1_pct, w, label='Игрок 2', color='#e74c3c')
    ax1.axhline(y=50, color='gray', linestyle='--', alpha=0.5)
    ax1.set_xticks(x)
    ax1.set_xticklabels(stand_names)
    ax1.set_ylabel('Контроль, %')
    ax1.set_title('Время контроля (фишка сверху)', fontweight='bold')
    ax1.set_ylim(40, 60)
    ax1.legend()

    # 2. Контроллёр = закрыл стойку?
    rates = []
    for i in range(NUM_STANDS):
        cw = control_data['control_winner'][i]
        if cw['total'] > 0:
            rates.append(cw['controller_wins'] / cw['total'] * 100)
        else:
            rates.append(50)

    colors = ['#e67e22' if i == 0 else '#2ecc71' for i in range(NUM_STANDS)]
    ax2.bar(x, rates, color=colors, edgecolor='white', width=0.6)
    ax2.axhline(y=50, color='gray', linestyle='--', alpha=0.5, label='50% (случайность)')
    ax2.set_xticks(x)
    ax2.set_xticklabels(stand_names)
    ax2.set_ylabel('%')
    ax2.set_title('Контроллёр закрывает стойку', fontweight='bold')
    ax2.set_ylim(40, 70)
    ax2.legend()

    plt.tight_layout()
    plt.savefig(f'{CHARTS_DIR}/control.png', dpi=150)
    plt.close()


# ═══════════════════════════════════════════════════════════════
# 6. КРИТИЧЕСКИЕ СТОЙКИ ДЛЯ ПОБЕДЫ
# ═══════════════════════════════════════════════════════════════

def collect_critical_stands(num_games=5000):
    """Какие стойки сильнее всего коррелируют с победой."""
    from game import GameState, apply_action, sample_random_action_fast, NUM_STANDS

    # Для каждой стойки: если P0 закрыл → P0 побеждает с вероятностью X
    stand_win_corr = {i: {'p0_closed_p0_wins': 0, 'p0_closed': 0,
                          'p1_closed_p1_wins': 0, 'p1_closed': 0} for i in range(NUM_STANDS)}

    for _ in range(num_games):
        state = GameState()
        while not state.game_over:
            action = sample_random_action_fast(state)
            state = apply_action(state, action)
            if state.turn > 300:
                state.game_over = True
                state.winner = -1
                break

        if state.winner not in (0, 1):
            continue

        for i in range(NUM_STANDS):
            if i in state.closed:
                owner = state.closed[i]
                if owner == 0:
                    stand_win_corr[i]['p0_closed'] += 1
                    if state.winner == 0:
                        stand_win_corr[i]['p0_closed_p0_wins'] += 1
                else:
                    stand_win_corr[i]['p1_closed'] += 1
                    if state.winner == 1:
                        stand_win_corr[i]['p1_closed_p1_wins'] += 1

    # Вычисляем корреляцию: если закрыл стойку → шанс победы
    results = {}
    for i in range(NUM_STANDS):
        sc = stand_win_corr[i]
        p0_wr = sc['p0_closed_p0_wins'] / sc['p0_closed'] if sc['p0_closed'] > 0 else 0.5
        p1_wr = sc['p1_closed_p1_wins'] / sc['p1_closed'] if sc['p1_closed'] > 0 else 0.5
        avg_wr = (p0_wr + p1_wr) / 2
        results[i] = {'avg_win_rate_if_closed': avg_wr, 'p0_wr': p0_wr, 'p1_wr': p1_wr}

    return results


def plot_critical_stands(critical):
    """График: закрытие стойки → шанс победы."""
    fig, ax = plt.subplots(figsize=(7, 4))
    stand_names = ['★' if i == 0 else str(i) for i in range(NUM_STANDS)]
    x = np.arange(NUM_STANDS)

    rates = [critical[i]['avg_win_rate_if_closed'] * 100 for i in range(NUM_STANDS)]
    colors = ['#e67e22' if i == 0 else '#3498db' for i in range(NUM_STANDS)]

    bars = ax.bar(x, rates, color=colors, edgecolor='white', width=0.6)
    ax.axhline(y=50, color='gray', linestyle='--', alpha=0.5, label='50% (не влияет)')
    ax.set_xticks(x)
    ax.set_xticklabels(stand_names)
    ax.set_ylabel('Шанс победы, %')
    ax.set_title('Закрытие стойки → шанс победы', fontweight='bold')
    ax.set_ylim(45, 70)
    for bar, val in zip(bars, rates):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.5,
                f'{val:.0f}%', ha='center', fontsize=9)
    ax.legend()

    plt.tight_layout()
    plt.savefig(f'{CHARTS_DIR}/critical_stands.png', dpi=150)
    plt.close()


# ═══════════════════════════════════════════════════════════════
# 7. ЭНДГЕЙМ-АНАЛИЗ
# ═══════════════════════════════════════════════════════════════

def collect_endgame_data(num_games=5000):
    """Анализ последних 15 ходов: где теряется контроль, что решает."""
    from game import GameState, apply_action, sample_random_action_fast, NUM_STANDS

    # На каком ходу (от конца) чаще закрываются последние стойки
    closing_from_end = []
    # Последняя закрытая стойка → её владелец = победитель?
    last_stand_wins = 0
    last_stand_total = 0
    # Разрыв в очках за 10 ходов до конца
    lead_10_before_end = {'leader_wins': 0, 'total': 0, 'tied': 0}

    for _ in range(num_games):
        state = GameState()
        close_turns = {}  # {stand_idx: turn_when_closed}
        score_history = []

        while not state.game_over:
            score_history.append((state.count_closed(0), state.count_closed(1)))
            old_closed = set(state.closed.keys())
            action = sample_random_action_fast(state)
            state = apply_action(state, action)
            for idx in set(state.closed.keys()) - old_closed:
                close_turns[idx] = state.turn
            if state.turn > 300:
                state.game_over = True
                state.winner = -1
                break

        if state.winner not in (0, 1):
            continue

        total_turns = state.turn

        # Когда закрылись последние стойки (от конца)
        for idx, turn in close_turns.items():
            closing_from_end.append(total_turns - turn)

        # Последняя закрытая стойка → победитель?
        if close_turns:
            last_idx = max(close_turns, key=close_turns.get)
            last_stand_total += 1
            if state.closed.get(last_idx) == state.winner:
                last_stand_wins += 1

        # Лидер за 10 ходов до конца
        idx_10 = max(0, len(score_history) - 10)
        if idx_10 < len(score_history):
            s0, s1 = score_history[idx_10]
            if s0 == s1:
                lead_10_before_end['tied'] += 1
                lead_10_before_end['total'] += 1
            else:
                leader = 0 if s0 > s1 else 1
                lead_10_before_end['total'] += 1
                if leader == state.winner:
                    lead_10_before_end['leader_wins'] += 1

    return {
        'closing_from_end': closing_from_end,
        'last_stand_wins': last_stand_wins,
        'last_stand_total': last_stand_total,
        'lead_10_before_end': lead_10_before_end,
    }


def plot_endgame(endgame):
    """Графики эндгейма."""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 4))

    # 1. Когда закрываются стойки (от конца)
    cfe = endgame['closing_from_end']
    ax1.hist(cfe, bins=20, color='#e74c3c', edgecolor='white', alpha=0.8)
    ax1.set_xlabel('Ходов до конца')
    ax1.set_ylabel('Закрытий')
    ax1.set_title('Когда закрываются стойки (от конца)', fontweight='bold')
    if cfe:
        ax1.axvline(x=np.mean(cfe), color='#3498db', linestyle='--',
                    label=f'Среднее: {np.mean(cfe):.1f}')
        ax1.legend()

    # 2. Лидер за 10 ходов до конца → побеждает?
    lead = endgame['lead_10_before_end']
    total = lead['total']
    if total > 0:
        lw = lead['leader_wins'] / total * 100
        tied = lead['tied'] / total * 100
        comeback = (total - lead['leader_wins'] - lead['tied']) / total * 100
        ax2.bar(['Лидер\nпобеждает', 'Равный\nсчёт', 'Камбэк'],
                [lw, tied, comeback],
                color=['#2ecc71', '#f39c12', '#e74c3c'], edgecolor='white', width=0.5)
        ax2.set_ylabel('%')
        ax2.set_title('Кто лидирует за 10 ходов до конца?', fontweight='bold')
        for i, v in enumerate([lw, tied, comeback]):
            ax2.text(i, v + 1, f'{v:.0f}%', ha='center', fontweight='bold')

    plt.tight_layout()
    plt.savefig(f'{CHARTS_DIR}/endgame.png', dpi=150)
    plt.close()


# ═══════════════════════════════════════════════════════════════
# 8. ЭНТРОПИЯ ХОДОВ
# ═══════════════════════════════════════════════════════════════

def collect_entropy_data(num_games=20, sims=60):
    """Энтропия policy MCTS по ходу партии."""
    from game import GameState, apply_action
    from mcts import MCTSAgent
    import math

    agent = MCTSAgent(num_simulations=sims, temperature=1.0)
    entropy_by_turn = defaultdict(list)

    for _ in range(num_games):
        state = GameState()
        while not state.game_over:
            action, probs = agent.choose_action(state)
            # Энтропия
            vals = [p for p in probs.values() if p > 0]
            if vals:
                entropy = -sum(p * math.log2(p) for p in vals)
                entropy_by_turn[state.turn].append(entropy)
            state = apply_action(state, action)
            if state.turn > 100:
                break

    return dict(entropy_by_turn)


def plot_entropy(entropy_data):
    """График энтропии по ходам."""
    fig, ax = plt.subplots(figsize=(7, 4))

    turns = sorted(entropy_data.keys())
    avgs = [np.mean(entropy_data[t]) for t in turns]
    stds = [np.std(entropy_data[t]) for t in turns]

    ax.plot(turns, avgs, 'o-', color='#9b59b6', linewidth=2, markersize=3)
    ax.fill_between(turns, np.array(avgs) - np.array(stds),
                    np.array(avgs) + np.array(stds), color='#9b59b6', alpha=0.15)
    ax.set_xlabel('Номер хода')
    ax.set_ylabel('Энтропия (бит)')
    ax.set_title('Энтропия ходов MCTS по ходу партии', fontweight='bold')
    ax.axhline(y=0, color='gray', linestyle='--', alpha=0.3)

    plt.tight_layout()
    plt.savefig(f'{CHARTS_DIR}/entropy.png', dpi=150)
    plt.close()
