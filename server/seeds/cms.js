/**
 * Сид CMS-контента для таблицы site_content.
 *
 * Делится на две фазы:
 *  1. Первый засев (если таблица пуста): siteSeed + landingSeed + i18n базовый пак.
 *  2. Инкрементальные добавления (NEW_KEYS): выполняются всегда через
 *     INSERT OR IGNORE — идемпотентно по key.
 *
 * Новый ключ = одна запись в NEW_KEYS, файл db.js не трогается.
 */

const SITE_SEED = [
  ['site.name', 'Перехват высотки', 'Highrise Heist', 'Название игры'],
  ['site.tagline', 'Стратегическая настолка с AI', 'Strategy board game powered by AI', 'Слоган / подзаголовок'],
  ['site.description', 'Стратегическая настольная игра с AI-противником на базе AlphaZero. Играйте онлайн, решайте головоломки, соревнуйтесь.', 'Strategy board game with AlphaZero AI. Play online, solve puzzles, compete.', 'Описание для поисковиков (meta)'],
  ['site.beta_text', 'Открытая бета — активная разработка', 'Open beta — active development', 'Текст под логотипом'],
  ['footer.tagline', 'Настольные игры и AI-исследования', 'Board games meet AI research', 'Подпись в футере'],
]

const LANDING_SEED = [
  ['landing.play_btn', 'Играть', 'Play free', 'Кнопка Играть'],
  ['landing.learn_btn', 'Обучение за 2 мин', 'Learn in 2 min', 'Кнопка Обучение'],
  ['landing.stat_games', 'партий', 'games analyzed', 'Подпись под числом 239K+'],
  ['landing.stat_winrate', 'винрейт AI', 'AI win rate', 'Подпись под числом 97%'],
  ['landing.stat_balance', 'баланс', 'balance', 'Подпись под числом 50:50'],
  ['landing.steps_title', 'Научитесь за 3 шага', 'Learn in 3 steps', 'Заголовок 3 шага'],
  ['landing.step1_title', 'Ставьте', 'Place', 'Шаг 1 заголовок'],
  ['landing.step1_desc', 'До 3 блоков на 2 стойки за ход. Первый ход — 1 блок.', 'Up to 3 blocks on max 2 stands per turn. First move — 1 block.', 'Шаг 1 описание'],
  ['landing.step2_title', 'Переносите', 'Transfer', 'Шаг 2 заголовок'],
  ['landing.step2_desc', 'Переместите верхнюю группу блоков. Ключевой тактический приём.', 'Move the top group of blocks to another stand. The key tactical move.', 'Шаг 2 описание'],
  ['landing.step3_title', 'Закрывайте', 'Close', 'Шаг 3 заголовок'],
  ['landing.step3_desc', 'При 11 блоках высотка построена. Цвет сверху = владелец. Достройте 6 из 10.', 'At 11 blocks the highrise is complete. Top color = owner. Complete 6 of 10.', 'Шаг 3 описание'],
  ['landing.features_title', 'Что внутри', "What's inside", 'Заголовок блока фич'],
  ['landing.ai_title', 'AI на нейросети', 'Neural network AI', 'Фича AI'],
  ['landing.ai_desc', '239K партий self-play, архитектура AlphaZero.', '239K self-play games, AlphaZero architecture.', 'Фича AI описание'],
  ['landing.puzzles_title', 'Головоломки', 'Puzzles', 'Фича Головоломки'],
  ['landing.puzzles_desc', 'Ежедневные и еженедельные головоломки.', 'Daily and weekly puzzles.', 'Фича Головоломки описание'],
  ['landing.online_title', 'Онлайн мультиплеер', 'Online multiplayer', 'Фича Онлайн'],
  ['landing.online_desc', 'Играйте с друзьями или случайным соперником.', 'Play with friends or random opponents.', 'Фича Онлайн описание'],
]

const I18N_SECTIONS = { nav: 'Навигация', game: 'Игра', tournament: 'Турниры', online: 'Онлайн', daily: 'Ежедневный челлендж', puzzle: 'Головоломки', trainer: 'Тренер', swap: 'Swap', replay: 'Повтор', tutorial: 'Обучение', header: 'Шапка', common: 'Общее', openings: 'Аналитика', blog: 'Блог' }

