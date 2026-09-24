/**
 * Allowances counted by the server, not by the browser (migrations/0002_limits.sql).
 *
 * The archive's ids are the browser's own and can be made anew for every
 * request, so a limit that must hold whatever the browser says rests on the
 * connecting address instead — without keeping it: the key holds an HMAC of
 * the address and the window, and the row goes when the window is over.
 *
 * An allowance is taken, not checked: one statement increments the count only
 * while it is under its limit and says whether it did, so requests that arrive
 * together cannot all see "one left" and all take it.
 */

const enc = new TextEncoder()

const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/**
 * The address Cloudflare saw the request come from ('' when there is none, as
 * in local tests). An IPv6 address is taken as its /64 network: one connection
 * is usually given a whole /64, and could send each request from another address in it.
 */
export function addressOf(request: Request): string {
  const ip = (request.headers.get('cf-connecting-ip') ?? '').trim().toLowerCase()
  if (!ip.includes(':')) return ip
  const [head, tail = ''] = ip.split('::')
  const left = head ? head.split(':') : []
  const right = tail ? tail.split(':') : []
  const groups = ip.includes('::') ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right] : left
  return `${groups
    .slice(0, 4)
    .map((g) => g.replace(/^0+(?=.)/, ''))
    .join(':')}::/64`
}

/**
 * A mark for this address in this window, or null without SESSION_SECRET.
 * Keyed, because an address alone is easily guessed back from a plain hash.
 */
export async function mark(env: Env, request: Request, purpose: string, window: number): Promise<string | null> {
  if ((env.SESSION_SECRET?.length ?? 0) < 32) return null
  const key = await crypto.subtle.importKey('raw', enc.encode(`limits|${env.SESSION_SECRET}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${purpose}|${window}|${addressOf(request)}`)))
  return b64url(sig.slice(0, 16))
}

export interface Allowance {
  /** the row: <purpose>:<window>:<mark> */
  key: string
  /** at most this many in the window */
  limit: number
  /** when the row may be deleted, ms */
  expires: number
  /** optionally, at most `limit` in each shorter window too; `start` names the current one */
  burst?: { start: number; limit: number }
}

/** the statement that takes one: it returns a row only when the allowance was taken */
export const takeStatement = (db: D1Database, a: Allowance) =>
  db
    .prepare(
      `INSERT INTO limits (key, hits, burst_start, burst_hits, expires) VALUES (?1, 1, ?2, 1, ?3)
       ON CONFLICT (key) DO UPDATE SET
         hits = hits + 1,
         burst_hits = CASE WHEN burst_start = ?2 THEN burst_hits + 1 ELSE 1 END,
         burst_start = ?2
       WHERE hits < ?4 AND (burst_start <> ?2 OR burst_hits < ?5)
       RETURNING hits`,
    )
    .bind(a.key, a.burst?.start ?? 0, a.expires, a.limit, a.burst?.limit ?? a.limit)

/** take one of the allowance; false when none is left (and nothing was counted) */
export async function take(db: D1Database, a: Allowance): Promise<boolean> {
  return (await takeStatement(db, a).first()) !== null
}

/** give one back (a right password is not a failure) */
export const giveBackStatement = (db: D1Database, key: string) =>
  db.prepare('UPDATE limits SET hits = hits - 1, burst_hits = MAX(burst_hits - 1, 0) WHERE key = ?1 AND hits > 0').bind(key)

/** rows whose window is over */
export const pruneStatement = (db: D1Database, now: number) => db.prepare('DELETE FROM limits WHERE expires < ?1').bind(now)
