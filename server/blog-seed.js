/**
 * Сидинг блог-постов.
 *
 * Блог = single source of truth из репо. Всё что не описано в BLOG_POSTS
 * массиве — удаляется при старте. Это упрощает жизнь: правишь файлы → push →
 * рестарт → блог именно такой как в коде.
 *
 * Новый релиз = один файл в server/blog-posts/v<NNN>.js + одна строка импорта
 * ниже + одна запись в массив BLOG_POSTS + обновить PINNED_SLUG.
 *
 * При старте сервера:
 *   1. Новые посты добавляются (INSERT).
 *   2. Существующие обновляются (UPDATE title/body/tag) — правки в файлах
 *      долетают до прода после рестарта.
 *   3. Посты со slug ВНЕ BLOG_POSTS удаляются (включая legacy и админские
 *      добавления через PUT /api/admin/blog — они не переживают рестарт,
 *      сознательный trade-off).
 *   4. Пин жёстко перестанавливается на PINNED_SLUG.
 *
 * Если нужен админский пост на постоянку — добавлять файлом в
 * server/blog-posts/ и в массив ниже.
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

  // Удаляем всё что не в BLOG_POSTS массиве — блог остаётся ровно таким как в репо.
  const allowedSlugs = BLOG_POSTS.map(p => p.slug)
  const placeholders = allowedSlugs.map(() => '?').join(',')
  const deleted = db.prepare(`DELETE FROM blog_posts WHERE slug NOT IN (${placeholders})`).run(...allowedSlugs)

  // Пин на текущий релиз.
  db.prepare('UPDATE blog_posts SET pinned = CASE WHEN slug = ? THEN 1 ELSE 0 END').run(PINNED_SLUG)

  console.log('Блог: добавлено ' + added + ', обновлено ' + updated + ', удалено лишних ' + deleted.changes + ', запинен ' + PINNED_SLUG)
}
