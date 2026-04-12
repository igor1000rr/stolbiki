  async function saveBuildingOnWin(ns) {
    if (mode === 'pvp' || mode === 'spectate' || mode === 'spectate-online') return
    if (!API.isLoggedIn()) return
    const myColor = mode === 'online' ? (onlineRef.current?.myColor ?? humanPlayer) : humanPlayer
    if (ns.winner !== myColor) return
    const s0 = ns.countClosed(0), s1 = ns.countClosed(1)
    const result = (s0 === s1) ? 'draw_won' : 'win'
    const opponentName = mode === 'ai' ? 'Snappy' : (onlinePlayers?.[1 - myColor] || null)

    // Получаем активный скин блоков для сохранения в здание
    const CHIP_STYLE_TO_ID = { classic: 'blocks_classic', flat: 'blocks_flat', round: 'blocks_round', glass: 'blocks_glass', metal: 'blocks_metal', candy: 'blocks_candy', pixel: 'blocks_pixel', neon: 'blocks_neon', glow: 'blocks_glow' }
    let activeSkinId = 'blocks_classic'
    try {
      const storedSettings = JSON.parse(localStorage.getItem('stolbiki_settings') || '{}')
      const cs = storedSettings.chipStyle || 'classic'
      activeSkinId = cs.startsWith('blocks_') ? cs : (CHIP_STYLE_TO_ID[cs] || 'blocks_classic')
    } catch {}

    try {
      await fetch('/api/buildings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('stolbiki_token')}` },
        body: JSON.stringify({
          stands_snapshot: ns.stands.map((chips, idx) => ({ idx, chips, owner: ns.closed[idx] ?? null })),
          result, is_ai: mode === 'ai', ai_difficulty: mode === 'ai' ? difficultyRef.current : null,
          opponent_name: opponentName, player_skin_id: activeSkinId, background_id: null,
        }),
      })
    } catch {}
  }
