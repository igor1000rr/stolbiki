import { useEffect, useState } from 'react'
import { S, api, fmtNum } from './_utils'
import { Metric, MiniBarChart } from './_shared'

export function TrainingTab() {
  const [data, setData] = useState(null)
  const [deleting, setDeleting] = useState(false)

  function load() { api('/admin/training').then(setData) }
  useEffect(() => { load() }, [])

  async function cleanup(days) {
    setDeleting(true)
    const r = await api(`/admin/training?olderThan=${days}`, { method: 'DELETE' })
    alert(`Удалено: ${r.deleted} записей`)
    setDeleting(false)
    load()
  }

  if (!data) return <div style={S.emptyState}>Загрузка...</div>

  return (
    <div>
      <div style={S.grid(4)}>
        <Metric value={fmtNum(data.total)} label="Всего записей" color="var(--p1)" />
        <Metric value={`${data.sizeMB}MB`} label="Размер данных" color="var(--accent)" />
        {data.byMode.map(m => (
          <Metric key={m.mode} value={m.count} label={m.mode || 'unknown'} color="var(--green)" sub={`~${Math.round(m.avgMoves)} ходов/игра`} />
        ))}
      </div>

      {data.byDay.length > 0 && (
        <div style={{ ...S.card, marginTop: 16 }}>
          <div style={S.cardTitle}>Сбор данных (30 дней)</div>
          <MiniBarChart data={data.byDay} color="var(--p1)" />
        </div>
      )}

      <div style={{ ...S.card, marginTop: 16 }}>
        <div style={S.cardTitle}>Очистка</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={S.btn('danger')} disabled={deleting} onClick={() => cleanup(90)}>Старше 90 дней</button>
          <button style={S.btn('danger')} disabled={deleting} onClick={() => cleanup(30)}>Старше 30 дней</button>
        </div>
      </div>

      <div style={{ ...S.card, marginTop: 16 }}>
        <div style={S.cardTitle}>Доучивание GPU-нейросети</div>
        <div style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.8 }}>
          <p>Данные партий игроков используются для дообучения AI. Текущая сеть: <b>ResNet 840K params (v500)</b></p>
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '12px 14px', margin: '10px 0', fontFamily: 'monospace', fontSize: 11, color: '#a8a4b8', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
{`# 1. Скачать БД с VPS
scp root@178.212.12.71:/opt/stolbiki-api/data/stolbiki.db .

# 2. Запустить доучивание (Windows, нужен PyTorch + NVIDIA GPU)
cd gpu_train
py -3.12 retrain.py --db stolbiki.db --model gpu_checkpoint/model_v500.pt

# 3. Скрипт автоматически:
#    - Загрузит партии из БД
#    - Закодирует позиции (107 фич)
#    - Дообучит сеть (30 эпох)
#    - Экспортирует gpu_weights.json

# 4. Задеплоить новые веса
cd ..
git add src/engine/gpu_weights.json
git commit -m "update: AI дообучен на N партиях игроков"
git push`}
          </div>
          <p style={{ fontSize: 11, color: 'var(--ink3)' }}>Или через API (без скачивания БД):</p>
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 14px', fontFamily: 'monospace', fontSize: 11, color: '#a8a4b8', whiteSpace: 'pre-wrap' }}>
{`py -3.12 retrain.py --url https://snatch-highrise.com --token ВАШ_JWT_ТОКЕН`}
          </div>
        </div>
      </div>
    </div>
  )
}
