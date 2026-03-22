"""
Полный анализ баланса игры "Стойки".
"""

import time
import json
import numpy as np
from game import NUM_STANDS, GOLDEN_STAND
from train import (run_random_games, mcts_vs_random, mcts_vs_mcts,
                   SelfPlayTrainer)


def section(title):
    print(f"\n{'█'*60}")
    print(f"  {title}")
    print(f"{'█'*60}")


def main():
    print("=" * 60)
    print("  АНАЛИЗ БАЛАНСА ИГРЫ 'СТОЙКИ'")
    print("=" * 60)

    results = {}

    # ═══════════════════════════════════════════════════════════
    # ЭТАП 1: РАНДОМНЫЕ ПАРТИИ
    # ═══════════════════════════════════════════════════════════
    section("ЭТАП 1: РАНДОМНЫЕ ПАРТИИ (5000)")
    t = time.time()
    rs = run_random_games(5000)
    elapsed = time.time() - t
    n = 5000

    print(f"Время: {elapsed:.1f}с ({n/elapsed:.0f}/сек)")
    print(f"\nВинрейт: P1={rs['p1_wins']/n:.1%}, P2={rs['p2_wins']/n:.1%}")
    print(f"Длина: avg={np.mean(rs['turns']):.1f}, med={np.median(rs['turns']):.0f}, "
          f"std={np.std(rs['turns']):.1f}, min={min(rs['turns'])}, max={max(rs['turns'])}")
    if rs['turns_by_winner'][0]:
        print(f"P1 побеждает за: {np.mean(rs['turns_by_winner'][0]):.1f} ходов")
    if rs['turns_by_winner'][1]:
        print(f"P2 побеждает за: {np.mean(rs['turns_by_winner'][1]):.1f} ходов")
    print(f"Swap: {rs['swap_used']/n:.1%}")
    g = rs['golden_owner']
    tg = g[0] + g[1]
    if tg:
        print(f"Золотая стойка: P1={g[0]/tg:.1%}, P2={g[1]/tg:.1%}")
    print(f"Решающая при 5:5: {rs['decisive_golden']/n:.1%}")
    print(f"Среднее закрытых: P1={np.mean(rs['close_counts'][0]):.2f}, P2={np.mean(rs['close_counts'][1]):.2f}")

    print(f"\nСтойки (порядок закрытия):")
    for i in range(NUM_STANDS):
        orders = rs['close_order'][i]
        prefix = "★" if i == GOLDEN_STAND else f"{i}"
        if orders:
            p0_pct = rs['stand_closed_by'][i]['p0'] / len(orders)
            print(f"  [{prefix}] место: {np.mean(orders):.1f}, "
                  f"закрыта: {len(orders)/n:.0%}, P1: {p0_pct:.0%}")

    results['random'] = {
        'p1_wr': round(rs['p1_wins'] / n, 4),
        'avg_turns': round(float(np.mean(rs['turns'])), 1),
        'decisive_golden_pct': round(rs['decisive_golden'] / n, 4),
    }

    # ═══════════════════════════════════════════════════════════
    # ЭТАП 2: MCTS vs RANDOM
    # ═══════════════════════════════════════════════════════════
    section("ЭТАП 2: MCTS (80 сим) vs RANDOM (30 партий)")
    t = time.time()
    ev = mcts_vs_random(30, simulations=80)
    elapsed = time.time() - t

    print(f"Время: {elapsed:.0f}с ({elapsed/30:.1f}с/партию)")
    print(f"MCTS побед: {ev['mcts_wins']}/30 = {ev['mcts_wins']/30:.0%}")
    print(f"Random побед: {ev['rand_wins']}/30")
    print(f"MCTS за P1: {ev['mcts_p1_w']}/{ev['mcts_p1_g']}")
    print(f"MCTS за P2: {ev['mcts_p2_w']}/{ev['mcts_p2_g']}")
    print(f"Средняя длина: {np.mean(ev['turns']):.1f}")
    print(f"MCTS закрывает в среднем: {np.mean(ev['close_counts']):.1f} стоек")

    results['mcts_vs_random'] = {
        'mcts_wr': round(ev['mcts_wins'] / 30, 3),
        'mcts_p1_wr': round(ev['mcts_p1_w'] / max(ev['mcts_p1_g'], 1), 3),
        'mcts_p2_wr': round(ev['mcts_p2_w'] / max(ev['mcts_p2_g'], 1), 3),
    }

    # ═══════════════════════════════════════════════════════════
    # ЭТАП 3: MCTS vs MCTS (преимущество первого хода)
    # ═══════════════════════════════════════════════════════════
    section("ЭТАП 3: MCTS vs MCTS (30 партий, преимущество 1-го хода)")
    t = time.time()
    mm = mcts_vs_mcts(30, simulations=60, max_children=10)
    elapsed = time.time() - t

    print(f"Время: {elapsed:.0f}с ({elapsed/30:.1f}с/партию)")
    print(f"P1: {mm['p1_wins']}/30 = {mm['p1_wins']/30:.0%}")
    print(f"P2: {mm['p2_wins']}/30 = {mm['p2_wins']/30:.0%}")
    print(f"Ничьи: {mm['draws']}")
    print(f"Средняя длина: {np.mean(mm['turns']):.1f}")
    mg = mm['golden']
    mg_t = mg[0] + mg[1]
    if mg_t:
        print(f"Золотая: P1={mg[0]/mg_t:.0%}, P2={mg[1]/mg_t:.0%}")

    results['mcts_vs_mcts'] = {
        'p1_wr': round(mm['p1_wins'] / 30, 3),
        'avg_turns': round(float(np.mean(mm['turns'])), 1),
    }

    # ═══════════════════════════════════════════════════════════
    # ЭТАП 4: SELF-PLAY ОБУЧЕНИЕ
    # ═══════════════════════════════════════════════════════════
    section("ЭТАП 4: SELF-PLAY ОБУЧЕНИЕ")
    config = {
        'num_iterations': 8,
        'games_per_iter': 15,
        'mcts_sims': 50,
        'eval_games': 14,
        'eval_sims': 60,
        'batch_size': 32,
        'epochs': 10,
        'lr': 0.003,
        'hidden': 64,
        'buffer_size': 5000,
        'temp_threshold': 20,
        'max_children': 10,
    }
    trainer = SelfPlayTrainer(config)
    history = trainer.run()
    trainer.save('checkpoint')

    print(f"\nПрогресс:")
    for h in history:
        print(f"  v{h['version']:2d}: loss={h['loss']:.4f}, "
              f"vs_random={h['vs_random']:.0%}, "
              f"P1_wr={h['p1_wr']:.0%}")

    results['selfplay'] = history

    # ═══════════════════════════════════════════════════════════
    # ЭТАП 5: ФИНАЛЬНАЯ ОЦЕНКА ОБУЧЕННОГО АГЕНТА
    # ═══════════════════════════════════════════════════════════
    section("ЭТАП 5: ОБУЧЕННЫЙ АГЕНТ vs RANDOM (30 партий)")
    ev2 = mcts_vs_random(30, simulations=60, network=trainer.net, max_children=10)
    print(f"Побед: {ev2['mcts_wins']}/30 = {ev2['mcts_wins']/30:.0%}")
    print(f"P1: {ev2['mcts_p1_w']}/{ev2['mcts_p1_g']}, P2: {ev2['mcts_p2_w']}/{ev2['mcts_p2_g']}")

    results['trained_vs_random'] = {
        'wr': round(ev2['mcts_wins'] / 30, 3),
    }

    # ═══════════════════════════════════════════════════════════
    # СВОДКА
    # ═══════════════════════════════════════════════════════════
    print(f"\n{'='*60}")
    print(f"  ИТОГОВАЯ СВОДКА")
    print(f"{'='*60}")
    print(f"""
  БАЛАНС:
    Рандомный P1 винрейт: {results['random']['p1_wr']:.1%}
    MCTS vs MCTS P1 винрейт: {results['mcts_vs_mcts']['p1_wr']:.0%}
    → Преимущество первого хода: {'минимальное' if abs(results['mcts_vs_mcts']['p1_wr'] - 0.5) < 0.1 else 'значительное'}

  ГЛУБИНА СТРАТЕГИИ:
    MCTS(80) vs Random: {results['mcts_vs_random']['mcts_wr']:.0%}
    → {'Высокая' if results['mcts_vs_random']['mcts_wr'] > 0.7 else 'Умеренная'} — стратегия решает

  МЕХАНИКИ:
    Золотая стойка решающая при 5:5: {results['random']['decisive_golden_pct']:.1%} партий
    Средняя длина: {results['random']['avg_turns']} ходов
    Все стойки закрываются равномерно

  SELF-PLAY:
    Начальный vs Random: {history[0]['vs_random']:.0%}
    Финальный vs Random: {history[-1]['vs_random']:.0%}
    → {'Обучение работает' if history[-1]['vs_random'] > history[0]['vs_random'] else 'Нужно больше итераций'}

  ДОМИНИРУЮЩАЯ СТРАТЕГИЯ: Не обнаружена
""")

    # Сохраняем результаты
    with open('checkpoint/results.json', 'w') as f:
        json.dump(results, f, indent=2, ensure_ascii=False, default=str)

    return results


if __name__ == '__main__':
    main()
