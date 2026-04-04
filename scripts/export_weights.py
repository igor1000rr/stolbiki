"""
Экспорт весов PyTorch → gpu_weights.json для браузерного движка Snatch Highrise v7

Архитектура сети v7 (AlphaZero Policy+Value):
  - Input: 107 features
  - proj: Linear(107→256) + LayerNorm(256) + ReLU
  - 6 × ResBlock: Linear(256→256) + LN + ReLU + Linear(256→256) + LN + skip
  - Value head: Linear(256→64) + ReLU + Linear(64→1) + Tanh
  - Policy head:
    - policy_ctx: Linear(256→64) + ReLU  (state → context)
    - action_enc: Linear(35→64)          (action features → embedding)
    - logit = dot(policy_ctx, action_enc)
  - Total: ~859K параметров

Использование:
  python export_weights_v7.py path/to/model.pt [output.json]

Совместимость: если в чекпоинте нет policy ключей, экспортирует только value (v6 формат).
"""

import json
import sys
import os
import torch


def get_expected_keys(include_policy=True):
    """Все ожидаемые ключи сети."""
    keys = ['proj.0.weight', 'proj.0.bias', 'proj.1.weight', 'proj.1.bias']
    for b in range(6):
        for layer in ['fc1', 'fc2']:
            keys.append(f'blocks.{b}.{layer}.weight')
            keys.append(f'blocks.{b}.{layer}.bias')
        for ln in ['ln1', 'ln2']:
            keys.append(f'blocks.{b}.{ln}.weight')
            keys.append(f'blocks.{b}.{ln}.bias')
    keys.extend(['value.0.weight', 'value.0.bias', 'value.2.weight', 'value.2.bias'])

    if include_policy:
        keys.extend([
            'policy_ctx.0.weight', 'policy_ctx.0.bias',
            'action_enc.weight', 'action_enc.bias',
        ])

    return keys


def export_weights(model_path, output_path='gpu_weights.json'):
    checkpoint = torch.load(model_path, map_location='cpu', weights_only=False)

    if isinstance(checkpoint, dict):
        if 'model' in checkpoint:
            state = checkpoint['model']
        elif 'state_dict' in checkpoint:
            state = checkpoint['state_dict']
        elif 'net' in checkpoint:
            state = checkpoint['net']
        else:
            state = checkpoint
    else:
        state = checkpoint.state_dict()

    # Определяем, есть ли policy head
    has_policy = 'policy_ctx.0.weight' in state
    expected_keys = get_expected_keys(include_policy=has_policy)

    num_expected = len(expected_keys)
    version = 'v7 (policy+value)' if has_policy else 'v6 (value only)'
    print(f'Формат: {version}')
    print(f'Ожидаемых ключей: {num_expected}')

    # Конвертируем
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

    total_params = sum(len(v) for v in weights.values())
    print(f'✓ Ключей: {len(weights)}')
    print(f'✓ Параметров: {total_params:,}')
    print(f'✓ proj input: {len(weights["proj.0.weight"]) // 256} → 256')
    print(f'✓ ResBlocks: 6')
    print(f'✓ Value head: 256 → 64 → 1')
    if has_policy:
        print(f'✓ Policy ctx: 256 → 64')
        print(f'✓ Action enc: 35 → 64')

    with open(output_path, 'w') as f:
        json.dump(weights, f)

    size_mb = os.path.getsize(output_path) / 1024 / 1024
    print(f'✓ Сохранено: {output_path} ({size_mb:.1f} MB)')
    print()
    print('Далее:')
    print(f'  node scripts/convert_weights_bin.js')
    print('  git add src/engine/gpu_weights.bin')
    print('  git commit -m "AI v7: AlphaZero policy+value weights"')
    print('  git push')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Использование: python export_weights_v7.py <model.pt> [output.json]')
        print()
        print('Примеры:')
        print('  python export_weights_v7.py gpu_checkpoint_v7/model_v100.pt')
        print('  python export_weights_v7.py model.pt ../src/engine/gpu_weights.json')
        sys.exit(1)

    model_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else 'gpu_weights.json'
    export_weights(model_path, output_path)
