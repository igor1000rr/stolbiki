/**
 * 10M Self-Play + стратегический анализ
 */
const NUM_STANDS = 10, MAX_CHIPS = 11

class G {
  constructor() {
    this.s = Array.from({length: NUM_STANDS}, () => [])
    this.c = {} // closed
    this.p = 0  // player
    this.t = 0  // turn
    this.o = false // over
  }
  tg(i) { const s=this.s[i]; if(!s.length)return[-1,0]; const c=s[s.length-1]; let n=1; for(let j=s.length-2;j>=0&&s[j]===c;j--)n++; return[c,n] }
  ck(i) {
    if(this.s[i].length>=MAX_CHIPS&&!(i in this.c)) {
      this.c[i]=this.s[i][this.s[i].length-1]
      const c0=Object.values(this.c).filter(v=>v===0).length
      const c1=Object.values(this.c).filter(v=>v===1).length
      if(c0>=6||c1>=6||Object.keys(this.c).length>=NUM_STANDS) this.o=true
    }
  }
  op() { const r=[]; for(let i=0;i<NUM_STANDS;i++) if(!(i in this.c)) r.push(i); return r }
  
  move() {
    const open = this.op()
    if(!open.length){this.o=true;return -1}
    
    // Transfer attempt (40%)
    if(Math.random()<0.4 && this.t>0) {
      for(let a=0;a<5;a++) {
        const src=open[(Math.random()*open.length)|0]
        const[gc,gs]=this.tg(src)
        if(gs===0)continue
        const dst=open[(Math.random()*open.length)|0]
        if(dst===src)continue
        const[dt]=this.tg(dst)
        if(this.s[dst].length>0&&dt!==gc)continue
        if(this.s[dst].length+gs>=MAX_CHIPS&&gc!==this.p)continue
        const moved=this.s[src].splice(-gs)
        this.s[dst].push(...moved)
        this.ck(dst)
        this.t++;this.p=1-this.p
        return 1 // transfer
      }
    }
    
    // Place
    const mx=this.t===0?1:3
    const cnt=1+((Math.random()*mx)|0)
    let placed=0
    for(let i=0;i<2&&placed<cnt;i++) {
      const st=open[(Math.random()*open.length)|0]
      const sp=MAX_CHIPS-this.s[st].length
      if(sp<=0)continue
      const n=Math.min(cnt-placed,sp)
      for(let j=0;j<n;j++)this.s[st].push(this.p)
      this.ck(st)
      placed+=n
    }
    if(!placed) {
      for(const st of open) {
        if(this.s[st].length<MAX_CHIPS){this.s[st].push(this.p);this.ck(st);placed=1;break}
      }
    }
    if(!placed){this.o=true;return -1}
    this.t++;this.p=1-this.p
    return 0 // place
  }
}

// ═══ Стратегический анализ ═══
const TOTAL = parseInt(process.argv[2]) || 9000000
console.log(`═══ 10M Self-Play: ${TOTAL.toLocaleString()} партий ═══\n`)
const t0 = Date.now()

// Основная статистика
let p0w=0,p1w=0,draws=0,totalMoves=0
let gold0=0,gold1=0,goldNone=0
let sweeps=0,tight=0

// Стратегический анализ
const scoreDist = Array(11).fill(0)
const movesDist = {} // длина партии → count
const firstMoveWins = {place:0,placeTotal:0} // первый ход place vs transfer
const closingOrder = Array(10).fill(0) // какая стойка закрывается первой
const goldenFirst = {p0:0,p1:0,total:0} // кто чаще захватывает золотую первым
const comebacks = {from2down:0,from3down:0,total:0} // камбэки
const avgCloseTime = Array(10).fill(0) // на каком ходе закрывается каждая стойка
const avgCloseCount = Array(10).fill(0)

