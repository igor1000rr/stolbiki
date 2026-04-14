/**
 * Список версий из папки src/data/changelog/.
 *
 * Новый релиз = один файл src/data/changelog/v<NNN>.js с default export'ом.
 * Vite подхватыт все файлы через import.meta.glob, другие не трогаем.
 * Сортируем по версии (свежее сверху).
 */

const modules = import.meta.glob('./changelog/*.js', { eager: true })
const entries = Object.values(modules).map(m => m.default).filter(Boolean)

entries.sort((a, b) => {
  const av = String(a.version).split('.').map(Number)
  const bv = String(b.version).split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const diff = (bv[i] || 0) - (av[i] || 0)
    if (diff) return diff
  }
  return 0
})

export default entries
