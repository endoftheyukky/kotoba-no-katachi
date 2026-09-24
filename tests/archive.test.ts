// POST /api/generations: what is kept, what is dropped, and that limits hold when requests arrive together.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, test } from 'node:test'
import { MAX_SVG } from '../src/archive/svg'
import { acceptGeneration, LIMITS } from '../server/generations'
import { addressOf } from '../server/limits'
import { testD1 } from './d1'
import { archivePost, env, everything, generation, ORIGIN, SMALL_SVG } from './helpers'

const saved = { ...LIMITS }
const reason = (r: Response) => r.headers.get('x-archive')
const today = () => `day:${new Date().toISOString().slice(0, 10)}`
const count = (db: ReturnType<typeof testD1>, sql: string) => (db.sqlite.prepare(sql).get() as { n: number }).n

describe('archive', () => {
  beforeEach(() => Object.assign(LIMITS, saved))
  afterEach(() => Object.assign(LIMITS, saved))

  test('a poem written on the page is stored', async () => {
    const e = env()
    const r = await acceptGeneration(archivePost(await generation()), e)
    assert.equal(r.status, 204)
    assert.equal(reason(r), 'stored')
    assert.equal(count(e.DB, 'SELECT COUNT(*) AS n FROM generations'), 1)
    assert.equal(count(e.DB, 'SELECT COUNT(*) AS n FROM snapshots'), 1)
    assert.equal(count(e.DB, `SELECT value AS n FROM counters WHERE name = '${today()}'`), 1)
  })

  test('the connecting address is never kept, only a keyed mark of it', async () => {
    const e = env()
    const address = '203.0.113.77'
    for (let i = 0; i < 3; i++) await acceptGeneration(archivePost(await generation(), address), e)
    const all = everything(e.DB)
    assert.ok(!all.includes(address), 'no table holds the address')
    assert.ok(!all.includes('203.0.113'), 'nor any part of it')
    const keys = e.DB.sqlite.prepare('SELECT key FROM limits').all() as { key: string }[]
    assert.equal(keys.length, 1)
    assert.match(keys[0].key, /^archive:\d+:[A-Za-z0-9_-]{22}$/)
  })

  test('new ids for every request do not escape the address allowance', async () => {
    const e = env()
    LIMITS.perAddressPer10Minutes = 5
    const results = []
    for (let i = 0; i < 8; i++) results.push(reason(await acceptGeneration(archivePost(await generation()), e)))
    assert.deepEqual(results, [...Array(5).fill('stored'), ...Array(3).fill('dropped:address')])
    // another address is not affected
    assert.equal(reason(await acceptGeneration(archivePost(await generation(), '198.51.100.1'), e)), 'stored')
  })

  test('IPv6: every address of one /64 shares one allowance', async () => {
    const e = env()
    LIMITS.perAddressPer10Minutes = 3
    const results = []
    for (const a of ['2001:db8:1:2::1', '2001:0db8:0001:0002:ffff::9', '2001:db8:1:2:aaaa:bbbb:cccc:dddd', '2001:DB8:1:2::5'])
      results.push(reason(await acceptGeneration(archivePost(await generation(), a), e)))
    assert.deepEqual(results, ['stored', 'stored', 'stored', 'dropped:address'])
    // another /64 has its own
    assert.equal(reason(await acceptGeneration(archivePost(await generation(), '2001:db8:1:3::1'), e)), 'stored')
    assert.equal(addressOf(new Request(ORIGIN, { headers: { 'cf-connecting-ip': '::1' } })), '0:0:0:0::/64')
    assert.equal(addressOf(new Request(ORIGIN, { headers: { 'cf-connecting-ip': '203.0.113.5' } })), '203.0.113.5')
  })

  test('the address allowance holds when requests arrive together', async () => {
    const e = env()
    LIMITS.perAddressPer10Minutes = 5
    const events = await Promise.all(Array.from({ length: 30 }, () => generation()))
    const results = await Promise.all(events.map((ev) => acceptGeneration(archivePost(ev), e).then(reason)))
    assert.equal(results.filter((r) => r === 'stored').length, 5)
    assert.equal(results.filter((r) => r === 'dropped:address').length, 25)
    assert.equal(count(e.DB, 'SELECT COUNT(*) AS n FROM generations'), 5)
  })

  test('the daily cap holds when requests arrive together (atomic place)', async () => {
    const e = env()
    LIMITS.perDay = 10
    e.DB.sqlite.prepare('INSERT INTO counters (name, value) VALUES (?1, 7)').run(today())
    // 40 records at once, each from its own address and ids: only the 3 places left may be taken
    const events = await Promise.all(Array.from({ length: 40 }, () => generation()))
    const results = await Promise.all(events.map((ev, i) => acceptGeneration(archivePost(ev, `192.0.2.${i + 1}`), e).then(reason)))
    assert.equal(results.filter((r) => r === 'stored').length, 3)
    assert.equal(results.filter((r) => r === 'dropped:day').length, 37)
    assert.equal(count(e.DB, `SELECT value AS n FROM counters WHERE name = '${today()}'`), 10)
    assert.equal(count(e.DB, 'SELECT COUNT(*) AS n FROM generations'), 3)
  })

  test('the harness is fair: a cap read in one step and written in another does pass the cap', async () => {
    // the old way (read, then write), on the same interleaving D1 gives: this is what the atomic place prevents
    const db = testD1()
    const cap = 10
    db.sqlite.prepare("INSERT INTO counters (name, value) VALUES ('d', 7)").run()
    await Promise.all(
      Array.from({ length: 40 }, async () => {
        const row = await db.prepare("SELECT value FROM counters WHERE name = 'd'").first<{ value: number }>()
        if ((row?.value ?? 0) >= cap) return
        await db.prepare("UPDATE counters SET value = value + 1 WHERE name = 'd'").run()
      }),
    )
    const value = (db.sqlite.prepare("SELECT value AS n FROM counters WHERE name = 'd'").get() as { n: number }).n
    assert.ok(value > cap, `read-then-write reached ${value}`)
  })

  test('a request past its address allowance reads nothing more from D1', async () => {
    const e = env()
    LIMITS.perAddressPer10Minutes = 1
    await acceptGeneration(archivePost(await generation()), e)
    const before = e.DB.log.length
    assert.equal(reason(await acceptGeneration(archivePost(await generation()), e)), 'dropped:address')
    const run = e.DB.log.slice(before)
    assert.equal(run.length, 1, run.join('\n'))
    assert.match(run[0], /^INSERT INTO limits/)
  })

  test('the per-visitor count stops at its limit', async () => {
    const e = env()
    LIMITS.perVisitorPerHour = 3
    const visitor_id = randomUUID()
    const results = []
    for (let i = 0; i < 5; i++) results.push(reason(await acceptGeneration(archivePost(await generation(SMALL_SVG, { visitor_id })), e)))
    assert.deepEqual(results, ['stored', 'stored', 'stored', 'dropped:visitor', 'dropped:visitor'])
    assert.ok(e.DB.log.some((s) => s.includes('LIMIT ?3')), 'the counts are bounded')
  })

  test('a failed write gives the day its place back', async () => {
    const e = env()
    const ev = await generation()
    // the write batch fails (its snapshot has nowhere to go) after the day's place was taken
    e.DB.sqlite.exec('DROP TABLE snapshots')
    assert.equal(reason(await acceptGeneration(archivePost(ev), e)), 'error')
    assert.equal(count(e.DB, `SELECT value AS n FROM counters WHERE name = '${today()}'`), 0)
    assert.equal(count(e.DB, 'SELECT COUNT(*) AS n FROM generations'), 0)
  })

  test('allowances whose day is over are deleted by the first record of a day', async () => {
    const e = env()
    e.DB.sqlite.prepare("INSERT INTO limits (key, hits, expires) VALUES ('archive:1:old', 3, 1000)").run()
    assert.equal(reason(await acceptGeneration(archivePost(await generation()), e)), 'stored')
    assert.equal(count(e.DB, "SELECT COUNT(*) AS n FROM limits WHERE key = 'archive:1:old'"), 0)
  })

  test('an oversized snapshot is refused before anything is read or written', async () => {
    const e = env()
    const big = SMALL_SVG.replace('<g>', '<g>' + '<text x="1" y="1" font-size="1">あ</text>'.repeat(Math.ceil(MAX_SVG / 40)))
    const r = await acceptGeneration(archivePost(await generation(big)), e)
    assert.ok(r.status === 413 || reason(r)?.startsWith('refused:'), `${r.status} ${reason(r)}`)
    assert.equal(e.DB.log.length, 0)
  })

  test('markup that names Object.prototype is refused, not thrown', async () => {
    const e = env()
    for (const svg of [
      '<svg viewBox="0 0 1000 1000"><constructor></constructor></svg>',
      '<svg viewBox="0 0 1000 1000"><g valueOf="x"></g></svg>',
      '<svg viewBox="0 0 1000 1000"><g constructor="x"></g></svg>',
      '<svg viewBox="0 0 1000 1000"><g toString="x"></g></svg>',
    ]) {
      const r = await acceptGeneration(archivePost(await generation(svg)), e)
      assert.equal(reason(r), 'refused:snapshot', svg)
    }
    assert.equal(e.DB.log.length, 0)
  })

  test('without SESSION_SECRET the archive still works, on the browser ids and the daily cap alone', async () => {
    const e = { ...env(), SESSION_SECRET: undefined }
    assert.equal(reason(await acceptGeneration(archivePost(await generation()), e)), 'stored')
    assert.equal(count(e.DB, 'SELECT COUNT(*) AS n FROM limits'), 0)
  })
})
