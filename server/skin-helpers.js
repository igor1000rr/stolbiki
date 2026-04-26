/**
 * skin-helpers — pure-функции для работы со скинами игроков.
 *
 * Вынесено из ws.js чтобы можно было покрыть unit-тестами без поднятия
 * WebSocketServer и всех зависимостей. Эти функции не имеют side-effects
 * и работают с обычными JS-объектами.
 */

/**
 * Snappy Block — детектор коллизии скинов блоков у двух игроков.
 * Часть Customization Rework Часть 2 (по ТЗ Александра, апр 2026):
 * "Snappy Block если у двух игроков одинаковые скины — Меняй блоки!"
 *
 * Сравниваем по blocks (новый ключ от SkinShop v5.5+) и chipStyle
 * (legacy ключ для backward-compat). Игнорируем stands и background —
 * Александр явно про блоки писал. Если хотя бы у одного игрока нет
 * skins-объекта или ключа blocks/chipStyle — считаем что коллизии нет.
 *
 * @param {Object|null} skinsA — { blocks?, chipStyle?, stands?, background? }
 * @param {Object|null} skinsB — то же
 * @returns {boolean} true если оба игрока выбрали один и тот же скин блоков
 */
export function detectSkinCollision(skinsA, skinsB) {
  if (!skinsA || !skinsB) return false
  const a = skinsA.blocks || skinsA.chipStyle
  const b = skinsB.blocks || skinsB.chipStyle
  if (!a || !b) return false
  return a === b
}
