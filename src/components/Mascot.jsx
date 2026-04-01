/**
 * Маскот Снуппи — енот-строитель
 * Позы: hero, wave, point, sad, shock, celebrate
 */

const POSES = {
  hero: '/mascot/hero.webp',
  wave: '/mascot/wave.webp',
  point: '/mascot/point.webp',
  sad: '/mascot/sad.webp',
  shock: '/mascot/shock.webp',
  celebrate: '/mascot/celebrate.webp',
}

const POSES_LG = {
  hero: '/mascot/hero-lg.webp',
  wave: '/mascot/wave-lg.webp',
  point: '/mascot/point-lg.webp',
  sad: '/mascot/sad-lg.webp',
  shock: '/mascot/shock-lg.webp',
  celebrate: '/mascot/celebrate-lg.webp',
}

export default function Mascot({ pose = 'hero', size = 80, large, className = '', style = {}, animate = true }) {
  const src = large ? (POSES_LG[pose] || POSES[pose]) : (POSES[pose] || POSES.hero)
  return (
    <img
      src={src}
      alt="Снуппи"
      width={size}
      height={size}
      loading="lazy"
      className={`mascot ${animate ? 'mascot-bounce' : ''} ${className}`}
      style={{ objectFit: 'contain', userSelect: 'none', pointerEvents: 'none', ...style }}
    />
  )
}
