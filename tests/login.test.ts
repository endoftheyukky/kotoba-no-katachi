// POST /admin/login and the /admin gate: attempts are taken before a password is checked,
// one address cannot close the door for everyone, and the sheet opens only at the site's address.
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, test } from 'node:test'
import { onRequest as gate } from '../functions/admin/_middleware'
import { onRequestPost as login } from '../functions/admin/login'
import { ATTEMPTS, authenticated, COOKIE } from '../server/auth'
import { env, everything, loginPost, ORIGIN, PASSWORD, post } from './helpers'

type Ctx = Parameters<typeof login>[0]
const call = (fn: typeof login, request: Request, e: Env, next = async () => new Response('the sheet')) =>
  fn({ request, env: e, params: {}, data: {}, functionPath: '', next, waitUntil: () => {} } as unknown as Ctx) as Promise<Response>

// PBKDF2 runs are counted where they happen
const subtle = crypto.subtle
const derive = subtle.deriveBits.bind(subtle)
let derived = 0

describe('admin login', () => {
  beforeEach(() => {
    derived = 0
    subtle.deriveBits = ((...args: Parameters<typeof derive>) => (derived++, derive(...args))) as typeof subtle.deriveBits
  })
  afterEach(() => {
    subtle.deriveBits = derive
  })

  test('the right password opens a session, as before', async () => {
    const e = env()
    const r = await call(login, loginPost(PASSWORD), e)
    assert.equal(r.status, 303)
    assert.equal(r.headers.get('location'), '/admin/')
    const cookie = r.headers.get('set-cookie')!
    assert.match(cookie, new RegExp(`^${COOKIE}=v1\\.\\d{13}\\.[A-Za-z0-9_-]{22}\\.[A-Za-z0-9_-]{43}; Path=/admin; Max-Age=43200; HttpOnly; Secure; SameSite=Strict$`))
    const token = cookie.split(';')[0]
    assert.equal(await authenticated(new Request(`${ORIGIN}/admin/`, { headers: { cookie: token } }), e), true)
    assert.equal(derived, 1)
  })

  test('passwords sent together from one address: no more are checked than its allowance', async () => {
    const e = env()
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => call(login, loginPost(`wrong password ${i}`), e).then((r) => r.status)))
    assert.equal(results.filter((s) => s === 401).length, ATTEMPTS.perAddress)
    assert.equal(results.filter((s) => s === 429).length, 20 - ATTEMPTS.perAddress)
    // an attempt refused is refused before PBKDF2
    assert.equal(derived, ATTEMPTS.perAddress)
  })

  test('passwords sent together from many addresses: no more are checked than the overall allowance', async () => {
    const e = env()
    const n = ATTEMPTS.overall + 20
    const results = await Promise.all(
      Array.from({ length: n }, (_, i) => call(login, loginPost(`wrong password ${i}`, `192.0.2.${i + 1}`), e).then((r) => r.status)),
    )
    assert.equal(results.filter((s) => s === 401).length, ATTEMPTS.overall)
    assert.equal(results.filter((s) => s === 429).length, n - ATTEMPTS.overall)
    assert.equal(derived, ATTEMPTS.overall)
  })

  test('one address using up its attempts does not lock the admin out', async () => {
    const e = env()
    for (let i = 0; i < 12; i++) await call(login, loginPost(`wrong password ${i}`, '203.0.113.66'), e)
    // and empty passwords take nothing from anyone, however many
    for (let i = 0; i < 50; i++) assert.equal((await call(login, loginPost('', '203.0.113.67'), e)).status, 401)
    const r = await call(login, loginPost(PASSWORD, '198.51.100.20'), e)
    assert.equal(r.status, 303)
  })

  test('a right password gives its attempt back, and does not clear anyone else’s', async () => {
    const e = env()
    for (let i = 0; i < ATTEMPTS.perAddress - 1; i++) await call(login, loginPost(`wrong ${i}`, '198.51.100.30'), e)
    for (let i = 0; i < 3; i++) await call(login, loginPost(`wrong ${i}`, '198.51.100.31'), e)
    assert.equal((await call(login, loginPost(PASSWORD, '198.51.100.30'), e)).status, 303)
    // the address still has the one attempt it had left, not a fresh five
    assert.equal((await call(login, loginPost('wrong again', '198.51.100.30'), e)).status, 401)
    assert.equal((await call(login, loginPost('wrong again', '198.51.100.30'), e)).status, 429)
    const all = e.DB.sqlite.prepare("SELECT hits FROM limits WHERE key LIKE 'login:%:all'").get() as { hits: number }
    assert.equal(all.hits, ATTEMPTS.perAddress - 1 + 3 + 1)
  })

  test('the form is small: a larger body is not read', async () => {
    const e = env()
    const r = await call(login, loginPost('x'.repeat(5_000)), e)
    assert.equal(r.status, 413)
    const chunked = post('/admin/login', 'password=' + 'y'.repeat(5_000), { 'content-type': 'application/x-www-form-urlencoded' })
    chunked.headers.delete('content-length')
    assert.equal((await call(login, chunked, e)).status, 413)
    assert.equal(derived, 0)
  })

  test('only the form the login page sends is read', async () => {
    const e = env()
    const r = await call(login, post('/admin/login', JSON.stringify({ password: PASSWORD }), { 'content-type': 'application/json' }), e)
    assert.equal(r.status, 400)
    const foreign = new Request(`${ORIGIN}/admin/login`, {
      method: 'POST',
      body: new URLSearchParams({ password: PASSWORD }).toString(),
      headers: { origin: 'https://elsewhere.example', 'content-type': 'application/x-www-form-urlencoded' },
    })
    assert.equal((await call(login, foreign, e)).status, 403)
    assert.equal(derived, 0)
  })

  test('the address is not kept', async () => {
    const e = env()
    await call(login, loginPost('wrong', '198.51.100.123'), e)
    assert.ok(!everything(e.DB).includes('198.51.100'))
  })
})

describe('admin gate', () => {
  test('opens only at the site’s own address, or on this computer', async () => {
    const e = env()
    const at = (url: string) => call(gate, new Request(url), e).then((r) => r.status)
    assert.equal(await at(`${ORIGIN}/admin/`), 303)
    assert.equal(await at(`${ORIGIN}/admin/login`), 200)
    assert.equal(await at('http://localhost:8788/admin/login'), 200)
    assert.equal(await at('http://127.0.0.1:8788/admin/login'), 200)
    assert.equal(await at('https://0123abcd.kotoba-no-katachi.pages.dev/admin/login'), 404)
    assert.equal(await at('https://release.kotoba-no-katachi.pages.dev/admin/api/stats'), 404)
    assert.equal(await at('https://kotoba-no-katachi.pages.dev.evil.example/admin/login'), 404)
  })

  test('responses refused for their address still carry the admin headers', async () => {
    const r = await call(gate, new Request('https://0123abcd.kotoba-no-katachi.pages.dev/admin/'), env())
    assert.equal(r.headers.get('x-frame-options'), 'DENY')
    assert.equal(r.headers.get('cache-control'), 'no-store')
  })
})
