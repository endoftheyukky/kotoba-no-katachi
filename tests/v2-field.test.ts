// v2 Stage 8 (spec-1 §16): FieldGeometry. Every property has a cause; the minimum carrier is the default;
// a larger extent or count must be asked for, or it is unmotivated and loses.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { analyzeLanguage } from '../src/language/analysis'
import { meaningOf, parseTable } from '../src/language/semantic/axes'
import { normalizeTitle } from '../src/title'
import { alignIndex } from '../src/v2/align/lookup'
import type { AlignManifest, AlignShard } from '../src/v2/align/table'
import { constrain } from '../src/v2/constraints'
import { discover, select } from '../src/v2/discovery'
import type { DiscoveryInput } from '../src/v2/discovery/input'
import { FRAME, geometry } from '../src/v2/field'
import { plan } from '../src/v2/plan'
import { leavesOf, resonanceIndex, resonate, type ResonanceManifest, type ResonanceShard } from '../src/v2/resonance'
import { CONSTANTS } from '../src/v2/spec'
import { structureIndex } from '../src/v2/structure/lookup'
import type { StructureManifest, StructureShard } from '../src/v2/structure/table'
import type { FieldGeometry, PageRect } from '../src/v2/types/field'

const root = join(import.meta.dirname, '..')
const load = <M extends { shards: { files: readonly { name: string }[] } }, S>(dir: string) => {
  const manifest = JSON.parse(readFileSync(join(root, dir, 'manifest.json'), 'utf8')) as M
  return { manifest, shards: manifest.shards.files.map((f) => JSON.parse(readFileSync(join(root, dir, f.name), 'utf8')) as S) }
}
const S = load<StructureManifest, StructureShard>('public/v2/structure-1')
const A = load<AlignManifest, AlignShard>('public/v2/align-1')
const R = load<ResonanceManifest, ResonanceShard>('public/v2/resonance-1')
const structure = structureIndex(S.manifest, S.shards)
const align = alignIndex(A.manifest, A.shards)
const resonance = resonanceIndex(R.manifest, R.shards)
const leaves = leavesOf(structure)
const axDir = join(root, 'public/semantic/axes-1')
const axes = parseTable('axes-1', readdirSync(axDir).filter((f) => f.endsWith('.tsv')).sort().map((f) => readFileSync(join(axDir, f), 'utf8')).join('\n'))

function fielded(text: string, reading?: string) {
  const t = normalizeTitle({ text, reading })
  if (typeof t === 'string') throw new Error(t)
  const input: DiscoveryInput = { language: analyzeLanguage(t), structure, align, relations: [] }
  const ds = discover(input)
  const sel = select(ds, input)
  const evidence = resonate(ds, sel, resonance, leaves, (g) => input.language.graphemes[g]?.char)
  const set = constrain(ds, sel, evidence, input.language)
  const primary = sel.primary ? ds.find((d) => d.id === sel.primary)! : null
  const p = plan(set.constraints, primary, input.language.graphemes)
  const g = geometry({ plan: p.plan, constraints: set.constraints, primary, align, language: input.language, rest: p.rest, meaning: meaningOf(t.text, axes) })
  return { set, evidence, p, g, x: g.geometry }
}
const K = (n: keyof typeof CONSTANTS) => CONSTANTS[n].value
const inside = (a: { x: number; y: number }, r: PageRect) => a.x >= r.x - 0.5 && a.x <= r.x + r.w + 0.5 && a.y >= r.y - 0.5 && a.y <= r.y + r.h + 0.5
const cause = (x: FieldGeometry, property: string) => x.causes.filter((c) => c.property === property)

