/**
 * SEO-метаданные per-route для ru/en.
 * Используется в App.jsx для динамического обновления title/description/OG/canonical
 * при смене вкладки. Prerender подхватывает финальное состояние DOM.
 */

const SITE = 'https://highriseheist.com'
const DEFAULT_OG = `${SITE}/og.png`

// Базовые тексты по каждому tab.
const ROUTES = {
  landing: {
    ru: {
      title: 'Highrise Heist — Стратегическая настольная игра с AI',
      desc: 'Стратегическая настольная игра на 1-2-4 игрока с AlphaZero AI. Режим Golden Rush для 4 игроков, AI-разбор партий, Puzzle Rush, Arena-турниры. Бесплатно, без рекламы.',
    },
    en: {
      title: 'Highrise Heist — Strategy board game with AI',
      desc: 'Strategy board game for 1-2-4 players with AlphaZero AI. Golden Rush mode (4-player cross), AI game review, Puzzle Rush, live Arena tournaments. Free, no ads.',
    },
  },
  game: {
    ru: { title: 'Играть — Highrise Heist', desc: 'Играй против AlphaZero-AI или друзей. 10 стоек, 11 блоков, бесконечная глубина. Разбор ходов, намёки, подсказки.' },
    en: { title: 'Play — Highrise Heist',    desc: 'Play against AlphaZero AI or friends. 10 stands, 11 blocks, infinite depth. Move review, hints, coaching.' },
  },
  online: {
    ru: { title: 'Онлайн — Highrise Heist', desc: 'Играй в реальном времени: matchmaking по рейтингу, турниры, дружеские матчи. Звуковой чат, ранги, стрик.' },
    en: { title: 'Online — Highrise Heist', desc: 'Play real-time: ranked matchmaking, tournaments, friendly matches. Voice chat, ranks, streaks.' },
  },
  puzzles: {
    ru: { title: 'Задачи — Highrise Heist', desc: 'Тактические задачи на перенос, достройку и блокировку. Ежедневный Puzzle Rush — 3 минуты, максимум правильных ответов.' },
    en: { title: 'Puzzles — Highrise Heist', desc: 'Tactical puzzles on transfers, completions and blocks. Daily Puzzle Rush: 3 minutes, max correct answers.' },
  },
  rules: {
    ru: { title: 'Правила — Highrise Heist', desc: 'Полные правила игры: подготовка, ход, перенос блоков, достройка высоток, победа. Плюс режим Golden Rush на 4 игрока.' },
    en: { title: 'Rules — Highrise Heist',   desc: 'Complete rules: setup, turn order, block transfer, completing highrises, victory. Plus the 4-player Golden Rush mode.' },
  },
  profile: {
    ru: { title: 'Профиль — Highrise Heist', desc: 'Твои статистика, рейтинг, достижения, реплеи партий, Victory City.' },
    en: { title: 'Profile — Highrise Heist', desc: 'Your stats, rating, achievements, match replays, Victory City.' },
  },
  settings: {
    ru: { title: 'Настройки — Highrise Heist', desc: 'Темы, звуки, язык, уведомления, управление аккаунтом.' },
    en: { title: 'Settings — Highrise Heist', desc: 'Themes, sounds, language, notifications, account management.' },
  },
  blog: {
    ru: { title: 'Блог — Highrise Heist', desc: 'Разборы стратегий, новости разработки, интервью с игроками, гайды по AI.' },
    en: { title: 'Blog — Highrise Heist', desc: 'Strategy breakdowns, dev news, player interviews, AI guides.' },
  },
  changelog: {
    ru: { title: 'Changelog — Highrise Heist', desc: 'История изменений, новые фичи, патчи баланса, обновления AI.' },
    en: { title: 'Changelog — Highrise Heist', desc: 'Release notes, new features, balance patches, AI updates.' },
  },
  openings: {
    ru: { title: 'Аналитика дебютов — Highrise Heist', desc: 'Статистика по дебютам, разветвления, win-rate первых ходов, тренды.' },
    en: { title: 'Opening analytics — Highrise Heist', desc: 'Opening stats, branching, first-move win-rates, trends.' },
  },
  goldenrush: {
    ru: { title: 'Golden Rush — Highrise Heist', desc: 'Режим на 4 игрока на поле крестом из 9 стоек. Hot-seat демо против AI или офлайн с друзьями.' },
    en: { title: 'Golden Rush — Highrise Heist', desc: '4-player mode on a 9-stand cross. Hot-seat demo against AI or offline with friends.' },
  },
  'goldenrush-online': {
    ru: { title: 'Golden Rush Online — Highrise Heist', desc: 'Онлайн-режим на 4 игрока: 2v2 команды или 4-FFA. Матчмейкинг по рейтингу, центральная золотая стойка.' },
    en: { title: 'Golden Rush Online — Highrise Heist', desc: 'Online 4-player mode: 2v2 teams or 4-FFA. Ranked matchmaking, golden center stand.' },
  },
  'goldenrush-top': {
    ru: { title: 'Golden Rush Топ — Highrise Heist', desc: 'Лидерборд Golden Rush: лучшие игроки недели, сезона и всего времени.' },
    en: { title: 'Golden Rush Top — Highrise Heist', desc: 'Golden Rush leaderboard: top players of the week, season and all-time.' },
  },
  privacy: {
    ru: { title: 'Политика конфиденциальности — Highrise Heist', desc: 'Какие данные собираем, зачем, как хранятся. GDPR, 152-ФЗ.' },
    en: { title: 'Privacy Policy — Highrise Heist', desc: 'What data we collect, why, how it is stored. GDPR compliant.' },
  },
  terms: {
    ru: { title: 'Условия использования — Highrise Heist', desc: 'Правила использования сервиса, права и обязанности пользователей.' },
    en: { title: 'Terms of Service — Highrise Heist', desc: 'Terms of use, user rights and responsibilities.' },
  },
}