const I18N_BASE_RU = { 'nav.play': 'Играть', 'nav.online': 'Онлайн', 'nav.profile': 'Профиль', 'nav.rules': 'Правила', 'nav.puzzles': 'Головоломки', 'nav.simulator': 'Симулятор', 'nav.analytics': 'Аналитика', 'nav.replays': 'Реплеи', 'game.newGame': 'Новая игра', 'game.confirm': 'Подтвердить', 'game.reset': 'Сброс', 'game.transfer': '↗ Сделать перенос', 'game.cancelTransfer': '✕ Отменить перенос', 'game.mode': 'Режим', 'game.vsAI': 'Против AI', 'game.pvp': 'Вдвоём', 'game.spectate': 'AI vs AI', 'game.side': 'Сторона', 'game.blue': 'Синие', 'game.red': 'Красные', 'game.blueFirst': 'Синие (первый ход)', 'game.redSwap': 'Красные (swap)', 'game.difficulty': 'Сложность', 'game.easy': 'Лёгкая', 'game.medium': 'Средняя', 'game.hard': 'Сложная', 'game.hints': 'Подсказки', 'game.trainer': 'Тренер', 'game.victory': 'Победа!', 'game.defeat': 'Поражение', 'game.aiWins': 'AI победил', 'game.blueWin': 'Синие победили!', 'game.redWin': 'Красные победили!', 'game.gameOver': 'Игра окончена', 'game.place1': 'Поставьте 1 блок', 'game.place1first': 'Ваш ход — поставьте 1 блок', 'game.placeChips': 'Расставьте блоки', 'game.clickStands': 'Кликайте на стойки', 'game.aiFirst': 'AI ходит первым...', 'game.aiThinking': 'AI думает...', 'game.opponentTurn': 'Ход противника', 'game.timeUp': 'Время вышло!', 'game.oppTimeUp': 'У соперника вышло время!', 'game.max2stands': 'Макс 2 стойки', 'game.allPlaced': 'Все блоки расставлены', 'game.undone': 'Ход отменён', 'game.yourTurn': 'ваш ход', 'game.pass': 'пас', 'game.swapDone': 'Swap выполнен — цвета поменялись', 'game.swapOnlineDone': 'Swap — вы теперь синие', 'game.selectTransferFrom': 'Выберите стойку для переноса', 'game.transferSelected': 'Перенос выбран, расставьте блоки', 'game.transferCancelled': 'Перенос отменён', 'game.swap': 'Swap — смена цветов', 'header.title': 'Перехват высотки', 'header.totalUsers': 'игроков', 'header.totalGames': 'партий', 'header.avgRating': 'ср. рейтинг', 'tutorial.title': 'Как играть', 'common.online': 'Онлайн', 'common.offline': 'Оффлайн', 'tournament.won': 'Турнир выигран!', 'tournament.lost': 'Турнир проигран', 'tournament.draw': 'Ничья в турнире', 'trainer.strong': 'Сильная позиция', 'trainer.slight': 'Небольшое преимущество', 'trainer.equal': 'Равная позиция', 'trainer.weak': 'Слабая позиция', 'trainer.bad': 'Плохая позиция' }
const I18N_BASE_EN = { 'nav.play': 'Play', 'nav.online': 'Online', 'nav.profile': 'Profile', 'nav.rules': 'Rules', 'nav.puzzles': 'Puzzles', 'nav.simulator': 'Simulator', 'nav.analytics': 'Analytics', 'nav.replays': 'Replays', 'game.newGame': 'New game', 'game.confirm': 'Confirm', 'game.reset': 'Reset', 'game.transfer': '↗ Transfer', 'game.cancelTransfer': '✕ Cancel transfer', 'game.mode': 'Mode', 'game.vsAI': 'vs AI', 'game.pvp': 'PvP', 'game.spectate': 'AI vs AI', 'game.side': 'Side', 'game.blue': 'Blue', 'game.red': 'Red', 'game.blueFirst': 'Blue (first move)', 'game.redSwap': 'Red (swap)', 'game.difficulty': 'Difficulty', 'game.easy': 'Easy', 'game.medium': 'Medium', 'game.hard': 'Hard', 'game.hints': 'Hints', 'game.trainer': 'Trainer', 'game.victory': 'Victory!', 'game.defeat': 'Defeat', 'game.aiWins': 'AI wins', 'game.blueWin': 'Blue wins!', 'game.redWin': 'Red wins!', 'game.gameOver': 'Game over', 'game.place1': 'Place 1 block', 'game.place1first': 'Your turn — place 1 block', 'game.placeChips': 'Place blocks', 'game.clickStands': 'Click stands to place', 'game.aiFirst': 'AI goes first...', 'game.aiThinking': 'AI thinking...', 'game.opponentTurn': "Opponent's turn", 'game.timeUp': 'Time up!', 'game.oppTimeUp': "Opponent's time is up!", 'game.max2stands': 'Max 2 stands', 'game.allPlaced': 'All blocks placed', 'game.undone': 'Move undone', 'game.yourTurn': 'your turn', 'game.pass': 'pass', 'game.swapDone': 'Swap done — colors changed', 'game.swapOnlineDone': 'Swap — you are now blue', 'game.selectTransferFrom': 'Select stand to transfer from', 'game.transferSelected': 'Transfer set, place blocks', 'game.transferCancelled': 'Transfer cancelled', 'game.swap': 'Swap colors', 'header.title': 'Highrise Heist', 'header.totalUsers': 'players', 'header.totalGames': 'games', 'header.avgRating': 'avg rating', 'tutorial.title': 'How to play', 'common.online': 'Online', 'common.offline': 'Offline', 'tournament.won': 'Tournament won!', 'tournament.lost': 'Tournament lost', 'tournament.draw': 'Tournament draw', 'trainer.strong': 'Strong position', 'trainer.slight': 'Slight advantage', 'trainer.equal': 'Equal position', 'trainer.weak': 'Weak position', 'trainer.bad': 'Bad position' }

