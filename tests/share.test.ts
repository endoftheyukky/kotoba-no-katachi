// /s: the head a shared link gives its poem (server/share.ts), before any script runs.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { poemQuery, shareMeta, SITE_IMAGE, SITE_URL, versionOf } from '../server/share'

const at = (q: string) => shareMeta(new URL(`${SITE_URL}/s?${q}`))
const enc = encodeURIComponent

describe('/s card', () => {
  test('a 作例 has its own card; the address, its /s form and its canonical form', () => {
    const m = at(`title=${enc('孤独')}&v=3`)!
    assert.deepEqual(m, {
      title: '「孤独」 — ことばのかたち',
      documentTitle: '孤独 — ことばのかたち',
      image: `${SITE_URL}/og/v3/kodoku.png`,
      url: `${SITE_URL}/s?title=${enc('孤独')}&v=3`,
      canonical: `${SITE_URL}/?title=${enc('孤独')}&v=3`,
    })
    assert.equal(at(`title=${enc('森')}&v=3`)!.image, `${SITE_URL}/og/v3/mori.png`)
  })

  test('all nine 作例 map to a card that exists', () => {
    const manifest = JSON.parse(readFileSync(new URL('../tools/examples/manifest.json', import.meta.url), 'utf8')) as { text: string; file: string }[]
    assert.equal(manifest.length, 9)
    for (const e of manifest) {
      const m = at(`title=${enc(e.text)}&v=3`)!
      assert.equal(m.image, `${SITE_URL}/og/v3/${e.file}`, e.text)
      readFileSync(new URL(`../public/og/v3/${e.file}`, import.meta.url))
    }
  })

  test('any other poem, and a 作例 in another version or with a reading, has the site card', () => {
    assert.equal(at(`title=${enc('作例ではないことば')}&v=3`)!.image, SITE_IMAGE)
    assert.equal(at(`title=${enc('孤独')}`)!.image, SITE_IMAGE)
    assert.equal(at(`title=${enc('孤独')}&v=1`)!.image, SITE_IMAGE)
    assert.equal(at(`title=${enc('孤独')}&reading=${enc('こどく')}&v=3`)!.image, SITE_IMAGE)
    assert.equal(SITE_IMAGE, `${SITE_URL}/ogp.png?v=3`)
  })

  test('versions and readings are written as the page writes them', () => {
    // no v is v2c, and v2c keeps its address without one
    assert.equal(at(`title=${enc('森')}`)!.canonical, `${SITE_URL}/?title=${enc('森')}`)
    assert.equal(at(`title=${enc('森')}&v=2`)!.canonical, `${SITE_URL}/?title=${enc('森')}`)
    assert.equal(at(`title=${enc('森')}&v=1`)!.url, `${SITE_URL}/s?title=${enc('森')}&v=1`)
    // a reading in katakana or with spaces is the page's own: hiragana, no spaces
    const m = at(`title=${enc('子供の城')}&reading=${enc('コドモ ノ シロ')}&v=3`)!
    assert.equal(m.canonical, `${SITE_URL}/?title=${enc('子供の城')}&reading=${enc('こどものしろ')}&v=3`)
    assert.equal(m.url, `${SITE_URL}/s?title=${enc('子供の城')}&reading=${enc('こどものしろ')}&v=3`)
    // other parameters are not carried
    assert.equal(at(`title=${enc('森')}&v=3&debug=1&x=y`)!.url, `${SITE_URL}/s?title=${enc('森')}&v=3`)
  })

  test('the version rule is the generator’s own (src/poem/generators.ts versionOf)', () => {
    const source = readFileSync(new URL('../src/poem/generators.ts', import.meta.url), 'utf8')
    assert.match(source, /if \(param === '1'\) return 1\s+if \(param === '3'\) return 3\s+return 2/)
    assert.deepEqual([null, '', '1', '2', '3', '4', 'v3'].map(versionOf), [2, 2, 1, 2, 3, 2, 2])
    assert.equal(poemQuery('森', '', 2), `title=${enc('森')}`)
  })

  test('an address that names no poem the page would draw keeps the site’s own head', () => {
    assert.equal(at(''), null)
    assert.equal(at('title='), null)
    assert.equal(at(`title=${enc('あ'.repeat(17))}&v=3`), null)
    assert.equal(at(`title=${enc('森')}&reading=${enc('も'.repeat(65))}&v=3`), null)
    assert.equal(at(`title=${enc('森‮')}&v=3`), null)
  })

  test('the /s form of a title is its normalized one', () => {
    assert.equal(at(`title=${enc('  森 ')}&v=3`)!.url, `${SITE_URL}/s?title=${enc('森')}&v=3`)
  })
})
