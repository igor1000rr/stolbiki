/**
 * MobileGameBar — DEPRECATED после header reorg (апр 2026, коммит 217825d).
 *
 * Заменён на GameModeBar.jsx (текстовая строка по центру) + кнопки
 * Settings/CityStyle в GameActionsTop.jsx. Оставлен как пустой компонент
 * чтобы не сломать старые импорты если они где-то остались. Удалить
 * физически через MCP нельзя — только переписать в стаб.
 *
 * Если ты видишь этот файл — он не используется. Удали при следующей
 * чистке через локальный git rm.
 */
export default function MobileGameBar() {
  return null
}
