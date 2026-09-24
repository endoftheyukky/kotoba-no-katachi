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
 *   attempts             a password is checked only after an attempt is taken
 *                        (server/limits.ts): 5 per connecting address and 30 for
 *                        everyone together in each 15 minutes. Taken, not counted
 *                        afterwards, so passwords sent together cannot pass the
 *                        limit; a right password gives its attempt back. One
 *                        address alone cannot close the door for everyone. The
 *                        address is not kept: only a keyed mark of it, for its
 *                        15 minutes.
 *
 * Without both secrets the admin sheet stays closed (503).
 */
import { giveBackStatement, mark, pruneStatement, take } from './limits'

export const COOKIE = '__Secure-kotoba-admin'
const TTL = 12 * 3_600_000

export const ATTEMPTS = { window: 15 * 60_000, perAddress: 5, overall: 30 }

/** the longest password checked; anything longer, or empty, is wrong without being checked */
export const MAX_PASSWORD = 256

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
  if (!password || password.length > MAX_PASSWORD) return false
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

/**
 * Take one attempt, for this address and for everyone, before a password is
 * checked. Returns the rows it was taken from, or null when none is left (and
 * then the overall count is not touched: one address cannot use up everyone's).
 */
export async function takeAttempt(request: Request, env: Env): Promise<string[] | null> {
  const now = Date.now()
  const w = Math.floor(now / ATTEMPTS.window)
  const expires = (w + 1) * ATTEMPTS.window
  const address = await mark(env, request, 'login', w)
  const own = `login:${w}:${address ?? 'unmarked'}`
  const all = `login:${w}:all`
  if (!(await take(env.DB, { key: own, limit: ATTEMPTS.perAddress, expires }))) return null
  if (!(await take(env.DB, { key: all, limit: ATTEMPTS.overall, expires }))) return null
  return [own, all]
}

/** the right password: its attempt is given back, and windows that are over are cleared */
export async function attemptSucceeded(env: Env, rows: string[]): Promise<void> {
  await env.DB.batch([...rows.map((key) => giveBackStatement(env.DB, key)), pruneStatement(env.DB, Date.now())])
}
