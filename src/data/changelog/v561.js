export default {
  version: '5.6.1',
  date: '2026-04-14',
  title_ru: 'Paчка мелких починок',
  title_en: 'Bunch of small fixes',
  changes_ru: [
    { type: 'fix', text: 'Уведомления «ваш ход» больше не ведут на старый домен после ребрендинга' },
    { type: 'fix', text: 'Реже просит перезайти после долгого простоя — починено обновление сессии' },
    { type: 'fix', text: 'Город побед больше не падает при клике на здание сразу после открытия вкладки' },
    { type: 'fix', text: 'Поиск онлайн-соперника перестал иногда «терять» свободные комнаты' },
    { type: 'fix', text: 'Небольшие правки с памятью на сервере и кешем в браузере — меньше странностей при долгой игре' },
  ],
  changes_en: [
    { type: 'fix', text: 'Your-turn notifications no longer point to the old domain after the rebrand' },
    { type: 'fix', text: 'Less often asks to log in again after long idle — fixed session refresh' },
    { type: 'fix', text: 'Victory City no longer crashes on a building click right after opening the tab' },
    { type: 'fix', text: 'Matchmaking stopped occasionally losing free rooms' },
    { type: 'fix', text: 'Small server-memory and browser-cache cleanups — fewer oddities during long sessions' },
  ],
}
