// GET /admin/api/overview — how the archive grows: the pages and browsers of
// each of the last days (the viewer's own days), and the words written by the
// most browsers.
//   tz=<minutes, as Date#getTimezoneOffset gives them>  days=1..31 (14)
//   exclude=<visitor uuid>: leave one browser out (the viewer's own)
// The days read only their own rows (generations_by_time); the words read every row.
import { UUID } from '../../../src/archive/protocol'
import { json } from '../../../server/http'

const DAY = 86_400_000

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const q = new URL(request.url).searchParams
  const tz = Number(q.get('tz') ?? 0)
  if (!Number.isInteger(tz) || Math.abs(tz) > 840) return json({ error: 'tz' }, 400)
  const days = Math.min(31, Math.max(1, Math.trunc(Number(q.get('days'))) || 14))
  const exclude = q.get('exclude') ?? ''
  if (exclude && !UUID.test(exclude)) return json({ error: 'exclude' }, 400)

  // the viewer's clock is the server's plus `shift`; a day starts at the viewer's midnight
  const shift = -tz * 60_000
  const today = Math.floor((Date.now() + shift) / DAY) * DAY - shift
  const since = today - (days - 1) * DAY
  const dayOf = (t: number) => new Date(t + shift).toISOString().slice(0, 10)

  const counted = await (exclude
    ? env.DB.prepare(
        `SELECT date((created_at + ?1) / 1000, 'unixepoch') AS day, COUNT(*) AS generations, COUNT(DISTINCT visitor_id) AS visitors
         FROM generations WHERE created_at >= ?2 AND visitor_id != ?3 GROUP BY day`,
      ).bind(shift, since, exclude)
    : env.DB.prepare(
        `SELECT date((created_at + ?1) / 1000, 'unixepoch') AS day, COUNT(*) AS generations, COUNT(DISTINCT visitor_id) AS visitors
         FROM generations WHERE created_at >= ?2 GROUP BY day`,
      ).bind(shift, since)
  ).all<{ day: string; generations: number; visitors: number }>()
  const byDay = new Map(counted.results.map((r) => [r.day, r]))
  const list = Array.from({ length: days }, (_, i) => {
    const day = dayOf(since + i * DAY)
    const r = byDay.get(day)
    return { day, generations: r?.generations ?? 0, visitors: r?.visitors ?? 0 }
  })

  const words = await (exclude
    ? env.DB.prepare(
        `SELECT title, COUNT(*) AS generations, COUNT(DISTINCT visitor_id) AS visitors FROM generations
         WHERE visitor_id != ?1 GROUP BY title ORDER BY visitors DESC, generations DESC, title LIMIT 20`,
      ).bind(exclude)
    : env.DB.prepare(
        `SELECT title, COUNT(*) AS generations, COUNT(DISTINCT visitor_id) AS visitors FROM generations
         GROUP BY title ORDER BY visitors DESC, generations DESC, title LIMIT 20`,
      )
  ).all<{ title: string; generations: number; visitors: number }>()

  return json({ today: dayOf(today), days: list, words: words.results })
}
