# Маркетинговые тексты — готовые к публикации

---

## Reddit: r/boardgames

**Title:** I analyzed 10 million games of my board game with a neural network. Here's what the data revealed about perfect game balance.

**Body:**

Hey r/boardgames! My friend and I have been building an abstract strategy board game called **Highrise Heist** — think Go meets Jenga.

**The rules are dead simple:** 10 stands, 11 blocks each. On your turn, place blocks or transfer the top group. When a stand reaches 11 blocks, whoever's color is on top owns it. First to control 6 out of 10 wins.

Simple to explain. Brutally hard to master.

**The AI experiment**

We built an AlphaZero-style neural network (840K parameters, MCTS + ResNet) and let it play against itself. A lot. 10 million games.

**Key findings:**

- Player 1 wins 36.35%, Player 2 wins 36.33%. That's a 0.012% difference. Essentially perfect balance.
- Zero sweeps (10-0) out of 10 million games. You literally cannot dominate.
- 54% of games are decided by 2 points or less. Every game is tense until the end.
- The "golden stand" (stand #0, worth bonus points) gives exactly 0% advantage. It's a psychological trap.
- Comebacks from being 2 points down happen 3.7% of the time — enough to keep you in every game.
- Average game length: 82 moves. Long enough to be strategic, short enough for lunch breaks.

**What we built:**

The digital version has AI at 5 difficulty levels, post-game AI review (rates every move like chess.com — from "Excellent" to "Blunder"), daily puzzles, online multiplayer, 33 achievements, and a referral system.

**Try it free:** [highriseheist.com](https://highriseheist.com) — no signup needed for AI games. There's also a Print & Play PDF if you want to try the physical version.

Would love to hear what you think about the game design. Are there other abstract strategy games that achieved this level of statistical balance?

---

## Reddit: r/gamedev

**Title:** How I built an AlphaZero-style AI for my board game — architecture, 10M self-play games, and what I learned

**Body:**

I've been building an abstract strategy board game (Highrise Heist) and wanted an AI that could actually challenge experienced players. Here's the technical journey.

**The game:** 10 stands, 11 blocks. Place or transfer blocks to control stands. Simple rules but the branching factor is huge (200+ legal moves per turn).

**Architecture:**
- ResNet with 6 blocks, 256 channels = 840K parameters
- Input: 100-dimensional state encoding (per-stand: fill ratio, top group color/size, closed status, golden indicator)
- Output: policy head (move probabilities) + value head (win probability)
- MCTS with 80-1500 simulations depending on difficulty

**Training:**
- Pure self-play, no human data
- GPU training on GTX 1080 (8GB VRAM)
- 1493 iterations, 20 parallel games per iteration
- CosineAnnealing LR scheduler (0.002 → 0.0001)
- Checkpoint every 50 iterations

**Results after 10M simulated games:**
- P1 vs P2: 36.35% vs 36.33% — perfect balance
- The AI at Extreme (1500 sims) beats the AI at Hard (600 sims) ~70% of the time
- Average game: 82 moves, ~55% tight finishes

**The coolest feature:** Post-game AI Review. After every game, the AI analyzes each move and classifies it: Excellent / Good / Inaccuracy / Mistake / Blunder. Shows accuracy percentage. Like chess.com but for our game.

**Stack:** React + Vite (client), Node.js + Express + SQLite + WebSocket (server), PyTorch (training). The neural net runs client-side in the browser via Float32Array weights (3.2MB binary).

**Try it:** [highriseheist.com](https://highriseheist.com)

Happy to answer questions about the architecture or training process!

---

## Reddit: r/WebGames

**Title:** Highrise Heist — free strategy board game with neural network AI, no signup needed

**Body:**

Built a browser-based abstract strategy game with a properly trained AI opponent.

**Quick pitch:** 10 stands, 11 blocks. Place or transfer to control stands. 2 minutes to learn, lifetime to master. The AI was trained on 10M+ self-play games.

**Features:** 5 AI levels (Easy → Extreme), AI game review after each match, daily puzzles, online multiplayer, achievements. Works on mobile.

[highriseheist.com](https://highriseheist.com) — click Play, pick difficulty, go. No account needed.

---

## Product Hunt

**Tagline (60 chars):**
Board game with AlphaZero AI trained on 10M games

**Description:**
Highrise Heist is an abstract strategy board game with a neural network AI that analyzed 10 million self-play games to achieve perfect 50:50 balance.

Simple rules: 10 stands, 11 blocks each. Place or transfer blocks. Control 6 of 10 stands to win. 2 minutes to learn, impossible to master.

Features that make it special:
- AI Game Review — every move rated Excellent → Blunder (like chess.com)
- 5 AI difficulty levels powered by MCTS + ResNet (840K parameters)
- Online multiplayer with friend challenges
- 14 puzzle templates with daily challenges and Puzzle Rush
- 33 achievements, 11 themes, 17 skins, levels 1-50
- Referral system, share cards, login streaks

Free. No ads. No paywalls. Just pure strategy.

**Topics:** Board Games, Artificial Intelligence, Games, Strategy

**Gallery (5 images):**
1. Landing page hero
2. Game board with AI thinking indicator
3. AI Review screen (move ratings)
4. Profile with achievements and ELO chart
5. Share card example (680x400)

---

## Telegram — первый пост

🏗 **Highrise Heist — стратегическая настольная игра с AI**

10 стоек. 11 блоков. Простые правила — бесконечная глубина.

Наш AI обучен на 10 миллионов партий и анализирует каждый твой ход: от «Отличный» до «Грубая ошибка».

🎮 Играй бесплатно: highriseheist.com
📱 Android скоро в Google Play

Что внутри:
• 5 уровней AI (от новичка до непобедимого)
• Онлайн мультиплеер + вызов друзьям
• Ежедневные головоломки и миссии
• 33 ачивки, 11 тем, рейтинговая система

Подписывайтесь — будем делиться головоломкой дня, стратегиями и обновлениями!

---

## TikTok — описания

**#1 "Грубая ошибка"**
Caption: AI сказал что мой ход — ГРУБАЯ ОШИБКА 💀 Бесплатная настольная стратегия с нейросетью #boardgame #ai #strategy #gaming

**#2 "10 миллионов"**
Caption: Эта игра сыграла 10 МИЛЛИОНОВ партий сама с собой. Результат: идеальный баланс 50:50 🤯 #gamedev #ai #boardgame #statistics

**#3 "Правила за 30 сек"**
Caption: Научиться играть за 30 секунд. Научиться выигрывать — никогда 🏗 #boardgame #strategy #tutorial

**#4 "Экстрим"**
Caption: AI на ЭКСТРИМ уровне делает 1500 просчётов за ход. У меня нет шансов 😭 #ai #gaming #impossible
