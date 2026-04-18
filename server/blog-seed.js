/**
 * Сидинг блог-постов.
 *
 * Блог = single source of truth из репо. Всё что не описано в BLOG_POSTS
 * массиве — удаляется при старте.
 *
 * При старте сервера:
 *   1. Новые посты добавляются (INSERT).
 *   2. Существующие обновляются (UPDATE title/body/tag/created_at) — правки
 *      в файлах долетают до прода. ВАЖНО: created_at также обновляется,
 *      иначе хронология ленты разъезжается (старые версии с датами первого
 *      INSERT окажутся «новыми»).
 *   3. Посты со slug ВНЕ BLOG_POSTS удаляются.
 *   4. Пин жёстко перестанавливается на PINNED_SLUG.
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
import v595 from './blog-posts/v595.js'
import v600 from './blog-posts/v600.js'

export const PINNED_SLUG = 'v595-golden-rush'

export const BLOG_POSTS = [
  v34, v35,
  v450, v451, v460, v461, v462, v470,
  v530, v561, v570, v572,
  v595, v600,
]

export function seedBlogPosts(db) {
  const exists = db.prepare('SELECT 1 FROM blog_posts WHERE slug = ?')
  const insert = db.prepare(
    'INSERT INTO blog_posts (slug, title_ru, title_en, body_ru, body_en, tag, pinned, published, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?)'
  )
  // Обновляем всё включая created_at — синхронизируем хронологию с файлами.
  const update = db.prepare(
    'UPDATE blog_posts SET title_ru = ?, title_en = ?, body_ru = ?, body_en = ?, tag = ?, created_at = ?, updated_at = datetime(\'now\') WHERE slug = ?'
  )

  let added = 0, updated = 0
  for (const p of BLOG_POSTS) {
    const created = p.created_at || new Date().toISOString().slice(0, 19).replace('T', ' ')
    if (exists.get(p.slug)) {
      update.run(p.title_ru, p.title_en || '', p.body_ru, p.body_en || '', p.tag || 'release', created, p.slug)
      updated++
    } else {
      insert.run(
        p.slug, p.title_ru, p.title_en || '',
        p.body_ru, p.body_en || '',
        p.tag || 'release',
        created,
      )
      added++
    }
  }

  // Удаляем всё что не в BLOG_POSTS массиве.
  const allowedSlugs = BLOG_POSTS.map(p => p.slug)
  const placeholders = allowedSlugs.map(() => '?').join(',')
  const deleted = db.prepare(`DELETE FROM blog_posts WHERE slug NOT IN (${placeholders})`).run(...allowedSlugs)

  // Пин на текущий релиз.
  db.prepare('UPDATE blog_posts SET pinned = CASE WHEN slug = ? THEN 1 ELSE 0 END').run(PINNED_SLUG)

  console.log('Блог: добавлено ' + added + ', обновлено ' + updated + ', удалено лишних ' + deleted.changes + ', запинен ' + PINNED_SLUG)
}
