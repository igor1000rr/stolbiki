#!/bin/bash
# ═══ Snatch Highrise — AI v7 AlphaZero обучение ═══
#
# Запуск на GPU-машине (GTX 1080 / RTX 5090):
#   bash run_v7.sh
#
# Что делает:
#   1. Клонирует/пулит репо
#   2. Восстанавливает v6 модель из gpu_weights.json (если нет .pt)
#   3. Мигрирует v6→v7 (загружает backbone+value, policy рандомный)
#   4. Обучает AlphaZero (PUCT MCTS + dual loss)
#   5. Экспортирует веса → .json → .bin
#   6. Пушит в GitHub → CI/CD деплоит на VPS
#
set -e

TOKEN="${GH_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  REPO_URL="https://github.com/igor1000rr/stolbiki.git"
else
  REPO_URL="https://${TOKEN}@github.com/igor1000rr/stolbiki.git"
fi

echo "═══════════════════════════════════════════"
echo "  Snatch Highrise — AI v7 AlphaZero"
echo "═══════════════════════════════════════════"

# ── 1. Репо ──
if [ ! -d "stolbiki" ]; then
  echo "→ Клонируем репо..."
  git clone "$REPO_URL"
fi
cd stolbiki
git pull origin main

# ── 2. Python зависимости ──
echo "→ Проверяем зависимости..."
python3 -c "import torch; print(f'PyTorch {torch.__version__}, CUDA: {torch.cuda.is_available()}')" 2>/dev/null || {
  echo "→ Устанавливаем PyTorch..."
  pip install torch --index-url https://download.pytorch.org/whl/cu124 2>/dev/null || pip install torch
  pip install numpy
}

# Проверка GPU
python3 -c "
import torch
if not torch.cuda.is_available():
    print('ОШИБКА: CUDA не найдена!'); exit(1)
gpu = torch.cuda.get_device_name(0)
vram = torch.cuda.get_device_properties(0).total_memory / 1024**3
print(f'GPU: {gpu} ({vram:.1f} GB VRAM)')
"

# ── 3. Определяем чекпоинт ──
cd gpu_train

# Ищем существующий v7 чекпоинт
V7_CKPT=""
if [ -d "gpu_checkpoint_v7" ]; then
  V7_CKPT=$(ls -t gpu_checkpoint_v7/model_v*.pt 2>/dev/null | head -1)
fi

# Ищем существующий v6 чекпоинт
V6_CKPT=""
if [ -d "gpu_checkpoint" ]; then
  V6_CKPT=$(ls -t gpu_checkpoint/model_v*.pt 2>/dev/null | head -1)
fi

CKPT_ARG=""
if [ -n "$V7_CKPT" ]; then
  echo "→ Найден v7 чекпоинт: $V7_CKPT"
  CKPT_ARG="--checkpoint $V7_CKPT"
elif [ -n "$V6_CKPT" ]; then
  echo "→ Миграция v6→v7: $V6_CKPT"
  CKPT_ARG="--v6-checkpoint $V6_CKPT"
else
  echo "→ Нет .pt чекпоинта, восстанавливаем из gpu_weights.json..."
  python3 recover_model.py ../src/engine/gpu_weights.json gpu_checkpoint_v7/model_recovered.pt
  CKPT_ARG="--v6-checkpoint gpu_checkpoint_v7/model_recovered.pt"
fi

# ── 4. Определяем параметры по GPU ──
PARALLEL=$(python3 -c "
import torch
vram = torch.cuda.get_device_properties(0).total_memory / 1024**3
if vram >= 20:
    print(50)   # RTX 5090 / A100
elif vram >= 10:
    print(30)   # RTX 3080+
else:
    print(20)   # GTX 1080
")

ITERS="${1:-1000}"  # Первый аргумент или 1000

echo ""
echo "═══════════════════════════════════════════"
echo "  Параллельных партий: $PARALLEL"
echo "  Итераций: $ITERS"
echo "  MCTS симуляций: 100"
echo "  Чекпоинты: gpu_checkpoint_v7/"
echo "═══════════════════════════════════════════"
echo ""

# ── 5. Обучение ──
python3 gpu_trainer.py \
  $CKPT_ARG \
  --iterations "$ITERS" \
  --parallel "$PARALLEL" \
  --mcts-sims 100 \
  --export-json ../src/engine/gpu_weights.json

# ── 6. Конвертация JSON → BIN ──
echo ""
echo "→ Конвертация весов: JSON → BIN..."
cd ..
node scripts/convert_weights_bin.js

# ── 7. Коммит и деплой ──
echo ""
echo "→ Пушим веса в GitHub..."
git add src/engine/gpu_weights.json src/engine/gpu_weights.bin
git commit -m "AI v7: AlphaZero веса — $(date +%Y-%m-%d)"
git push origin main

echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ Обучение завершено!"
echo "  CI/CD обновит snatch-highrise.com"
echo "═══════════════════════════════════════════"
