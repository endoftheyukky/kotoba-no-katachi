// GET /admin/api/generations — a page of records, newest (or oldest) first.
//   order=newest|oldest  visitor=<uuid>  session=<uuid>  source=manual
//   q=<part of a title>  cursor=<created_at>:<id>  limit=1..100 (40)
// Snapshots are not included: each is fetched on its own, when it is seen.
import { SOURCES, UUID } from '../../../../src/archive/protocol'
import { COLUMNS } from '../../../../server/admin'
import { json } from '../../../../server/http'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const q = new URL(request.url).searchParams
  const oldest = q.get('order') === 'oldest'
  const limit = Math.min(100, Math.max(1, Math.trunc(Number(q.get('limit'))) || 40))
  const where: string[] = []
  const binds: unknown[] = []
  const add = (sql: string, ...values: unknown[]) => {
    where.push(
      sql.replace(/\?/g, () => {
        binds.push(values.shift())
        return `?${binds.length}`
      }),
    )
  }
  const visitor = q.get('visitor')
  if (visitor) {
    if (!UUID.test(visitor)) return json({ error: 'visitor' }, 400)
    add('visitor_id = ?', visitor)
  }
  const session = q.get('session')
  if (session) {
    if (!UUID.test(session)) return json({ error: 'session' }, 400)
    add('session_id = ?', session)
  }
  const source = q.get('source')
  if (source) {
    if (!SOURCES.includes(source as never)) return json({ error: 'source' }, 400)
    add('source = ?', source)
  }
  const text = (q.get('q') ?? '').trim()
  if (text) add('instr(title, ?) > 0', text.slice(0, 32))
  const cursor = q.get('cursor')
  if (cursor) {
    const m = /^(\d{13}):([0-9a-f-]{36})$/.exec(cursor)
    if (!m) return json({ error: 'cursor' }, 400)
    add(oldest ? '(created_at, id) > (?, ?)' : '(created_at, id) < (?, ?)', Number(m[1]), m[2])
  }
  const dir = oldest ? 'ASC' : 'DESC'
  const sql = `SELECT ${COLUMNS} FROM generations ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at ${dir}, id ${dir} LIMIT ${limit + 1}`
  const { results } = await env.DB.prepare(sql)
    .bind(...binds)
    .all<{ id: string; created_at: number }>()
  const items = results.slice(0, limit)
  const last = items.at(-1)
  return json({ items, next: results.length > limit && last ? `${last.created_at}:${last.id}` : null })
}
