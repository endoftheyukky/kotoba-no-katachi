/**
 * The admin sheet's door: one password, checked on the server, and a signed
 * session cookie. No account, no user table, nothing in the page's script.
 *
 *   ADMIN_PASSWORD_HASH  pbkdf2:sha256:<iterations>:<salt>:<hash> (base64), a
 *                        Cloudflare secret set by `npm run admin:password`; the
 *                        password itself is never stored anywhere
 *   SESSION_SECRET       random, a Cloudflare secret; signs the cookie
 *   cookie               __Secure-kotoba-admin, HttpOnly, Secure,
 *                        SameSite=Strict, Path=/admin, 12 hours; stateless
 *                        (changing SESSION_SECRET ends every session)
 *   throttle             after 10 wrong passwords in 15 minutes, every login is
 *                        refused until the 15 minutes are over. It counts for
 *                        everyone together: no address is kept to tell people apart.
 *
 * Without both secrets the admin sheet stays closed (503).
 */

export const COOKIE = '__Secure-kotoba-admin'
const TTL = 12 * 3_600_000
const WINDOW = 15 * 60_000
const MAX_FAILURES = 10

const enc = new TextEncoder()

const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const toB64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64url = (s: string) => fromB64(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4))

/** equal bytes, in a time that does not depend on where they differ */
function same(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]
  return d === 0
}

export const configured = (env: Env) =>
  !!env.ADMIN_PASSWORD_HASH?.startsWith('pbkdf2:sha256:') &&(env.SESSION_SECRET?.length ?? 0) >= 32

export async function passwordMatches(password: string, stored: string): Promise<boolean> {
  const [scheme, algo, iter, salt, hash] = stored.split(':')
  const iterations = Number(iter)
  if (scheme !== 'pbkdf2' || algo !== 'sha256' || !Number.isInteger(iterations) || iterations < 1_000 || iterations > 100_000) return false
  if (!password || password.length > 256) return false
  try {
    const expected = fromB64(hash)
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(salt), iterations }, key, expected.length * 8)
    return same(new Uint8Array(bits), expected)
  } catch {
    return false
  }
}

const signingKey = (env: Env) =>
  crypto.subtle.importKey('raw', enc.encode(env.SESSION_SECRET!), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])

/** a new session: v1.<expires>.<nonce>.<signature> */
export async function issueSession(env: Env): Promise<string> {
  const payload = `v1.${Date.now() + TTL}.${toB64url(crypto.getRandomValues(new Uint8Array(16)))}`
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await signingKey(env), enc.encode(payload)))
  return `${payload}.${toB64url(sig)}`
}

function cookieValue(request: Request, name: string): string | null {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim()
  }
  return null
}

export async function authenticated(request: Request, env: Env): Promise<boolean> {
  if (!configured(env)) return false
  const token = cookieValue(request, COOKIE)
  const m = token && /^(v1\.(\d{13})\.[A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/.exec(token)
  if (!m) return false
  if (Number(m[2]) < Date.now()) return false
  try {
    return await crypto.subtle.verify('HMAC', await signingKey(env), fromB64url(m[3]), enc.encode(m[1]))
  } catch {
    return false
  }
}

export const sessionCookie = (token: string) => `${COOKIE}=${token}; Path=/admin; Max-Age=${TTL / 1000}; HttpOnly; Secure; SameSite=Strict`
export const clearedCookie = `${COOKIE}=; Path=/admin; Max-Age=0; HttpOnly; Secure; SameSite=Strict`

export async function throttled(db: D1Database): Promise<boolean> {
  const row = await db.prepare('SELECT window_start, failures FROM admin_throttle WHERE id = 1').first<{ window_start: number; failures: number }>()
  return !!row && Date.now() - row.window_start < WINDOW && row.failures >= MAX_FAILURES
}

export async function loginFailed(db: D1Database): Promise<void> {
  const now = Date.now()
  await db
    .prepare(
      `INSERT INTO admin_throttle (id, window_start, failures) VALUES (1, ?1, 1)
       ON CONFLICT (id) DO UPDATE SET
         failures = CASE WHEN ?1 - window_start < ?2 THEN failures + 1 ELSE 1 END,
         window_start = CASE WHEN ?1 - window_start < ?2 THEN window_start ELSE ?1 END`,
    )
    .bind(now, WINDOW)
    .run()
}

export async function loginSucceeded(db: D1Database): Promise<void> {
  await db.prepare('DELETE FROM admin_throttle WHERE id = 1').run()
}
