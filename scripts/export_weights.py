"""
Экспорт весов PyTorch → gpu_weights.json для браузерного движка Snatch Highrise

Архитектура сети (должна совпадать):
  - Input: 107 features
  - proj: Linear(107→256) + LayerNorm(256) + ReLU
  - 6 × ResBlock: Linear(256→256) + LN + ReLU + Linear(256→256) + LN + skip
  - value: Linear(256→64) + ReLU + Linear(64→1) + Tanh
  - Total: 840,321 параметров

Использование:
  python export_weights.py path/to/model.pt
  
Результат: gpu_weights.json (6.8MB) — положить в src/engine/gpu_weights.json
"""

import json
import sys
import torch

def export_weights(model_path, output_path='gpu_weights.json'):
    # Загружаем чекпоинт
    checkpoint = torch.load(model_path, map_location='cpu')
    
    # state_dict может быть напрямую или внутри 'model' / 'state_dict' / 'net'
    if isinstance(checkpoint, dict):
        if 'model' in checkpoint:
            state = checkpoint['model']
        elif 'state_dict' in checkpoint:
            state = checkpoint['state_dict']
        elif 'net' in checkpoint:
            state = checkpoint['net']
        else:
            # Пробуем использовать как есть
            state = checkpoint
    else:
        state = checkpoint.state_dict()
    
    # Ожидаемые ключи
    expected_keys = ['proj.0.weight', 'proj.0.bias', 'proj.1.weight', 'proj.1.bias']
    for b in range(6):
        for layer in ['fc1', 'fc2']:
            expected_keys.append(f'blocks.{b}.{layer}.weight')
            expected_keys.append(f'blocks.{b}.{layer}.bias')
        for ln in ['ln1', 'ln2']:
            expected_keys.append(f'blocks.{b}.{ln}.weight')
            expected_keys.append(f'blocks.{b}.{ln}.bias')
    expected_keys.extend(['value.0.weight', 'value.0.bias', 'value.2.weight', 'value.2.bias'])
    
    # Конвертируем в плоские массивы
    weights = {}
    missing = []
    
    for key in expected_keys:
        if key in state:
            tensor = state[key]
            weights[key] = tensor.detach().cpu().flatten().tolist()
        else:
            missing.append(key)
    
    if missing:
        print(f'⚠ Отсутствующие ключи ({len(missing)}):')
        for k in missing:
            print(f'  - {k}')
        print()
        print('Доступные ключи в чекпоинте:')
        for k in sorted(state.keys()):
            print(f'  {k}: {state[k].shape}')
        sys.exit(1)
    
    # Проверяем размеры
    total_params = sum(len(v) for v in weights.values())
    print(f'✓ Ключей: {len(weights)}')
    print(f'✓ Параметров: {total_params:,}')
    print(f'✓ proj input: {len(weights["proj.0.weight"]) // 256} → 256')
    print(f'✓ ResBlocks: 6')
    print(f'✓ Value head: 256 → 64 → 1')
    
    # Сохраняем
    with open(output_path, 'w') as f:
        json.dump(weights, f)
    
    import os
    size_mb = os.path.getsize(output_path) / 1024 / 1024
    print(f'✓ Сохранено: {output_path} ({size_mb:.1f} MB)')
    print()
    print('Далее:')
    print(f'  cp {output_path} src/engine/gpu_weights.json')
    print('  git add src/engine/gpu_weights.json')
    print('  git commit -m "AI v4: new GPU weights"')
    print('  git push')

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Использование: python export_weights.py <model.pt> [output.json]')
        print()
        print('Примеры:')
        print('  python export_weights.py best_model.pt')
        print('  python export_weights.py checkpoint_2000.pt gpu_weights.json')
        sys.exit(1)
    
    model_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else 'gpu_weights.json'
    export_weights(model_path, output_path)
