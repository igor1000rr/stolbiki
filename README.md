# Стойки — анализ баланса и онлайн-версия

Настольная игра «Стойки» — программная среда для анализа баланса, AI-агент (MCTS + self-play), веб-интерфейс для игры.

## Структура

```
src/                  # React-приложение (Vite)
  engine/game.js      # Движок: правила игры (JS)
  engine/ai.js        # AI: MCTS с эвристиками
  components/         # React-компоненты
  data/               # Данные для дашборда и replay

analysis/             # Python-аналитика (self-play, отчёт)
  game.py             # Движок: правила игры (Python)
  mcts.py             # MCTS агент
  network.py          # Нейросеть (numpy)
  train.py            # Self-play пайплайн
  analysis.py         # Расширенный анализ
  report_gen.py       # Генератор PDF-отчёта
  main.py             # Точка входа
  report.pdf          # Готовый отчёт
  final_net.npz       # Обученная модель (v80, 80 итераций)
```

## Запуск веб-приложения

```bash
npm install
npm run dev
```

## Запуск анализа (Python)

```bash
cd analysis
pip install numpy matplotlib reportlab
python main.py          # Полный анализ
python report_gen.py    # Генерация PDF-отчёта
```

## Обучение

80 итераций self-play, ~140 000 партий. Loss: 1.10 → 0.78. Агент побеждает рандом в 85-100%.
