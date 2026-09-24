// The snapshot check (src/archive/svg.ts): real pages pass, and each limit refuses what lies beyond it.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { describe, test } from 'node:test'
import { canonicalSVG, checkSVG, MAX_SVG, measureSVG, SNAPSHOT_LIMITS } from '../src/archive/svg'
import { SMALL_SVG } from './helpers'

const FIXTURES = new URL('./fixtures/', import.meta.url)
const pages = readdirSync(FIXTURES)
  .filter((f) => f.endsWith('.svg'))
  .map((f) => ({ name: f, svg: readFileSync(new URL(f, FIXTURES), 'utf8') }))

const HEAD = '<svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet" text-rendering="geometricPrecision">'
const text = (t = 'あ', x = '500') => `<text x="${x}" y="500" font-size="120">${t}</text>`
const page = (body: string, defs = '') => `${HEAD}${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`

describe('snapshot check', () => {
  test('the largest real page of each published version passes (tools/verify/snapshots.mjs wrote them)', () => {
    assert.ok(pages.length >= 1, 'fixtures present')
    for (const p of pages) {
      assert.equal(canonicalSVG(p.svg), p.svg, `${p.name} is canonical`)
      assert.equal(checkSVG(p.svg), true, p.name)
    }
  })

  test('the smallest page passes', () => {
    assert.equal(checkSVG(SMALL_SVG), true)
  })

  test('too large', () => {
    const big = page(text().repeat(Math.ceil(MAX_SVG / text().length) + 1))
    assert.ok(big.length > MAX_SVG)
    assert.equal(checkSVG(big), 'too large')
  })

  test('a <text> longer than any title', () => {
    assert.equal(checkSVG(page(`<g>${text('あ'.repeat(SNAPSHOT_LIMITS.text))}</g>`)), true)
    assert.equal(checkSVG(page(`<g>${text('あ'.repeat(SNAPSHOT_LIMITS.text + 1))}</g>`)), 'text too long')
    // an entity counts as one character
    assert.equal(checkSVG(page(`<g>${text('&amp;'.repeat(SNAPSHOT_LIMITS.text))}</g>`)), true)
  })

  test('a number longer than any number JavaScript writes', () => {
    const digits = (n: number) => '1'.repeat(n)
    assert.equal(checkSVG(page(`<g>${text('あ', digits(SNAPSHOT_LIMITS.number))}</g>`)), true)
    assert.equal(checkSVG(page(`<g>${text('あ', digits(SNAPSHOT_LIMITS.number + 1))}</g>`)), 'number in x on <text>')
    assert.equal(checkSVG(page(`<g transform="translate(${digits(SNAPSHOT_LIMITS.number + 1)} 0)">${text()}</g>`)), 'number in transform on <g>')
    // the numbers JavaScript does write pass
    for (const n of [-1.7976931348623157e308, 2.2250738585072014e-308, -0.000001234567890123456, 1.2e-7, 123456789.12345679]) {
      assert.equal(checkSVG(page(`<g>${text('あ', String(n))}</g>`)), true, String(n))
    }
  })

  test('masks, references, and a mask drawn through another', () => {
    const mask = (i: number) => `<mask id="m${i}" maskUnits="userSpaceOnUse"><rect x="0" y="0" width="10" height="10" fill="#fff"/></mask>`
    const many = (n: number) => Array.from({ length: n }, (_, i) => mask(i)).join('')
    const refs = (n: number) => Array.from({ length: n }, (_, i) => `<g mask="url(#m${i % 10})">${text()}</g>`).join('')
    assert.equal(checkSVG(page('', many(SNAPSHOT_LIMITS.masks))), true)
    assert.equal(checkSVG(page('', many(SNAPSHOT_LIMITS.masks + 1))), 'too many masks')
    assert.equal(checkSVG(page(refs(SNAPSHOT_LIMITS.references), many(10))), true)
    assert.equal(checkSVG(page(refs(SNAPSHOT_LIMITS.references + 1), many(10))), 'too many references')
    // the renderer never draws a mask through another: a chain is refused at its first link
    const chained = `<mask id="m0"><rect x="0" y="0" width="1" height="1" fill="#fff"/></mask><mask id="m1"><g mask="url(#m0)">${text()}</g></mask>`
    assert.equal(checkSVG(page(`<g mask="url(#m1)">${text()}</g>`, chained)), 'references inside a mask')
  })

  test('too many elements, too deep', () => {
    // small elements, so that the count and not the size is what refuses them
    assert.equal(checkSVG(page('<g/>'.repeat(SNAPSHOT_LIMITS.elements - 1))), true)
    assert.equal(checkSVG(page('<g/>'.repeat(SNAPSHOT_LIMITS.elements))), 'too many elements')
    const deep = (n: number) => '<g>'.repeat(n) + '</g>'.repeat(n)
    assert.equal(checkSVG(page(deep(SNAPSHOT_LIMITS.depth - 1))), true)
    assert.equal(checkSVG(page(deep(SNAPSHOT_LIMITS.depth))), 'too deep')
  })

  test('names from Object.prototype are refused, never thrown', () => {
    for (const name of ['constructor', 'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString']) {
      assert.equal(checkSVG(page(`<${name}></${name}>`)), `element <${name}>`)
      assert.equal(checkSVG(page(`<g ${name}="x">${text()}</g>`)), `attribute ${name} on <g>`)
    }
  })

  test('measures what it reads', () => {
    const m = measureSVG(page(`<g mask="url(#m0)">${text('あい', '12.5')}</g>`, '<mask id="m0"><rect x="0" y="0" width="1" height="1" fill="#fff"/></mask>'))
    // svg defs mask rect g text; the deepest: svg > defs > mask (a self-closed rect is not a level)
    assert.deepEqual(m, { elements: 6, depth: 3, text: 2, number: 4, masks: 1, references: 1, nested: 0 })
  })
})
