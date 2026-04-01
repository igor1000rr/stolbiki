/**
 * Реэкспорт движка из server/game-engine.js
 * Единственный источник правил — server/game-engine.js
 * Vite резолвит путь при сборке.
 */
export {
  NUM_STANDS, GOLDEN_STAND, MAX_CHIPS, MAX_PLACE, MAX_PLACE_STANDS, FIRST_TURN_MAX,
  GameState, getValidTransfers, getValidPlacements, applyAction, getLegalActions
} from '../../server/game-engine.js'
