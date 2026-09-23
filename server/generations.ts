/**
 * POST /api/generations — one poem written on the public page.
 *
 * Nothing the page sends is taken on trust:
 *   - the body must be this site's own JSON, small, and exactly the fields of
 *     a GenerationEvent (archive/protocol.ts);
 *   - the title and reading must already be what the page itself would make of
 *     them (title.ts), within the page's own limits;
 *   - the snapshot must be exactly the renderer's vocabulary (archive/svg.ts),
 *     and the output hash is computed here and must match the page's;
 *   - the time recorded is this server's; the browser's clock is a note only.
 *
 * Nothing about the request itself is kept: no address, no user agent, no
 * headers, no location. What is stored is listed in migrations/0001_archive.sql.
 *
 * The page never waits for this and never learns how it went: every outcome a
 * browser can cause is 204 (with a short reason in X-Archive, for testing), so
 * a refused or failed record makes no noise in anyone's console.
 */
import { GENERATORS, HASH, SOURCES, UUID, type GenerationEvent } from '../src/archive/protocol'
import { canonicalSVG, checkSVG, MAX_SVG, sha256 } from '../src/archive/svg'
import { MAX_TITLE, normalizeTitle } from '../src/title'
import { empty, gzip, readText, sameOrigin } from './http'

/** the body: a snapshot and a few short strings */
const MAX_BODY = MAX_SVG + 16_000
const FIELDS = ['visitor_id', 'session_id', 'title', 'reading', 'source', 'generator_version', 'output_hash', 'svg', 'client_created_at']

/** enough for anyone writing poems by hand; a flood is dropped, the page is not affected */
export const LIMITS = {
  perSessionPerMinute: 20,
  perVisitorPerHour: 120,
  /** all visitors together, per UTC day: a record writes ~13 rows (indexes, counters), so this keeps
   *  D1's free 100 000 rows written per day clear */
  perDay: 6_000,
}

const done = (reason: string) => empty(204, { 'x-archive': reason })

type Checked = { ok: true; event: GenerationEvent } | { ok: false; reason: string }

function check(data: unknown): Checked {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, reason: 'shape' }
  const d = data as Record<string, unknown>
  const keys = Object.keys(d)
  if (keys.length !== FIELDS.length || !FIELDS.every((k) => k in d)) return { ok: false, reason: 'fields' }
  const { visitor_id, session_id, title, reading, source, generator_version, output_hash, svg, client_created_at } = d
  if (typeof visitor_id !== 'string' || !UUID.test(visitor_id)) return { ok: false, reason: 'visitor' }
  if (typeof session_id !== 'string' || !UUID.test(session_id)) return { ok: false, reason: 'session' }
  if (typeof title !== 'string' || typeof reading !== 'string') return { ok: false, reason: 'title' }
  // the same words the page would have written: normalized, one line, at most MAX_TITLE characters
  const input = normalizeTitle({ text: title, reading })
  if (typeof input === 'string' || input.text !== title || (input.reading ?? '') !== reading) return { ok: false, reason: 'title' }
  if (Array.from(title).length > MAX_TITLE || /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(title)) return { ok: false, reason: 'title' }
  if (reading && (reading.length > 64 || !/^[\p{Script=Hiragana}\p{Script=Katakana}ー・]+$/u.test(reading))) return { ok: false, reason: 'reading' }
  if (!SOURCES.includes(source as never)) return { ok: false, reason: 'source' }
  if (!GENERATORS.includes(generator_version as never)) return { ok: false, reason: 'generator' }
  if (typeof output_hash !== 'string' || !HASH.test(output_hash)) return { ok: false, reason: 'hash' }
  if (typeof svg !== 'string' || svg.length > MAX_SVG) return { ok: false, reason: 'svg' }
  if (typeof client_created_at !== 'number' || !Number.isFinite(client_created_at)) return { ok: false, reason: 'time' }
  return { ok: true, event: d as unknown as GenerationEvent }
}

