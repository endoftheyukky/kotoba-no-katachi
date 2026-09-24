// /s: the head a shared link gives its poem (server/share.ts), before any script runs.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { CURRENT, poemQuery, shareMeta, SITE_IMAGE, SITE_URL, versionOf, VERSIONS } from '../server/share'

const at = (q: string) => shareMeta(new URL(`${SITE_URL}/s?${q}`))
const enc = encodeURIComponent

describe('/s card', () => {
  test('a 作例 has its own card; the address, its /s form and its canonical form', () => {
    const m = at(`title=${enc('孤独')}&v=1`)!
    assert.deepEqual(m, {
      title: '「孤独」 — ことばのかたち',
      documentTitle: '孤独 — ことばのかたち',
      image: `${SITE_URL}/og/v1/kodoku.png`,
      url: `${SITE_URL}/s?title=${enc('孤独')}&v=1`,
      canonical: `${SITE_URL}/?title=${enc('孤独')}&v=1`,
    })
    assert.equal(at(`title=${enc('森')}&v=1`)!.image, `${SITE_URL}/og/v1/mori.png`)
  })

  test('all nine 作例 map to a card that exists', () => {
    const manifest = JSON.parse(readFileSync(new URL('../tools/examples/manifest.json', import.meta.url), 'utf8')) as { text: string; v: number; file: string }[]
    assert.equal(manifest.length, 9)
    for (const e of manifest) {
      assert.equal(e.v, 1, e.text)
      const m = at(`title=${enc(e.text)}&v=1`)!
      assert.equal(m.image, `${SITE_URL}/og/v1/${e.file}`, e.text)
      readFileSync(new URL(`../public/og/v1/${e.file}`, import.meta.url))
    }
  })

  test('any other poem, and a 作例 with a reading, has the site card', () => {
    assert.equal(at(`title=${enc('作例ではないことば')}&v=1`)!.image, SITE_IMAGE)
    assert.equal(at(`title=${enc('孤独')}&reading=${enc('こどく')}&v=1`)!.image, SITE_IMAGE)
    assert.equal(SITE_IMAGE, `${SITE_URL}/ogp.png?v=1`)
  })

  test('an address with no version, or one never published, is the current version, and says so', () => {
    for (const v of ['', '&v=', '&v=2', '&v=3', '&v=2c', '&v=999', '&v=01', '&v=x', '&v=1&v=3']) {
      const m = at(`title=${enc('孤独')}${v}`)!
      assert.equal(m.image, `${SITE_URL}/og/v1/kodoku.png`, v)
      assert.equal(m.url, `${SITE_URL}/s?title=${enc('孤独')}&v=1`, v)
      assert.equal(m.canonical, `${SITE_URL}/?title=${enc('孤独')}&v=1`, v)
    }
  })

  test('readings are written as the page writes them', () => {
    // a reading in katakana or with spaces is the page's own: hiragana, no spaces
    const m = at(`title=${enc('子供の城')}&reading=${enc('コドモ ノ シロ')}&v=1`)!
    assert.equal(m.canonical, `${SITE_URL}/?title=${enc('子供の城')}&reading=${enc('こどものしろ')}&v=1`)
    assert.equal(m.url, `${SITE_URL}/s?title=${enc('子供の城')}&reading=${enc('こどものしろ')}&v=1`)
    // other parameters are not carried
    assert.equal(at(`title=${enc('森')}&v=1&debug=1&x=y`)!.url, `${SITE_URL}/s?title=${enc('森')}&v=1`)
  })

  test('the versions are the generator’s own (src/poem/generators.ts)', () => {
    const source = readFileSync(new URL('../src/poem/generators.ts', import.meta.url), 'utf8')
    assert.match(source, new RegExp(`export const VERSIONS = \\[${VERSIONS.join(', ')}\\] as const`))
    assert.match(source, new RegExp(`export const CURRENT: Version = ${CURRENT}\\b`))
    assert.deepEqual([null, '', '1', '2', '3', 'v1'].map(versionOf), [1, 1, 1, 1, 1, 1])
    assert.equal(poemQuery('森', '', 1), `title=${enc('森')}&v=1`)
  })

  test('an address that names no poem the page would draw keeps the site’s own head', () => {
    assert.equal(at(''), null)
    assert.equal(at('title='), null)
    assert.equal(at(`title=${enc('あ'.repeat(17))}&v=1`), null)
    assert.equal(at(`title=${enc('森')}&reading=${enc('も'.repeat(65))}&v=1`), null)
    assert.equal(at(`title=${enc('森‮')}&v=1`), null)
  })

  test('the /s form of a title is its normalized one', () => {
    assert.equal(at(`title=${enc('  森 ')}&v=1`)!.url, `${SITE_URL}/s?title=${enc('森')}&v=1`)
  })
})
