"""
Экспорт результатов GPU-обучения в dashboard.json
Запуск: python export_results.py
"""

import json
import os
import sys

def main():
    ckpt_dir = 'gpu_checkpoint'

    # Загрузить историю
    hist_path = os.path.join(ckpt_dir, 'history.json')
    if not os.path.exists(hist_path):
        print(f'Файл {hist_path} не найден')
        return

    with open(hist_path) as f:
        gpu_history = json.load(f)

    # Загрузить предыдущую историю (CPU)
    cpu_hist_path = os.path.join('..', 'analysis', 'trainer_history.json')
    prev_path = os.path.join('..', 'src', 'data', 'dashboard.json')

    with open(prev_path) as f:
        dash = json.load(f)

    # Объединяем CPU + GPU
    cpu_versions = dash['selfplay']['versions']
    cpu_losses = dash['selfplay']['losses']
    cpu_wr = dash['selfplay']['vs_random']

    all_versions = cpu_versions + [h['version'] + max(cpu_versions) for h in gpu_history]
    all_losses = cpu_losses + [h['loss'] for h in gpu_history]
    all_wr = cpu_wr + [h['vs_random'] * 100 for h in gpu_history]

    dash['selfplay'] = {
        'versions': all_versions,
        'losses': all_losses,
        'vs_random': all_wr,
        'trained_wr': gpu_history[-1]['vs_random'] if gpu_history else dash['selfplay']['trained_wr'],
    }

    # Сохраняем
    out_path = os.path.join('..', 'src', 'data', 'dashboard.json')
    with open(out_path, 'w') as f:
        json.dump(dash, f, separators=(',', ':'))

    print(f'Экспортировано: {len(gpu_history)} GPU итераций')
    print(f'Всего на графике: {len(all_versions)} точек')
    print(f'Последний vs_random: {gpu_history[-1]["vs_random"]:.0%}')
    print(f'Файл: {out_path}')
    print()
    print('Теперь запусти:')
    print('  cd .. && npm run build')
    print('  git add -A && git commit -m "GPU обучение" && git push')

if __name__ == '__main__':
    main()