export async function acceptGeneration(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return empty(405, { allow: 'POST' })
  // only this site's own pages write here (a browser always says where a POST comes from)
  if (!sameOrigin(request)) return empty(403)
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return empty(415)
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY) return empty(413)

  let data: unknown
  try {
    const text = await readText(request, MAX_BODY)
    if (text === null) return empty(413)
    data = JSON.parse(text)
  } catch {
    return empty(400)
  }

  const checked = check(data)
  if (!checked.ok) return done(`refused:${checked.reason}`)
  const e = checked.event

  // the snapshot: canonical, the renderer's vocabulary only, and the hash computed here
  const svg = canonicalSVG(e.svg)
  const verdict = checkSVG(svg)
  if (verdict !== true) {
    console.warn('archive: snapshot refused', verdict)
    return done('refused:snapshot')
  }
  const hash = await sha256(svg)
  if (hash !== e.output_hash) return done('refused:hash')

  const now = Date.now()
  // the browser's clock, kept only when it is plausibly right
  const clientAt = Math.abs(e.client_created_at - now) < 7 * 86_400_000 ? Math.round(e.client_created_at) : null
  const day = `day:${new Date(now).toISOString().slice(0, 10)}`
  const db = env.DB

  try {
    const [daily, perSession, perVisitor] = await db.batch<{ n: number }>([
      db.prepare('SELECT value AS n FROM counters WHERE name = ?1').bind(day),
      db.prepare('SELECT COUNT(*) AS n FROM generations WHERE session_id = ?1 AND created_at > ?2').bind(e.session_id, now - 60_000),
      db.prepare('SELECT COUNT(*) AS n FROM generations WHERE visitor_id = ?1 AND created_at > ?2').bind(e.visitor_id, now - 3_600_000),
    ])
    const n = (r: D1Result<{ n: number }>) => r.results[0]?.n ?? 0
    if (n(daily) >= LIMITS.perDay) return done('dropped:day')
    if (n(perSession) >= LIMITS.perSessionPerMinute) return done('dropped:session')
    if (n(perVisitor) >= LIMITS.perVisitorPerHour) return done('dropped:visitor')

    const id = crypto.randomUUID()
    const snapshot = await gzip(svg)
    await db.batch([
      db
        .prepare(
          `INSERT INTO generations (id, created_at, client_created_at, visitor_id, session_id, title, reading, source, generator_version, output_hash)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
        )
        .bind(id, now, clientAt, e.visitor_id, e.session_id, e.title, e.reading, e.source, e.generator_version, hash),
      db.prepare('INSERT INTO snapshots (generation_id, svg_gz, bytes) VALUES (?1, ?2, ?3)').bind(id, snapshot, svg.length),
      db
        .prepare(
          `INSERT INTO visitors (id, first_at, last_at, generations) VALUES (?1, ?2, ?2, 1)
           ON CONFLICT (id) DO UPDATE SET last_at = excluded.last_at, generations = generations + 1`,
        )
        .bind(e.visitor_id, now),
      db
        .prepare(
          `INSERT INTO sessions (id, visitor_id, first_at, last_at, generations) VALUES (?1, ?2, ?3, ?3, 1)
           ON CONFLICT (id) DO UPDATE SET last_at = excluded.last_at, generations = generations + 1`,
        )
        .bind(e.session_id, e.visitor_id, now),
      // the totals the admin sheet shows, kept as counters so that showing them reads three rows
      db.prepare(`UPDATE counters SET value = value + 1 WHERE name = 'generations'`),
      db
        .prepare(`UPDATE counters SET value = value + 1 WHERE name = 'visitors' AND (SELECT generations FROM visitors WHERE id = ?1) = 1`)
        .bind(e.visitor_id),
      db
        .prepare(`UPDATE counters SET value = value + 1 WHERE name = 'sessions' AND (SELECT generations FROM sessions WHERE id = ?1) = 1`)
        .bind(e.session_id),
      db
        .prepare(`INSERT INTO counters (name, value) VALUES (?1, 1) ON CONFLICT (name) DO UPDATE SET value = value + 1`)
        .bind(day),
    ])
    return done('stored')
  } catch (err) {
    console.error('archive: not stored', err)
    return done('error')
  }
}
