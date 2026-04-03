/**
 * MascotLoader — загрузка с енотом Снуппи
 * Заменяет стандартные "Загрузка..." на анимированного маскота
 */

import Mascot from './Mascot'

export default function MascotLoader({ size = 48, pose = 'hero', text }) {
  return (
    <div style={{ textAlign: 'center', padding: '32px 16px' }}>
      <div style={{ animation: 'float 1.5s ease-in-out infinite' }}>
        <Mascot pose={pose} size={size} animate={false} />
      </div>
      {text && <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 8 }}>{text}</div>}
    </div>
  )
}
