// /admin/api: the overview (the last days, the words written most) and a list that leaves one browser out.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { describe, test } from 'node:test'
import { onRequestGet as list } from '../functions/admin/api/generations/index'
import { onRequestGet as overview } from '../functions/admin/api/overview'
import { testD1, type TestD1 } from './d1'
import { env, ORIGIN } from './helpers'

type Ctx = Parameters<typeof list>[0]
const get = async <T>(fn: typeof list, path: string, e: Env): Promise<{ status: number; body: T }> => {
  const r = (await fn({ request: new Request(ORIGIN + path), env: e, params: {}, data: {}, functionPath: '', next: async () => new Response(), waitUntil: () => {} } as unknown as Ctx)) as Response
  return { status: r.status, body: (await r.json()) as T }
}

const DAY = 86_400_000

function put(db: TestD1, created_at: number, title: string, visitor_id: string): void {
  db.sqlite
    .prepare(
      `INSERT INTO generations (id, created_at, client_created_at, visitor_id, session_id, title, reading, source, generator_version, output_hash)
       VALUES (?, ?, NULL, ?, ?, ?, '', 'manual', 'v1', ?)`,
    )
    .run(randomUUID(), created_at, visitor_id, randomUUID(), title, '0'.repeat(64))
}

interface Overview {
  today: string
  days: Array<{ day: string; generations: number; visitors: number }>
  words: Array<{ title: string; generations: number; visitors: number }>
}

describe('admin overview', () => {
  test('the last days, in the viewer’s own days, with the browsers of each', async () => {
    const db = testD1()
    const [a, b] = [randomUUID(), randomUUID()]
    const jst = 9 * 3_600_000
    // midnight today in Japan, as the server's clock sees it
    const midnight = Math.floor((Date.now() + jst) / DAY) * DAY - jst
    put(db, midnight + 60_000, '森', a) // today, just after midnight in Japan (still yesterday in UTC)
    put(db, midnight + 120_000, '森', b)
    put(db, midnight - 60_000, '雨', a) // yesterday, just before midnight in Japan
    put(db, midnight - 20 * DAY, '古い', a) // outside the fourteen days
    const { status, body } = await get<Overview>(overview, '/admin/api/overview?tz=-540&days=14', env(db))
    assert.equal(status, 200)
    assert.equal(body.days.length, 14)
    assert.equal(body.days.at(-1)!.day, body.today)
    assert.deepEqual(body.days.at(-1), { day: body.today, generations: 2, visitors: 2 })
    assert.equal(body.days.at(-2)!.generations, 1)
    assert.equal(body.days.reduce((n, d) => n + d.generations, 0), 3)
    // the words: by how many browsers wrote them, over every day
    assert.deepEqual(body.words[0], { title: '森', generations: 2, visitors: 2 })
    assert.deepEqual(
      body.words.map((w) => w.title),
      ['森', '古い', '雨'],
    )
  })

  test('one browser left out of both', async () => {
    const db = testD1()
    const [me, other] = [randomUUID(), randomUUID()]
    put(db, Date.now() - 1000, '試験', me)
    put(db, Date.now() - 2000, '試験', me)
    put(db, Date.now() - 3000, '森', other)
    const { body } = await get<Overview>(overview, `/admin/api/overview?tz=0&exclude=${me}`, env(db))
    assert.deepEqual(
      body.words.map((w) => w.title),
      ['森'],
    )
    assert.equal(body.days.at(-1)!.generations, 1)
  })

  test('only a timezone and an id it can read', async () => {
    const e = env(testD1())
    assert.equal((await get(overview, '/admin/api/overview?tz=1000', e)).status, 400)
    assert.equal((await get(overview, '/admin/api/overview?tz=abc', e)).status, 400)
    assert.equal((await get(overview, '/admin/api/overview?exclude=1%27%20OR%201', e)).status, 400)
    assert.equal((await get(overview, '/admin/api/overview', e)).status, 200)
  })
})

describe('admin list', () => {
  test('exclude leaves one browser out, and nothing else', async () => {
    const db = testD1()
    const [me, other] = [randomUUID(), randomUUID()]
    put(db, Date.now() - 1000, '試験', me)
    put(db, Date.now() - 2000, '森', other)
    put(db, Date.now() - 3000, '雨', other)
    const all = await get<{ items: Array<{ title: string }> }>(list, '/admin/api/generations', env(db))
    assert.equal(all.body.items.length, 3)
    const others = await get<{ items: Array<{ title: string; visitor_id: string }> }>(list, `/admin/api/generations?exclude=${me}`, env(db))
    assert.deepEqual(
      others.body.items.map((r) => r.title),
      ['森', '雨'],
    )
    assert.equal((await get(list, '/admin/api/generations?exclude=nope', env(db))).status, 400)
  })
})
