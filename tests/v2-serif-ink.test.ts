// After Stage 11: serif-ink-1, the writing face's fixed observations, and the serif-aware typography (B3a) prepared
// on it. The canonical table is made only on the canonical environment (npm run v2:serif-ink, Windows, Chrome 153,
// Noto Serif JP 5.3.0 at 300) and is not in the repository yet: every test that needs it is skipped with that reason,
// and no stand-in for it is made here. What is tested without it: the builder's own pure parts on the real inputs
// (structure-1, align-1's rows as the fit's output shape, the bundled CSS), the guards, the loader's refusals, and
// that v2 still writes with B.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { readRelations } from '../src/glyph/relation'
import type { GlyphMetrics } from '../src/glyph/metrics'
import { alignIndex } from '../src/v2/align/lookup'
import type { AlignManifest, AlignShard } from '../src/v2/align/table'
import { composeV2 } from '../src/v2/compose'
import { declared, projectEntry, projectRow, rangesOf } from '../src/v2/serif/build/project'
import { checkManifest, serifInkIndex, unpackBits } from '../src/v2/serif/lookup'
import type { SerifInkManifest } from '../src/v2/serif/table'
import { canonical } from '../src/v2/structure/build/serialize'
import { recording } from '../src/v2/types/ink'
import { SANS_PLANS, TYPOGRAPHY } from '../src/v2/typography/b3a'
import { checkEnvironment, CANONICAL, fixedTables, PINNED_SERIF, readSerifFont } from '../tools/v2/serif-ink.mjs'
import { fileSource, observeNode, root } from './v2-node'
import { serifInkFor } from '../src/v2/observation/tables'

const dir = join(root, 'public/v2/align-1')
const am = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as AlignManifest
const align = alignIndex(am, am.shards.files.map((f) => JSON.parse(readFileSync(join(dir, f.name), 'utf8')) as AlignShard))
const SERIF = join(root, 'public/v2/serif-ink-1')
const haveTable = existsSync(join(SERIF, 'manifest.json'))
const NO_TABLE = 'serif-ink-1 is made only on the canonical environment (npm run v2:serif-ink on Windows, Chrome 153, Noto Serif JP 5.3.0 at 300) and is not in the repository yet'
const withTable = haveTable ? test : (name: string, _fn?: unknown) => test.skip(`${name} — ${NO_TABLE}`)

describe('serif-ink-1: the builder\'s pure parts', () => {
  test('the projection keeps a character\'s direct leaves only, and only what B3a reads', () => {
    // align-1's own entries have the shape the fit gives for the serif: the projection is tested on them
    for (const c of ['辻', '州', '林', '海', '国', '品']) {
      const e = align.entry(c)!
      const p = projectEntry(e, undefined, undefined)
      const leaves = e.rows.filter((r) => r.depth === 1 && r.node.kind === 'leaf')
      assert.deepEqual(p.rows.map((r) => r.path), leaves.map((r) => r.path), c)
      for (const r of p.rows) {
        assert.deepEqual(Object.keys(r).sort(), ['because', 'depth', 'index', 'node', 'parentOp', 'path', 'status', ...(r.box ? ['box'] : []), ...(r.ink ? ['ink'] : []), ...(r.confidence !== undefined ? ['confidence'] : []), ...(r.residual ? ['residual'] : []), ...(r.transform ? ['transform'] : [])].sort(), `${c} ${r.path}`)
        if (r.residual) {
          assert.deepEqual(Object.keys(r.residual).sort(), ['box', 'centroid', 'pieces', 'share'], `${c} ${r.path}`)
          for (const q of r.residual.pieces) assert.deepEqual(Object.keys(q), ['centroid'])
        }
      }
      assert.equal('ink' in p, false, `${c}: islands, alike and crossings are not kept`)
      assert.equal('unexplained' in p, false)
      assert.deepEqual(p.whole, e.whole && { half: e.whole.half, ink: e.whole.ink })
      // pure: the same input, the same bytes
      assert.equal(canonical(projectEntry(e, undefined, undefined)), canonical(p))
    }
    // a nested row or a subtree is never kept
    const nested = am.shards.files.slice(0, 4).flatMap((f) => Object.values((JSON.parse(readFileSync(join(dir, f.name), 'utf8')) as AlignShard).entries)).flatMap((e) => e.rows.filter((r) => r.depth > 1 || r.node.kind === 'op'))
    assert.ok(nested.length > 0)
    for (const r of nested) assert.equal(projectRow(r), null)
  })

  test('the writing record\'s domain is the code points the bundled writing face declares', () => {
    const { css } = readSerifFont()
    const cps = declared(css)
    assert.equal(cps.length, 17929)
    const ranges = rangesOf(cps)
    assert.equal(ranges.reduce((n, [a, b]) => n + b - a + 1, 0), cps.length)
    for (let i = 1; i < ranges.length; i++) assert.ok(ranges[i][0] > ranges[i - 1][1] + 1)
  })

  test('the writing face is the pinned one (package, CSS and files), and the site writes in it', () => {
    const { font } = readSerifFont()
    assert.equal(font.package.version, PINNED_SERIF.version)
    assert.equal(font.css.sha256, PINNED_SERIF.css)
    assert.equal(font.files.sha256, PINNED_SERIF.files)
    assert.equal(font.weight, 300)
  })

  test('the fixed tables are the published ones (align-1, structure-1, resonance-1 unchanged)', () => {
    assert.deepEqual(fixedTables(join(root, 'public/v2')), [])
  })
})

