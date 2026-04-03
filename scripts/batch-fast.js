/**
 * Быстрый batch self-play — оптимизированный для скорости
 * Минимум аллокаций, прямой доступ к массивам
 */
const NUM_STANDS = 10, MAX_CHIPS = 11, GOLDEN = 0

class FastGame {
  constructor() {
    this.stands = Array.from({length: NUM_STANDS}, () => [])
    this.closed = {}
    this.player = 0
    this.turn = 0
    this.over = false
  }

  topGroup(i) {
    const s = this.stands[i]
    if (!s.length) return [-1, 0]
    const c = s[s.length - 1]
    let n = 1
    for (let j = s.length - 2; j >= 0 && s[j] === c; j--) n++
    return [c, n]
  }

  place(stand, count) {
    for (let i = 0; i < count; i++) this.stands[stand].push(this.player)
    this.checkClose(stand)
  }

  transfer(from, to) {
    const [, grpSize] = this.topGroup(from)
    const moved = this.stands[from].splice(-grpSize)
    this.stands[to].push(...moved)
    this.checkClose(to)
  }

  checkClose(i) {
    if (this.stands[i].length >= MAX_CHIPS && !(i in this.closed)) {
      this.closed[i] = this.stands[i][this.stands[i].length - 1]
      if (Object.values(this.closed).filter(v => v === 0).length >= 6 ||
          Object.values(this.closed).filter(v => v === 1).length >= 6 ||
          Object.keys(this.closed).length >= NUM_STANDS) {
        this.over = true
      }
    }
  }

  openStands() {
    const r = []
    for (let i = 0; i < NUM_STANDS; i++) if (!(i in this.closed)) r.push(i)
    return r
  }

  randomMove() {
    const open = this.openStands()
    if (!open.length) { this.over = true; return }
    
    // 50% transfer, 50% place
    if (Math.random() < 0.4 && this.turn > 0) {
      // Try transfer
      for (let attempt = 0; attempt < 5; attempt++) {
        const src = open[Math.floor(Math.random() * open.length)]
        const [grpColor, grpSize] = this.topGroup(src)
        if (grpSize === 0) continue
        const dst = open[Math.floor(Math.random() * open.length)]
        if (dst === src) continue
        const [dstTop] = this.topGroup(dst)
        if (this.stands[dst].length > 0 && dstTop !== grpColor) continue
        const newTotal = this.stands[dst].length + grpSize
        if (newTotal >= MAX_CHIPS && grpColor !== this.player) continue
        this.transfer(src, dst)
        this.turn++
        this.player = 1 - this.player
        return
      }
    }
    
    // Place
    const maxPlace = this.turn === 0 ? 1 : 3
    const count = 1 + Math.floor(Math.random() * maxPlace)
    const numStands = Math.min(1 + Math.floor(Math.random() * 2), open.length)
    
    let placed = 0
    for (let s = 0; s < numStands && placed < count; s++) {
      const stand = open[Math.floor(Math.random() * open.length)]
      const space = MAX_CHIPS - this.stands[stand].length
      if (space <= 0) continue
      const n = Math.min(count - placed, space)
      this.place(stand, n)
      placed += n
    }
    if (placed === 0) {
      // Fallback: place 1 on any open stand with space
      for (const s of open) {
        if (this.stands[s].length < MAX_CHIPS) { this.place(s, 1); placed = 1; break }
      }
    }
    if (placed === 0) { this.over = true; return }
    this.turn++
    this.player = 1 - this.player
  }
}

// ═══ Main ═══
const TOTAL = parseInt(process.argv[2]) || 100000
console.log(`═══ Fast Self-Play: ${TOTAL.toLocaleString()} партий ═══`)
const t0 = Date.now()

let p0w = 0, p1w = 0, draws = 0, totalMoves = 0
let gold0 = 0, gold1 = 0
let sweeps = 0, tight = 0
const scoreDist = Array(11).fill(0)

for (let i = 0; i < TOTAL; i++) {
  const g = new FastGame()
  let moves = 0
  while (!g.over && moves < 200) { g.randomMove(); moves++ }
  
  const c0 = Object.values(g.closed).filter(v => v === 0).length
  const c1 = Object.values(g.closed).filter(v => v === 1).length
  
  if (c0 >= 6) p0w++
  else if (c1 >= 6) p1w++
  else draws++
  
  totalMoves += moves
  scoreDist[c0]++
  if (g.closed[0] === 0) gold0++
  else if (g.closed[0] === 1) gold1++
  if (c0 === 10 || c1 === 10) sweeps++
  if (g.over && Math.abs(c0 - c1) <= 2) tight++
  
  if ((i + 1) % 10000 === 0) {
    const spd = Math.round((i + 1) / ((Date.now() - t0) / 1000))
    process.stdout.write(`\r  ${(i+1).toLocaleString()} / ${TOTAL.toLocaleString()} — ${spd.toLocaleString()} партий/сек`)
  }
}

const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
const total = p0w + p1w + draws
console.log(`\n\n═══ РЕЗУЛЬТАТЫ (${elapsed}с, ${Math.round(total/elapsed*10)/10} партий/сек) ═══`)
console.log(`P0: ${p0w} (${(p0w/total*100).toFixed(1)}%) | P1: ${p1w} (${(p1w/total*100).toFixed(1)}%) | Ничья: ${draws} (${(draws/total*100).toFixed(1)}%)`)
console.log(`Ходов avg: ${(totalMoves/total).toFixed(1)}`)
console.log(`Золотая: P0 ${(gold0/total*100).toFixed(1)}%, P1 ${(gold1/total*100).toFixed(1)}%`)
console.log(`Разгромы: ${(sweeps/total*100).toFixed(1)}% | Плотные: ${(tight/total*100).toFixed(1)}%`)
console.log(`\nСчёт P0:`)
scoreDist.forEach((c, i) => {
  if (c > 0) console.log(`  ${i}: ${'█'.repeat(Math.round(c/total*80))} ${(c/total*100).toFixed(1)}%`)
})
