// GET /admin/api/generations/<id> — one record, with the size of its snapshot.
import { COLUMNS, idParam } from '../../../../server/admin'
import { json } from '../../../../server/http'

export const onRequestGet: PagesFunction<Env, 'id'> = async ({ params, env }) => {
  const id = idParam(params.id)
  if (!/^[0-9a-f-]{36}$/.test(id)) return json({ error: 'id' }, 400)
  const cols = COLUMNS.split(', ')
    .map((c) => `g.${c}`)
    .join(', ')
  const row = await env.DB.prepare(`SELECT ${cols}, s.bytes FROM generations g LEFT JOIN snapshots s ON s.generation_id = g.id WHERE g.id = ?1`)
    .bind(id)
    .first()
  return row ? json(row) : json({ error: 'not found' }, 404)
}