describe('serif-ink-1: the canonical environment is required', () => {
  test('the environment align-1 was made on is canonical; anything else is refused', () => {
    const r = am.render
    const align1 = { os: 'win32', browser: r.browser.product, userAgent: r.browser.userAgent, devicePixelRatio: r.devicePixelRatio, declared: 124, loaded: 124 }
    assert.deepEqual(checkEnvironment(align1), [])
    assert.equal(CANONICAL.browserMajor, 153)
    assert.ok(checkEnvironment({ ...align1, os: 'linux' }).some((p: string) => p.includes('not Windows')))
    assert.ok(checkEnvironment({ ...align1, browser: 'Chrome/141.0.7390.37' }).some((p: string) => p.includes('not Chrome 153')))
    assert.ok(checkEnvironment({ ...align1, userAgent: r.browser.userAgent.replace('HeadlessChrome', 'Chrome') }).some((p: string) => p.includes('not headless')))
    assert.ok(checkEnvironment({ ...align1, devicePixelRatio: 2 }).some((p: string) => p.includes('pixel ratio')))
    assert.ok(checkEnvironment({ ...align1, loaded: 3 }).length > 0)
  })

  test('the runtime reads only a canonical serif-ink-1', () => {
    assert.throws(() => checkManifest({ id: 'align-1' }), /not its manifest/)
    assert.throws(() => checkManifest({ id: 'serif-ink-1', schema: 2, canonical: true }), /schema/)
    assert.throws(() => checkManifest({ id: 'serif-ink-1', schema: 1, canonical: false }), /not canonical/)
    assert.throws(() => serifInkIndex({ id: 'serif-ink-1', schema: 1, canonical: false }, [], [], { ranges: [], codePoints: 0, measured: 0, unwritable: [], emptyInBoth: [] }), /not canonical/)
  })

  test('a raster is unpacked as it was packed (one bit per pixel, row-major, ink as 255)', () => {
    // 0b10100000 0b01: bits 0, 2 and 15 of 16
    const bits = Buffer.from([0b10100000, 0b00000001]).toString('base64')
    assert.deepEqual([...unpackBits(bits, 16)], [255, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255])
  })

  test('v1 readRelations reads a glyph\'s ink and density and nothing else (serif-ink-1 holds exactly these)', () => {
    // not a measurement: a plain square of ink and its density, to see which fields v1 touches
    const glyph = (): GlyphMetrics => {
      const w = 60
      const data = new Uint8Array(w * w).fill(255)
      const g = { density: 0.36, ink: { w, h: w, data, left: -30, top: -30, px: 1 } }
      return new Proxy(g, { get: (t, k) => { if (!(k in t)) throw new Error(`v1 read ${String(k)}`); return t[k as keyof typeof t] } }) as unknown as GlyphMetrics
    }
    assert.doesNotThrow(() => readRelations(new Map([['a', glyph()], ['b', glyph()]])))
  })
})