// Хлебные крошки per-route.
function buildBreadcrumb(tab, lang) {
  const base = lang === 'en' ? '/en' : ''
  const home = { name: 'Highrise Heist', url: `${SITE}${base || '/'}` }
  const map = {
    game:               [{ name: 'Play',             url: `${SITE}${base}/game` }],
    online:             [{ name: 'Online',           url: `${SITE}${base}/online` }],
    puzzles:            [{ name: 'Puzzles',          url: `${SITE}${base}/puzzles` }],
    rules:              [{ name: 'Rules',            url: `${SITE}${base}/rules` }],
    profile:            [{ name: 'Profile',          url: `${SITE}${base}/profile` }],
    blog:               [{ name: 'Blog',             url: `${SITE}${base}/blog` }],
    openings:           [{ name: 'Openings',         url: `${SITE}${base}/openings` }],
    settings:           [{ name: 'Settings',         url: `${SITE}${base}/settings` }],
    changelog:          [{ name: 'Changelog',        url: `${SITE}${base}/changelog` }],
    goldenrush:         [{ name: 'Golden Rush',      url: `${SITE}${base}/goldenrush` }],
    'goldenrush-online':[{ name: 'Golden Rush',      url: `${SITE}${base}/goldenrush` }, { name: 'Online', url: `${SITE}${base}/goldenrush-online` }],
    'goldenrush-top':   [{ name: 'Golden Rush',      url: `${SITE}${base}/goldenrush` }, { name: 'Top',    url: `${SITE}${base}/goldenrush-top` }],
    privacy:            [{ name: 'Privacy',          url: `${SITE}${base}/privacy` }],
    terms:              [{ name: 'Terms',            url: `${SITE}${base}/terms` }],
  }
  return [home, ...(map[tab] || [])]
}

/**
 * Возвращает SEO-данные для текущего tab+lang. Если route неизвестен —
 * возвращает landing fallback.
 */
export function getSeo(tab, lang) {
  const route = ROUTES[tab] || ROUTES.landing
  const l = lang === 'en' ? 'en' : 'ru'
  const data = route[l] || route.ru
  const base = lang === 'en' ? '/en' : ''
  const path = tab === 'landing' ? (base + '/') : `${base}/${tab}`
  const altRu = tab === 'landing' ? '/' : `/${tab}`
  const altEn = tab === 'landing' ? '/en/' : `/en/${tab}`
  return {
    title:       data.title,
    description: data.desc,
    canonical:   `${SITE}${path}`,
    ogTitle:     data.title,
    ogDescr:     data.desc,
    ogUrl:       `${SITE}${path}`,
    ogImage:     DEFAULT_OG,
    alternates: [
      { hreflang: 'ru',        href: `${SITE}${altRu}` },
      { hreflang: 'en',        href: `${SITE}${altEn}` },
      { hreflang: 'x-default', href: `${SITE}${altRu}` },
    ],
    breadcrumb: buildBreadcrumb(tab, lang),
  }
}

/**
 * Применяет SEO-данные к DOM <head>. Патчит существующие теги или создаёт
 * новые. Вызывается из useEffect при смене tab/lang. Идемпотентно.
 */
export function applySeo(seo) {
  if (typeof document === 'undefined') return

  document.title = seo.title

  setMetaByName('description',       seo.description)
  setMetaByProp('og:title',          seo.ogTitle)
  setMetaByProp('og:description',    seo.ogDescr)
  setMetaByProp('og:url',            seo.ogUrl)
  setMetaByProp('og:image',          seo.ogImage)
  setMetaByName('twitter:title',     seo.ogTitle)
  setMetaByName('twitter:description', seo.ogDescr)
  setMetaByName('twitter:image',     seo.ogImage)

  setLinkRel('canonical', null, seo.canonical)

  // Удаляем старые hreflang-альтернативы и ставим свежие.
  document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach(el => el.remove())
  for (const alt of seo.alternates) {
    const link = document.createElement('link')
    link.setAttribute('rel', 'alternate')
    link.setAttribute('hreflang', alt.hreflang)
    link.setAttribute('href', alt.href)
    document.head.appendChild(link)
  }

  // BreadcrumbList JSON-LD — пересоздаём в теге с id="seo-breadcrumb".
  let bc = document.getElementById('seo-breadcrumb')
  if (!bc) {
    bc = document.createElement('script')
    bc.type = 'application/ld+json'
    bc.id = 'seo-breadcrumb'
    document.head.appendChild(bc)
  }
  bc.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: seo.breadcrumb.map((b, i) => ({
      '@type': 'ListItem', position: i + 1, name: b.name, item: b.url,
    })),
  })

  // Также ставим <html lang="…"> в соответствие выбранному языку — важно для Яндекса.
  try {
    const lang = seo.canonical.includes('/en/') || seo.canonical.endsWith('/en') ? 'en' : 'ru'
    document.documentElement.setAttribute('lang', lang)
  } catch {}
}

// ─── DOM helpers ────────────────────────────────────────────────

function setMetaByName(name, content) {
  let el = document.head.querySelector(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setMetaByProp(property, content) {
  let el = document.head.querySelector(`meta[property="${property}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('property', property)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setLinkRel(rel, hreflang, href) {
  const selector = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]:not([hreflang])`
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    if (hreflang) el.setAttribute('hreflang', hreflang)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}