describe('FieldGeometry: the benchmark (§15.2)', () => {
  test('淋: a field of 林 in the hidden band, 淋 at the left edge with its base part on a unit, the left band white', () => {
    const { x } = fielded('淋')
    assert.ok(x.count > K('IMMEDIATE') && x.count <= Math.floor(Math.sqrt(K('IMMEDIATE') * K('HIDDEN'))), `${x.count}`)
    assert.equal(x.visibility, 'hidden')
    assert.equal(x.singleton?.cell?.col, 0)
    assert.equal(x.singleton?.align, 'base-part')
    assert.equal(x.groups?.n, 2, '林 = 木×2: columns in pairs')
    assert.equal((x.cols ?? 0) % 2, 0, 'pairs are not cut at the edge')
    const w = x.whitespace[0]
    assert.ok(w && w.region.x === FRAME.x && w.cause.kind === 'constraint' && w.cause.id.startsWith('c:boundary-side'))
  })

  test('血: 血 in the top row; the delta still reaches TAU (not too small); the top band white', () => {
    const { x } = fielded('血')
    assert.equal(x.singleton?.cell?.row, 0)
    assert.notEqual(x.visibility, 'too-small')
    assert.ok(x.whitespace.some((w) => w.region.y === FRAME.y && w.region.w === FRAME.w))
  })

  test('州: one row with three 州 among 川', () => {
    const { x } = fielded('州')
    assert.equal(x.detail?.interleave?.cols.length, 3)
    assert.equal(x.detail?.interleave?.item, '州')
    assert.equal(x.detail?.unit, '川')
  })

  test('闇, 囚: the container\'s ring on its closed sides, the contained 3 × 3 inside, the white between closed, the whole at the interface', () => {
    const a = fielded('闇').x
    assert.deepEqual([...a.detail!.ring!.sides], ['top', 'left', 'right'])
    const b = fielded('囚').x
    assert.deepEqual([...b.detail!.ring!.sides], ['top', 'left', 'right', 'bottom'])
    for (const x of [a, b]) {
      assert.equal(x.detail!.ring!.innerCols * x.detail!.ring!.innerRows, 9)
      assert.ok(x.whitespace.some((w) => w.cause.kind === 'constraint' && w.cause.id.startsWith('c:inside')))
      assert.ok(x.detail!.interfaceAt && x.detail!.interfaceAt.size < x.unitSize, 'the interface whole is smaller than a unit (INTERFACE_SCALE)')
    }
  })

  test('問: the character itself, once', () => {
    const { x } = fielded('問')
    assert.equal(x.count, 1)
    assert.equal(x.extent, null)
  })

  test('辻: 十 in 5 × 5 with its roads empty, 辻 at the crossing, the wrapper\'s zone (left, bottom) white', () => {
    const { x } = fielded('辻')
    assert.deepEqual([x.cols, x.rows], [5, 5])
    assert.equal(x.detail?.empty?.length, 8)
    assert.equal(x.detail?.span?.item, '辻')
    const wz = x.whitespace.filter((w) => w.cause.kind === 'constraint' && w.cause.id.startsWith('c:wrapper-zone'))
    assert.equal(wz.length, 2)
  })

  test('悲: 非 and 心 apart, one each (a field of each is a candidate and loses), a seam of white between', () => {
    const { g, x } = fielded('悲')
    assert.equal(x.count, 2)
    assert.ok(g.candidates.some((c) => c.count === 12 && c.unmotivated.length > 0))
    assert.ok(x.whitespace.some((w) => w.cause.kind === 'constraint' && w.cause.id.startsWith('c:separation')))
    assert.ok(cause(x, 'whitespace').some((c) => c.because.kind === 'const' && c.because.name === 'SEAM_COEF'))
  })

  test('雨 林 森 品: the whole once, among n × (groups − 1) of its units, none on the whole\'s ink', () => {
    const want: Record<string, { n: number; groups: number }> = { 雨: { n: 4, groups: 4 }, 林: { n: 2, groups: 8 }, 森: { n: 3, groups: 8 }, 品: { n: 3, groups: 2 } }
    for (const [c, w] of Object.entries(want)) {
      const { x } = fielded(c)
      const pts = x.detail!.points!
      assert.equal(pts.length, w.n * (w.groups - 1), c)
      assert.equal(x.singleton?.item, c)
      const at = x.singleton!.point!
      const half = align.entry(c)!.whole!.half
      const W = x.singleton!.scale * x.unitSize
      for (const q of pts) assert.ok(!(Math.abs(q.x - at.x) < (half.w * W) / 100 && Math.abs(q.y - at.y) < (half.h * W) / 100), `${c}: a unit on the whole's ink`)
      for (const q of pts) assert.ok(inside(q, FRAME), `${c}: inside the frame`)
    }
  })

  test('月 (nothing found): the title once, small, off the centre; its properties caused by nothing having been found', () => {
    const { x } = fielded('月')
    assert.equal(x.count, 1)
    assert.ok(x.causes.every((c) => c.because.kind === 'fallback'))
    const r = x.detail!.line!.rect
    assert.ok(r.w <= 1000 * K('FALLBACK_SPAN') + 0.5)
    assert.ok(Math.hypot(r.x + r.w / 2 - 500, r.y + r.h / 2 - 500) > 250, 'away from the centre')
  })
})

describe('FieldGeometry: causes and the minimum carrier', () => {
  const titles = ['淋', '海', '州', '血', '闇', '囚', '問', '辻', '悲', '雨', '林', '森', '品', '十', '月', '見えない', 'ころころ', '雨の中の雨', '木と林と森', '川または州', '好', '男', '国']

  test('the chosen geometry has no unmotivated property; every cause names a constraint of the title, a named constant, the axes or the fallback', () => {
    for (const t of titles) {
      const { set, evidence, x } = fielded(t)
      assert.deepEqual(x.unmotivated, [], t)
      const ids = new Set(set.constraints.map((c) => c.id))
      const evs = new Set(evidence.map((e) => e.id))
      for (const c of [...x.causes.map((y) => y.because), ...x.whitespace.map((w) => w.cause)]) {
        if (c.kind === 'constraint') assert.ok(ids.has(c.id), `${t}: ${c.id}`)
        else if (c.kind === 'evidence') assert.ok(evs.has(c.id as never), `${t}: ${c.id}`)
        else if (c.kind === 'const') assert.ok(c.name in CONSTANTS, `${t}: ${c.name}`)
        else if (c.kind === 'fallback') assert.equal(x.name, 'nothing found', t)
      }
    }
  })

  test('the whole frame, dense, is always a candidate beside a field, and always loses', () => {
    for (const t of ['淋', '州', '闇', '辻', '雨']) {
      const { g, x } = fielded(t)
      const dense = g.candidates.find((c) => c.name.includes('dense'))!
      assert.ok(dense.unmotivated.length > 0 && dense.name !== x.name, t)
    }
  })

  test('a field covering most of the page has its extent caused by a constraint (§15.3)', () => {
    for (const t of titles) {
      const { x } = fielded(t)
      const e = x.extent
      if (!e || e.w * e.h < 0.6 * 1e6 || (x.cols ?? 0) < 3 || (x.rows ?? 0) < 3) continue
      assert.ok(cause(x, 'extent').some((c) => c.because.kind === 'constraint'), t)
    }
  })

  test('the same title gives the same geometry', () => {
    for (const t of titles) assert.equal(JSON.stringify(fielded(t).g), JSON.stringify(fielded(t).g), t)
  })

  test('the field code reads no fixture', () => {
    for (const f of readdirSync(join(root, 'src/v2/field'))) assert.ok(!/fixtures/.test(readFileSync(join(root, 'src/v2/field', f), 'utf8')), f)
  })
})
