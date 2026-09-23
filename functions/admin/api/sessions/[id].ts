// GET /admin/api/sessions/<session id> — one visit: its browser, its span, and which of that browser's visits it was.
import { UUID } from '../../../../src/archive/protocol'
import { idParam } from '../../../../server/admin'
import { json } from '../../../../server/http'

export const onRequestGet: PagesFunction<Env, 'id'> = async ({ params, env }) => {
  const id = idParam(params.id)
  if (!UUID.test(id)) return json({ error: 'id' }, 400)
  const session = await env.DB.prepare('SELECT id, visitor_id, first_at, last_at, generations FROM sessions WHERE id = ?1')
    .bind(id)
    .first<{ visitor_id: string; first_at: number }>()
  if (!session) return json({ error: 'not found' }, 404)
  const order = await env.DB.prepare('SELECT COUNT(*) AS n FROM sessions WHERE visitor_id = ?1 AND first_at <= ?2')
    .bind(session.visitor_id, session.first_at)
    .first<{ n: number }>()
  return json({ ...session, number: order?.n ?? 1 })
}
