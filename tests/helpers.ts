/** Requests and environments for the unit tests: all local, nothing is sent anywhere. */
import { pbkdf2Sync, randomBytes, randomUUID } from 'node:crypto'
import { sha256 } from '../src/archive/svg'
import { testD1, type TestD1 } from './d1'

export const ORIGIN = 'https://kotoba-no-katachi.pages.dev'

export const SECRET = 'test-secret-'.padEnd(48, 'x')

/** a dummy admin password and its stored form, with few iterations so that tests are quick */
export const PASSWORD = 'correct horse battery staple'
export function passwordHash(password = PASSWORD, iterations = 1_000): string {
  const salt = randomBytes(16)
  const hash = pbkdf2Sync(password, salt, iterations, 32, 'sha256')
  return `pbkdf2:sha256:${iterations}:${salt.toString('base64')}:${hash.toString('base64')}`
}

export function env(db: TestD1 = testD1()): Env & { DB: TestD1 } {
  return { DB: db, SESSION_SECRET: SECRET, ADMIN_PASSWORD_HASH: passwordHash() }
}

/** the smallest snapshot the renderer could write */
export const SMALL_SVG =
  '<svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet" text-rendering="geometricPrecision"><g><text x="500" y="500" font-size="120">あ</text></g></svg>'

export async function generation(
  svg = SMALL_SVG,
  over: Partial<Record<'visitor_id' | 'session_id' | 'title' | 'reading', string>> = {},
): Promise<Record<string, unknown>> {
  return {
    visitor_id: randomUUID(),
    session_id: randomUUID(),
    title: 'あ',
    reading: '',
    source: 'manual',
    generator_version: 'v3',
    output_hash: await sha256(svg),
    svg,
    client_created_at: Date.now(),
    ...over,
  }
}

export function post(path: string, body: string, headers: Record<string, string> = {}, origin = ORIGIN): Request {
  return new Request(origin + path, { method: 'POST', body, headers: { origin, ...headers } })
}

export const archivePost = (event: unknown, address = '203.0.113.7') =>
  post('/api/generations', JSON.stringify(event), { 'content-type': 'application/json', 'cf-connecting-ip': address })

export const loginPost = (password: string, address = '198.51.100.9', origin = ORIGIN) =>
  post('/admin/login', new URLSearchParams({ password }).toString(), { 'content-type': 'application/x-www-form-urlencoded', 'cf-connecting-ip': address }, origin)

/** every text value in every table: to show what was and was not kept */
export function everything(db: TestD1): string {
  const tables = db.sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]
  return tables.map((t) => JSON.stringify(db.sqlite.prepare(`SELECT * FROM "${t.name}"`).all(), (_, v) => (v instanceof Uint8Array ? '<blob>' : v))).join('\n')
}
