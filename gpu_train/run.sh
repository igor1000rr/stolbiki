#!/bin/bash
# Запуск GPU обучения для "Стойки"
# Требования: Python 3.8+, PyTorch, NVIDIA GPU

set -e

echo "═══════════════════════════════════════"
echo "  Стойки — GPU Self-Play обучение"
echo "═══════════════════════════════════════"

# Проверка GPU
python3 -c "import torch; print(f'PyTorch: {torch.__version__}'); print(f'CUDA: {torch.cuda.is_available()}'); print(f'GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"нет\"}')" 2>/dev/null || {
    echo "PyTorch не установлен. Установите:"
    echo "  pip install torch numpy"
    exit 1
}

# Запуск
cd "$(dirname "$0")"
python3 gpu_trainer.py "$@"