describe('B3a is prepared, not in use', () => {
  test('v2 writes with B (c311b7c) and B3a is refused without the canonical table', async () => {
    assert.equal(TYPOGRAPHY, 'B')
    const o = await observeNode('川または州')
    assert.equal(o.serif, undefined)
    assert.throws(() => composeV2(o, { typography: 'B3a' }), /serif-ink-1 was not read/)
    // the default is B: the same page as without the option
    assert.deepEqual(composeV2(o, { typography: 'B' }).draft, composeV2(o).draft)
    assert.equal(composeV2(o).rationale.typography, undefined)
    assert.equal(composeV2(o).rationale.data['serif-ink-1'], undefined)
  })

  test('the plans that stand on the reading face\'s anatomy are named by plan, never by title', () => {
    assert.deepEqual(Object.keys(SANS_PLANS).sort(), ['FieldSingleton', 'RegionSplit', 'WholeEmerges'])
  })

  test('without the table, serif-ink-1 is not found (nothing is filled in)', async () => {
    if (haveTable) return
    const o = await observeNode('州')
    await assert.rejects(serifInkFor(o.tables, ['州'], fileSource()))
  })

  test('a recording view answers as its table does, and says what was asked', () => {
    const r = recording(align)
    assert.equal(r.entry('州'), align.entry('州'))
    assert.equal(r.entry('A'), null)
    assert.deepEqual([...r.asked], [['州', true], ['A', false]])
  })
})

describe('serif-ink-1 as published (canonical)', () => {
  const load = () => {
    const m = JSON.parse(readFileSync(join(SERIF, 'manifest.json'), 'utf8')) as SerifInkManifest
    return m
  }
  withTable('it is canonical and made on the canonical environment', () => {
    const m = load()
    assert.equal(m.canonical, true)
    assert.match(m.render.platform.os, /^win32 /)
    assert.match(m.render.browser.userAgent, /HeadlessChrome\/153\./)
    assert.equal(m.font.package.version, '5.3.0')
    assert.equal(m.font.weight, 300)
    assert.equal(m.inputs.structure.sha256, '9e60d412d42dc87f98673cf89e2ff17768eb5a01dff7ab9b640b3143b300b83f')
  })

  withTable('every file is the file its manifest names, and they make its sha256', async () => {
    const { createHash } = await import('node:crypto')
    const m = load()
    const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex')
    const files = [...m.shards.entries, ...m.shards.rasters]
    for (const f of files) assert.equal(sha(readFileSync(join(SERIF, f.name))), f.sha256, f.name)
    assert.equal(sha(readFileSync(join(SERIF, m.writing.file))), m.writing.sha256)
    assert.equal(sha(files.map((f) => f.sha256).join('') + m.writing.sha256), m.sha256)
  })

  withTable('a title reads only the shards it reaches, and B3a is deterministic on it', async () => {
    for (const t of ['川または州', '辻', '土と士', '大きな犬', '回', '林']) {
      const source = fileSource()
      const o = await observeNode(t, undefined, source)
      const { index, read } = await serifInkFor(o.tables, [...new Set(o.language.graphemes.map((g) => g.char))], source)
      assert.ok(read.entries.length <= o.tables.chars.length, t)
      const obs = { ...o, serif: index }
      const a = composeV2(obs, { typography: 'B3a' })
      const b = composeV2(obs, { typography: 'B3a' })
      assert.deepEqual(a.draft, b.draft, t)
      assert.deepEqual(a.rationale.typography, b.rationale.typography, t)
      // the face changes no Discovery, Selection or Plan
      const B = composeV2(o)
      assert.equal(a.rationale.plan, B.rationale.plan, t)
      assert.deepEqual(a.rationale.selection, B.rationale.selection, t)
      assert.equal(a.rationale.data['serif-ink-1']?.sha256, index.manifest.sha256)
    }
  })
})