// Инкрементальные ключи — выполняются на каждом старте через INSERT OR IGNORE.
// Добавляй новые ключи сюда.
const NEW_KEYS = {
  'common.loading': ['common', 'Загрузка...', 'Loading...', 'Текст загрузки'],
  'game.you': ['game', 'Вы', 'You', 'Имя: Вы'],
  'game.opponent': ['game', 'Противник', 'Opponent', 'Имя: Противник'],
  'game.yourTurnBlink': ['game', 'Ваш ход!', 'Your turn!', 'Мигание таба при ходе'],
  'game.opponentResigned': ['game', 'Противник сдался!', 'Opponent resigned!', 'Противник сдался'],
  'game.drawAgreed': ['game', 'Согласована ничья', 'Draw agreed', 'Ничья принята'],
  'game.drawDeclined': ['game', 'Ничья отклонена', 'Draw declined', 'Ничья отклонена'],
  'game.resigned': ['game', 'Сдались', 'Resigned', 'Вы сдались'],
  'game.hint': ['game', 'Подсказка', 'Hint', 'Кнопка подсказки'],
  'game.resign': ['game', 'Сдаться', 'Resign', 'Кнопка сдаться'],
  'game.drawOffered': ['game', 'Ничья предложена...', 'Draw offered...', 'Ничья отправлена'],
  'game.offerDraw': ['game', 'Ничья', 'Offer draw', 'Предложить ничью'],
  'game.undo': ['game', 'Отмена', 'Undo', 'Отмена хода'],
  'game.draw': ['game', 'Ничья', 'Draw', 'Результат ничья'],
  'game.backToLobby': ['game', 'В лобби', 'Back to lobby', 'Назад в лобби'],
  'game.share': ['game', 'Поделиться', 'Share', 'Поделиться'],
  'game.replay': ['game', 'Повтор', 'Replay', 'Повтор'],
  'game.swapQuestion': ['game', 'Игрок 1 поставил первый блок. Хотите поменять цвета?', 'Player 1 placed first block. Swap colors?', 'Вопрос swap'],
  'game.swapDeclined': ['game', 'Swap отклонён', 'Swap declined', 'Swap отклонён'],
  'game.noContinue': ['game', 'Нет, продолжить', 'No, continue', 'Отказ от swap'],
  'game.drawOfferReceived': ['game', 'Противник предлагает ничью', 'Opponent offers a draw', 'Предложение ничьи'],
  'game.accept': ['game', 'Принять', 'Accept', 'Принять'],
  'game.decline': ['game', 'Отклонить', 'Decline', 'Отклонить'],
  'game.modeLabel': ['game', 'Режим:', 'Mode:', 'Лейбл режим'],
  'game.sideLabel': ['game', 'Сторона:', 'Side:', 'Лейбл сторона'],
  'game.diffLabel': ['game', 'Сложность:', 'Difficulty:', 'Лейбл сложность'],
  'puzzle.leaderboard': ['puzzle', 'Лидерборд', 'Leaderboard', 'Заголовок лидерборда'],
  'puzzle.movesShort': ['puzzle', 'ход.', 'moves', 'Сокращение ходы'],
  'puzzle.movesCount': ['puzzle', 'ходов', 'moves', 'Подпись ходов'],
  'puzzle.solveRate': ['puzzle', 'Решаемость', 'Solve rate', 'Решаемость'],
  'puzzle.solvedCount': ['puzzle', 'решили', 'solved', 'Подпись решили'],
  'puzzle.solvedStatus': ['puzzle', 'Решено!', 'Solved!', 'Статус решено'],
  'puzzle.failedStatus': ['puzzle', 'Не удалось', 'Failed', 'Статус не решено'],
  'puzzle.retryBtn': ['puzzle', 'Заново', 'Retry', 'Кнопка повтора'],
  'puzzle.backBtn': ['puzzle', 'К списку', 'Back', 'Назад'],
  'puzzle.closeStands': ['puzzle', 'Перехватывайте высотки за ограниченное число ходов', 'Complete highrises in limited moves', 'Подзаголовок головоломок'],
  'puzzle.solvedLabel': ['puzzle', 'решено', 'solved', 'Подпись решено'],
  'puzzle.featured': ['puzzle', 'Избранные', 'Featured', 'Вкладка избранные'],
  'puzzle.allPuzzles': ['puzzle', 'Все головоломки', 'All puzzles', 'Вкладка все'],
  'puzzle.dailyTitle': ['puzzle', 'Головоломка дня', 'Daily Puzzle', 'Заголовок дневной'],
  'puzzle.weeklyTitle': ['puzzle', 'Задача недели', 'Weekly Challenge', 'Заголовок недельной'],
  'puzzle.nextIn': ['puzzle', 'Новая через', 'Next in', 'Таймер'],
  'puzzle.replayBtn': ['puzzle', '↻ Переиграть', '↻ Replay', 'Кнопка переиграть'],
  'puzzle.playBtn': ['puzzle', '▶ Играть', '▶ Play', 'Кнопка играть'],
  'puzzle.loadingPuzzles': ['puzzle', 'Загрузка головоломок...', 'Loading puzzles...', 'Загрузка'],
  'puzzle.filterAll': ['puzzle', 'Все', 'All', 'Фильтр все'],
  'puzzle.filterEasy': ['puzzle', 'Лёгкие', 'Easy', 'Фильтр лёгкие'],
  'puzzle.filterMedium': ['puzzle', 'Средние', 'Medium', 'Фильтр средние'],
  'puzzle.filterHard': ['puzzle', 'Сложные', 'Hard', 'Фильтр сложные'],
  'openings.title': ['openings', 'Книга дебютов и карта стоек', 'Opening Book and Heatmap', 'Заголовок дебютов'],
  'openings.subtitle': ['openings', 'На основании AI-исследования, 239K+ партий', 'Based on AI research, 239K+ games analyzed', 'Подзаголовок'],
  'openings.tabOpenings': ['openings', 'Дебюты', 'Openings', 'Вкладка дебюты'],
  'openings.tabHeatmap': ['openings', 'Тепловая карта', 'Heatmap', 'Вкладка карта'],
  'openings.usage': ['openings', 'популярность', 'usage', 'Популярность'],
  'openings.insights': ['openings', 'Выводы', 'Key insights', 'Выводы'],
  'blog.title': ['blog', 'Блог', 'Blog', 'Заголовок блога'],
  'blog.subtitle': ['blog', 'Новости, обновления и дневник разработки', 'News, updates, and development log', 'Подзаголовок блога'],
  'blog.allPosts': ['blog', 'Все записи', 'All posts', 'Ссылка все записи'],
  'blog.noPosts': ['blog', 'Пока нет записей', 'No posts yet', 'Нет записей'],
  'tutorial.start': ['tutorial', 'Начать играть!', 'Start playing!', 'Кнопка начать'],
  'tutorial.next': ['tutorial', 'Далее →', 'Next →', 'Кнопка далее'],
  'tutorial.skip': ['tutorial', 'Пропустить', 'Skip', 'Кнопка пропустить'],
  'game.rematch': ['game', 'Рематч', 'Rematch', 'Кнопка рематч'],
  'game.rematchOffer': ['game', 'Противник предлагает рематч', 'Opponent offers a rematch', 'Предложение рематча'],
  'game.rematchWaiting': ['game', 'Рематч предложен...', 'Rematch offered...', 'Ожидание рематча'],
  'game.rematchDeclined': ['game', 'Рематч отклонён', 'Rematch declined', 'Рематч отклонён'],
  'game.extreme': ['game', 'Экстрим', 'Extreme', 'Сложность экстрим'],
  'game.watching': ['game', 'наблюдение', 'watching', 'Режим наблюдения'],
}

export function seedCms(db) {
  const ins = db.prepare('INSERT OR IGNORE INTO site_content (key, section, value_ru, value_en, label) VALUES (?, ?, ?, ?, ?)')

  const contentCount = db.prepare('SELECT COUNT(*) as c FROM site_content').get().c
  if (contentCount === 0) {
    for (const [key, ru, en, label] of SITE_SEED) ins.run(key, 'Сайт', ru, en, label)
    for (const [key, ru, en, label] of LANDING_SEED) ins.run(key, 'Главная', ru, en, label)
    for (const key of Object.keys(I18N_BASE_RU)) {
      const prefix = key.split('.')[0]
      ins.run(key, I18N_SECTIONS[prefix] || 'Другое', I18N_BASE_RU[key], I18N_BASE_EN[key] || '', key)
    }
    console.log('CMS засеян: site + landing + i18n')
  }

  let migrated = 0
  for (const [key, [section, ru, en, label]] of Object.entries(NEW_KEYS)) {
    const r = ins.run(key, I18N_SECTIONS[section] || section, ru, en || '', label)
    if (r.changes > 0) migrated++
  }
  if (migrated > 0) console.log('CMS миграция: добавлено ' + migrated + ' ключей')
}
