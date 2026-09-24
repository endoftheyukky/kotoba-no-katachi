// GET /admin/api/generations/<id>/svg — the page as it was drawn, as text.
// Served as plain text (never rendered as a document); the admin sheet checks
// it again before it shows it. A snapshot never changes, so it may be kept.
// One larger than the archive now accepts (stored before its limits) is not sent.
import { MAX_SVG } from '../../../../../src/archive/svg'
import { bytes, idParam } from '../../../../../server/admin'
import { gunzip, json } from '../../../../../server/http'

export const onRequestGet: PagesFunction<Env, 'id'> = async ({ params, env }) => {
  const id = idParam(params.id)
  if (!/^[0-9a-f-]{36}$/.test(id)) return json({ error: 'id' }, 400)
  const row = await env.DB.prepare('SELECT svg_gz, bytes FROM snapshots WHERE generation_id = ?1').bind(id).first<{ svg_gz: unknown; bytes: number }>()
  if (row && row.bytes > MAX_SVG) return json({ error: 'too large' }, 404)
  const data = row && bytes(row.svg_gz)
  if (!data) return json({ error: 'not found' }, 404)
  return new Response(await gunzip(data), {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'private, max-age=31536000, immutable' },
  })
}
