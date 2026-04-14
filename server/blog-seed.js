/**
 * Сидинг блог-постов.
 *
 * Новый релиз = один файл в server/blog-posts/v<NNN>.js + одна строка импорта
 * ниже + одна запись в массив BLOG_POSTS + обновить PINNED_SLUG.
 *
 * При старте сервера:
 *   1. Новые посты добавляются по slug.
 *   2. УЖЕ существующие посты обновляются: title/body/tag перезаписываются
 *      из файлов. Это нужно чтобы редакторские правки в файлах долетали
 *      на прод (раньше existing постов скипались — правки терялись).
 *      pinned/created_at не трогаем — пин управляется PINNED_SLUG ниже,
 *      created_at должна остаться оригинальной.
 *   3. Пин жёстко перестанавливается на PINNED_SLUG — админ-пины через
 *      PUT /api/admin/blog не переживут рестарт — сознательный trade-off
 *      ради того чтобы пин всегда совпадал с текущим релизом.
 *
 * Статические импорты (не readdirSync) — чтобы IDE подсвечивал опечатки
 * и чтобы seedBlogPosts оставался синхронным (db.js вызывает без await).
 */

import v34 from './blog-posts/v34.js'
import v35 from './blog-posts/v35.js'
import v450 from './blog-posts/v450.js'
import v451 from './blog-posts/v451.js'
import v460 from './blog-posts/v460.js'
import v461 from './blog-posts/v461.js'
import v462 from './blog-posts/v462.js'
import v470 from './blog-posts/v470.js'
import v530 from './blog-posts/v530.js'
import v561 from './blog-posts/v561.js'
import v570 from './blog-posts/v570.js'
import v572 from './blog-posts/v572.js'

export const PINNED_SLUG = 'v572-arena-races'

export const BLOG_POSTS = [
  v34, v35,
  v450, v451, v460, v461, v462, v470,
  v530, v561, v570, v572,
]

export function seedBlogPosts(db) {
  const exists = db.prepare('SELECT 1 FROM blog_posts WHERE slug = ?')
  const insert = db.prepare(
    'INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned, published, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?)'
  )
  const update = db.prepare(
    'UPDATE blog_posts SET title_ru = ?, title_en = ?, body_ru = ?, body_en = ?, tag = ?, updated_at = datetime(\'now\') WHERE slug = ?'
  )
  let added = 0, updated = 0
  for (const p of BLOG_POSTS) {
    if (exists.get(p.slug)) {
      update.run(p.title_ru, p.title_en || '', p.body_ru, p.body_en || '', p.tag || 'release', p.slug)
      updated++
    } else {
      insert.run(
        p.slug, p.title_ru, p.title_en || '',
        p.body_ru, p.body_en || '',
        p.tag || 'release',
        p.created_at || new Date().toISOString().slice(0, 19).replace('T', ' ')
      )
      added++
    }
  }
  db.prepare('UPDATE blog_posts SET pinned = CASE WHEN slug = ? THEN 1 ELSE 0 END').run(PINNED_SLUG)
  console.log('Блог: добавлено ' + added + ', обновлено ' + updated + ', запинен ' + PINNED_SLUG)
}
