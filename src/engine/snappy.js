/**
 * Snappy — фразы маскота и логика выбора реплики по триггеру.
 *
 * Триггеры (events):
 *   - 'tower_takeover'  — игрок закрыл башню (с большим перевесом — отобрал инициативу)
 *   - 'near_loss'       — у соперника 5 закрытых башен, ещё одна — и проигрыш
 *   - 'comeback'        — игрок отыграл с отставания
 *   - 'victory'         — победа в партии
 *   - 'defeat'          — поражение в партии
 *   - 'draw'            — ничья
 *   - 'victory_city'    — открыт экран Города Побед
 *   - 'skin_collision'  — два игрока выбрали одинаковые скины блоков (онлайн)
 *   - 'mistake'         — игрок сделал явно плохой ход (placeholder, пока не используется)
 *
 * Каждая фраза снабжена позой маскота — Mascot.jsx уже поддерживает hero/celebrate/sad/shock/think/wave/point.
 *
 * Дизайн-принципы (из брифа):
 *   - короткие фразы
 *   - сарказм + фейковое сочувствие
 *   - тон 6/10 (подшучивает, не оскорбляет)
 *   - редкие появления — не спамим
 */

const PHRASES = {
  // Игрок ЗАКРЫЛ башню — Snappy комментит как будто это перехват
  tower_takeover: [
    { ru: 'Это теперь твоё.',          en: 'It\'s yours now.',           pose: 'celebrate', priority: 1 },
    { ru: 'Ничего личного.',           en: 'Nothing personal.',          pose: 'wave',      priority: 1 },
    { ru: 'Спасибо, заберу.',          en: 'Thanks, I\'ll take that.',   pose: 'point',     priority: 0 },
    { ru: 'Без присмотра оставил?',    en: 'Left it unattended?',        pose: 'shock',     priority: 0 },
  ],

  // У соперника 5 закрытых, ещё одна — проигрыш
  near_loss: [
    { ru: 'Ты был так близко.',        en: 'You were so close.',         pose: 'sad',       priority: 1 },
    { ru: 'Красиво. Было.',            en: 'Beautiful. Was.',            pose: 'shock',     priority: 0 },
    { ru: 'Аплодирую стоя.',           en: 'Standing ovation.',          pose: 'celebrate', priority: 0 },
  ],

  // Победа
  victory: [
    { ru: 'Я ждал этого.',             en: 'I was waiting for this.',    pose: 'celebrate', priority: 1 },
    { ru: 'Awesome.',                  en: 'Awesome.',                   pose: 'hero',      priority: 1 },
    { ru: 'Запомни этот момент.',      en: 'Remember this moment.',      pose: 'point',     priority: 0 },
    { ru: 'Это было неизбежно.',       en: 'This was inevitable.',       pose: 'celebrate', priority: 0 },
  ],

  // Поражение
  defeat: [
    { ru: 'Серьёзно?',                 en: 'Seriously?',                 pose: 'shock',     priority: 1 },
    { ru: 'Интересный выбор.',         en: 'Interesting choice.',        pose: 'think',     priority: 1 },
    { ru: 'Ой. Не повезло.',           en: 'Oops. Tough luck.',          pose: 'sad',       priority: 0 },
    { ru: 'Ты это планировал?',        en: 'Was that the plan?',         pose: 'think',     priority: 0 },
    { ru: 'Молодец… почти.',           en: 'Great job… almost.',         pose: 'wave',      priority: 0 },
  ],

  // Ничья
  draw: [
    { ru: 'Бывает.',                   en: 'It happens.',                pose: 'wave',      priority: 1 },
    { ru: 'Никто не выиграл. Скучно.', en: 'Nobody won. Boring.',        pose: 'think',     priority: 0 },
  ],

  // Город Побед
  victory_city: [
    { ru: 'Это памятники твоей хитрости.',   en: 'Monuments to your cunning.',     pose: 'point',     priority: 1 },
    { ru: 'Что, нравятся?',                  en: 'What, like \'em?',               pose: 'celebrate', priority: 1 },
    { ru: 'Тебе наверное снятся владельцы.', en: 'Bet you dream of the owners.',   pose: 'think',     priority: 0 },
    { ru: 'У меня были башни. Их забрали.',  en: 'I had towers once. Got taken.',  pose: 'sad',       priority: 0 },
  ],

  // Snappy Block — онлайн партия началась с одинаковыми скинами блоков
  // у обоих игроков. Триггер посылается сервером после проверки skin_id
  // в матчмейкинге. Часть Customization Rework Часть 2 — ждёт backend
  // (server/multiplayer.js должен emit 'skin_collision' при startGame
  // если у обоих игроков ns.player[0].skin_id === ns.player[1].skin_id).
  skin_collision: [
    { ru: 'Эй, скопировал у меня!',         en: 'Hey, copycat!',                  pose: 'shock',     priority: 1 },
    { ru: 'У вас одинаковые блоки.',        en: 'You both have the same blocks.', pose: 'point',     priority: 1 },
    { ru: 'Меняй блоки, оригинал!',         en: 'Change \'em, original!',         pose: 'shock',     priority: 0 },
    { ru: 'Близнецы по стилю.',             en: 'Style twins.',                   pose: 'wave',      priority: 0 },
    { ru: 'Один из вас — подделка.',        en: 'One of you is a knockoff.',      pose: 'think',     priority: 0 },
  ],
}

/**
 * Выбрать фразу для триггера.
 * 70% шанс взять приоритетную (priority=1), 30% — любую вариацию.
 * Возвращает { text, pose } или null если триггер неизвестен.
 */
export function pickPhrase(event, lang = 'ru') {
  const list = PHRASES[event]
  if (!list || list.length === 0) return null

  // Приоритетные фразы (брендовые) показываем чаще — закрепляем мемность.
  const useHighPriority = Math.random() < 0.7
  const pool = useHighPriority
    ? list.filter(p => p.priority === 1)
    : list
  const picked = (pool.length > 0 ? pool : list)[Math.floor(Math.random() * (pool.length > 0 ? pool.length : list.length))]

  return {
    text: lang === 'en' ? picked.en : picked.ru,
    pose: picked.pose,
  }
}

/**
 * Защита от спама: возвращает true если с прошлого показа Snappy прошло >= cooldownMs.
 * Состояние хранится в module-scope (в пределах одной партии переживает re-render).
 */
let lastShownAt = 0
const DEFAULT_COOLDOWN_MS = 4000

export function canShow(cooldownMs = DEFAULT_COOLDOWN_MS) {
  return Date.now() - lastShownAt >= cooldownMs
}

export function markShown() {
  lastShownAt = Date.now()
}

/**
 * Сброс кулдауна — для начала новой партии или возврата в меню,
 * чтобы первая реакция в новой сессии не была заблокирована.
 */
export function resetCooldown() {
  lastShownAt = 0
}
