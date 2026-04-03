/**
 * Маскот Snappy — енот-строитель
 * Позы: hero, wave, point, sad, shock, celebrate, think
 * Размеры: standard (160px), large (320px), full (724px)
 */

const POSES = {
  hero: '/mascot/hero.webp',
  wave: '/mascot/wave.webp',
  point: '/mascot/point.webp',
  sad: '/mascot/sad.webp',
  shock: '/mascot/shock.webp',
  celebrate: '/mascot/celebrate.webp',
  think: '/mascot/think.webp',
}

const POSES_LG = {
  hero: '/mascot/hero-lg.webp',
  wave: '/mascot/wave-lg.webp',
  point: '/mascot/point-lg.webp',
  sad: '/mascot/sad-lg.webp',
  shock: '/mascot/shock-lg.webp',
  celebrate: '/mascot/celebrate-lg.webp',
  think: '/mascot/think-lg.webp',
}

const POSES_FULL = {
  wave: '/mascot/wave-full.webp',
  point: '/mascot/point-full.webp',
  sad: '/mascot/sad-full.webp',
  shock: '/mascot/shock-full.webp',
  celebrate: '/mascot/celebrate-full.webp',
  think: '/mascot/think-full.webp',
}

export default function Mascot({ pose = 'hero', size = 80, large, full, className = '', style = {}, animate = true }) {
  const src = full ? (POSES_FULL[pose] || POSES_LG[pose] || POSES[pose])
    : large ? (POSES_LG[pose] || POSES[pose])
    : (POSES[pose] || POSES.hero)
  return (
    <img
      src={src}
      alt="Snappy"
      width={size}
      height={size}
      loading="lazy"
      className={`mascot ${animate ? 'mascot-bounce' : ''} ${className}`}
      style={{ objectFit: 'contain', userSelect: 'none', pointerEvents: 'none', ...style }}
    />
  )
}