for(let i=0;i<TOTAL;i++) {
  const g=new G()
  let moves=0
  let firstClose=-1, firstClosePlayer=-1
  const closeTurns = {}
  const scoreHistory = []
  
  while(!g.o && moves<200) {
    const prevClosed = Object.keys(g.c).length
    g.move()
    moves++
    
    // Отслеживаем закрытия
    if(Object.keys(g.c).length > prevClosed) {
      const newlyClosed = Object.keys(g.c).filter(k => !closeTurns[k])
      for(const k of newlyClosed) {
        closeTurns[k] = moves
        avgCloseTime[+k] += moves
        avgCloseCount[+k]++
        if(firstClose===-1) { firstClose=+k; firstClosePlayer=g.c[+k] }
      }
    }
    
    // Score tracking каждые 20 ходов для камбэков
    if(moves%20===0) {
      const c0=Object.values(g.c).filter(v=>v===0).length
      const c1=Object.values(g.c).filter(v=>v===1).length
      scoreHistory.push([c0,c1])
    }
  }
  
  const c0=Object.values(g.c).filter(v=>v===0).length
  const c1=Object.values(g.c).filter(v=>v===1).length
  const winner = c0>=6?0:c1>=6?1:c0>c1?0:c1>c0?1:-1
  
  if(winner===0)p0w++;else if(winner===1)p1w++;else draws++
  totalMoves+=moves
  scoreDist[c0]++
  if(g.c[0]===0)gold0++;else if(g.c[0]===1)gold1++;else goldNone++
  if(c0===10||c1===10)sweeps++
  if(g.o&&Math.abs(c0-c1)<=2)tight++
  
  // Длина
  const bucket = Math.floor(moves/10)*10
  movesDist[bucket] = (movesDist[bucket]||0)+1
  
  // Первая закрытая стойка
  if(firstClose>=0) closingOrder[firstClose]++
  
  // Золотая первой
  if(0 in closeTurns) {
    goldenFirst.total++
    if(g.c[0]===0) goldenFirst.p0++; else goldenFirst.p1++
  }
  
  // Камбэки: был позади на 2+ и выиграл
  if(winner>=0 && scoreHistory.length>=2) {
    const mid = scoreHistory[Math.floor(scoreHistory.length/2)]
    if(mid) {
      const deficit = winner===0 ? mid[1]-mid[0] : mid[0]-mid[1]
      if(deficit>=2) comebacks.from2down++
      if(deficit>=3) comebacks.from3down++
    }
    comebacks.total++
  }
  
  if((i+1)%500000===0) {
    const spd=Math.round((i+1)/((Date.now()-t0)/1000))
    const eta=Math.round((TOTAL-i-1)/spd)
    process.stdout.write(`\r  ${((i+1)/1e6).toFixed(1)}M / ${(TOTAL/1e6).toFixed(0)}M — ${(spd/1000).toFixed(0)}K/с — ETA ${eta}с`)
  }
}

const elapsed=((Date.now()-t0)/1000).toFixed(1)
const total=p0w+p1w+draws
const spd=Math.round(total/elapsed*10)/10

console.log(`\n\n${'═'.repeat(60)}`)
console.log(`  РЕЗУЛЬТАТЫ: ${(total/1e6).toFixed(1)}M партий за ${elapsed}с (${(spd/1000).toFixed(1)}K/с)`)
console.log(`${'═'.repeat(60)}`)

console.log(`\n▸ БАЛАНС`)
console.log(`  P0: ${(p0w/total*100).toFixed(2)}% | P1: ${(p1w/total*100).toFixed(2)}% | Draw: ${(draws/total*100).toFixed(2)}%`)
console.log(`  Advantage: ${Math.abs(p0w-p1w)} партий (${(Math.abs(p0w-p1w)/total*100).toFixed(3)}%)`)

console.log(`\n▸ ЗОЛОТАЯ СТОЙКА`)
console.log(`  P0: ${(gold0/total*100).toFixed(2)}% | P1: ${(gold1/total*100).toFixed(2)}% | Не закрыта: ${(goldNone/total*100).toFixed(2)}%`)
if(goldenFirst.total>0) console.log(`  Первая захваченная: P0 ${(goldenFirst.p0/goldenFirst.total*100).toFixed(1)}% | P1 ${(goldenFirst.p1/goldenFirst.total*100).toFixed(1)}%`)

console.log(`\n▸ ДИНАМИКА`)
console.log(`  Avg ходов: ${(totalMoves/total).toFixed(1)}`)
console.log(`  Разгромы (10-0): ${sweeps} (${(sweeps/total*100).toFixed(3)}%)`)
console.log(`  Плотные (±2): ${(tight/total*100).toFixed(1)}%`)
if(comebacks.total>0) {
  console.log(`  Камбэки с -2: ${(comebacks.from2down/comebacks.total*100).toFixed(1)}%`)
  console.log(`  Камбэки с -3: ${(comebacks.from3down/comebacks.total*100).toFixed(1)}%`)
}

console.log(`\n▸ РАСПРЕДЕЛЕНИЕ СЧЁТА P0`)
scoreDist.forEach((c,i)=>{if(c>0){
  const pct=(c/total*100).toFixed(1)
  console.log(`  ${i}: ${'█'.repeat(Math.round(c/total*60))} ${pct}%`)
}})

console.log(`\n▸ ДЛИНА ПАРТИЙ`)
Object.entries(movesDist).sort((a,b)=>+a[0]-+b[0]).forEach(([k,v])=>{
  if(v/total>0.01) console.log(`  ${k}-${+k+9} ходов: ${'█'.repeat(Math.round(v/total*80))} ${(v/total*100).toFixed(1)}%`)
})

console.log(`\n▸ ПЕРВАЯ ЗАКРЫТАЯ СТОЙКА`)
const totalFirst=closingOrder.reduce((a,b)=>a+b,0)
closingOrder.forEach((c,i)=>{if(c>0) console.log(`  Stand ${i}${i===0?' ★':''}: ${(c/totalFirst*100).toFixed(1)}%`)})

console.log(`\n▸ ВРЕМЯ ЗАКРЫТИЯ (avg ход)`)
avgCloseTime.forEach((t,i)=>{if(avgCloseCount[i]>0) console.log(`  Stand ${i}${i===0?' ★':''}: ход ${(t/avgCloseCount[i]).toFixed(0)} (закрыта в ${(avgCloseCount[i]/total*100).toFixed(1)}% партий)`)})
