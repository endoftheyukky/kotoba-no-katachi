// GET /admin/api/visitors/<visitor id> — when a browser first and last wrote, and its sessions in order.
import { UUID } from '../../../../src/archive/protocol'
import { idParam } from '../../../../server/admin'
import { json } from '../../../../server/http'

export const onRequestGet: PagesFunction<Env, 'id'> = async ({ params, env }) => {
  const id = idParam(params.id)
  if (!UUID.test(id)) return json({ error: 'id' }, 400)
  const [visitor, sessions] = await env.DB.batch([
    env.DB.prepare('SELECT id, first_at, last_at, generations FROM visitors WHERE id = ?1').bind(id),
    env.DB.prepare('SELECT id, first_at, last_at, generations FROM sessions WHERE visitor_id = ?1 ORDER BY first_at ASC LIMIT 1000').bind(id),
  ])
  if (!visitor.results[0]) return json({ error: 'not found' }, 404)
  return json({ ...visitor.results[0], sessions: sessions.results })
}
