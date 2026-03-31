#!/bin/bash
# ═══ Snatch Highrise — обучение на RTX 5090 ═══
# Запуск: bash train_5090.sh
# Требования: Python 3.10+, CUDA 12+, git
set -e

echo "═══ Snatch Highrise AI Training (RTX 5090) ═══"

# 1. Клонируем репо если нет
if [ ! -d "stolbiki" ]; then
  echo "→ Клонируем репо..."
  echo "  Введите: git clone https://github.com/igor1000rr/stolbiki.git"
  echo "  Или с токеном: git clone https://<TOKEN>@github.com/igor1000rr/stolbiki.git"
  exit 1
fi
cd stolbiki

# 2. Устанавливаем Python зависимости
echo "→ Устанавливаем PyTorch + CUDA..."
pip install torch --index-url https://download.pytorch.org/whl/cu124 2>/dev/null || pip install torch
pip install numpy

# 3. Проверяем GPU
python3 -c "
import torch
print(f'CUDA: {torch.cuda.is_available()}')
if torch.cuda.is_available():
    print(f'GPU: {torch.cuda.get_device_name(0)}')
    print(f'VRAM: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB')
else:
    print('ОШИБКА: CUDA не найдена!'); exit(1)
"

# 4. Восстанавливаем модель из текущих весов
echo "→ Восстанавливаем модель из gpu_weights.json..."
cd gpu_train
python3 recover_model.py ../src/engine/gpu_weights.json gpu_checkpoint/model_v643.pt

# 5. Запускаем обучение (оптимизировано под 5090)
echo ""
echo "═══ СТАРТ ОБУЧЕНИЯ ═══"
echo "  RTX 5090: 50 параллельных партий, batch 4096, 2000 итераций"
echo "  Ожидаемое время: ~4-8 часов"
echo "  Чекпоинты каждые 50 итераций в gpu_checkpoint/"
echo ""

python3 gpu_trainer.py \
  --checkpoint gpu_checkpoint/model_v643.pt \
  --iterations 2000 \
  --parallel 50 \
  --export-json ../src/engine/gpu_weights.json

# 6. Коммитим и пушим
echo ""
echo "═══ Экспорт и деплой ═══"
cd ..
git add src/engine/gpu_weights.json
git commit -m "AI v4: обучение на RTX 5090 — 2000 итераций, ожидаемый WR 99%+"
git push origin main

echo ""
echo "✅ Обучение завершено! Веса задеплоены на сервер."
echo "   CI/CD обновит snatch-highrise.com автоматически."
