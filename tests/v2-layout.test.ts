// v2 Stage 9 (spec-1 §16): Layout and the whole composition. §15.2 and §15.3 on the pages themselves; the
// images are looked at with tools/v2/eval.mjs (the tests do not judge a page, they keep it honest).
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { parseTable } from '../src/language/semantic/axes'
import type { Mark } from '../src/poem/types'
import { normalizeTitle } from '../src/title'
import { alignIndex } from '../src/v2/align/lookup'
import type { AlignManifest, AlignShard } from '../src/v2/align/table'
import { composeV2, type V2Tables } from '../src/v2/compose'
import { FRAME } from '../src/v2/field'
import { resonanceIndex, type ResonanceManifest, type ResonanceShard } from '../src/v2/resonance'
import { structureIndex } from '../src/v2/structure/lookup'
import type { StructureManifest, StructureShard } from '../src/v2/structure/table'
import type { IdsNode } from '../src/v2/types/structure'

const root = join(import.meta.dirname, '..')
const load = <M extends { shards: { files: readonly { name: string }[] } }, S>(dir: string) => {
  const manifest = JSON.parse(readFileSync(join(root, dir, 'manifest.json'), 'utf8')) as M
  return { manifest, shards: manifest.shards.files.map((f) => JSON.parse(readFileSync(join(root, dir, f.name), 'utf8')) as S) }
}
const S = load<StructureManifest, StructureShard>('public/v2/structure-1')
const A = load<AlignManifest, AlignShard>('public/v2/align-1')
const R = load<ResonanceManifest, ResonanceShard>('public/v2/resonance-1')
const axDir = join(root, 'public/semantic/axes-1')
const tables: V2Tables = {
  structure: structureIndex(S.manifest, S.shards),
  align: alignIndex(A.manifest, A.shards),
  resonance: resonanceIndex(R.manifest, R.shards),
  axes: parseTable('axes-1', readdirSync(axDir).filter((f) => f.endsWith('.tsv')).sort().map((f) => readFileSync(join(axDir, f), 'utf8')).join('\n')),
  data: { 'structure-1': { id: 'structure-1', sha256: S.manifest.sha256 }, 'align-1': { id: 'align-1', sha256: A.manifest.sha256 }, 'resonance-1': { id: 'resonance-1', sha256: R.manifest.sha256 }, 'axes-1': { id: 'axes-1', sha256: 'v1' } },
}

// the relations between a title's own glyphs are v1's reading in the browser (glyph metrics); the node tests
// compose without them, the evaluation pages with them
function compose(text: string, reading?: string) {
  const t = normalizeTitle({ text, reading })
  if (typeof t === 'string') throw new Error(t)
  return composeV2(t, [], tables)
}

const BENCHMARK = [...'雨闇淋林州血囚辻悲']
const CONTROLS = [...'海問品森玉晶轟好男国閣日琳田回']
const LONGER = ['雨の中の雨', '木と林と森', '川または州', '見えない', 'ころころ', '触る', '音楽', '国際空港', '私の影を踏まないでください！', 'あいうえお', 'Good morning!']
const ALL = [...BENCHMARK, ...CONTROLS, ...LONGER]

function leaves(n: IdsNode, out: { char: string; tier: string }[] = []) {
  if (n.kind === 'leaf') out.push({ char: n.char, tier: n.tier })
  else for (const c of n.children) leaves(c, out)
  return out
}
/** the characters a page may write: the title's own, and the components its characters' structures guarantee (R4), never a variant alone */
function allowed(text: string) {
  const ok = new Set<string>([...text])
  const variants = new Set<string>()
  for (const c of new Set(text)) {
    const s = tables.structure.lookup(c)
    if (s.status !== 'found') continue
    for (const l of leaves(s.structure.tree)) (l.tier === 'variant' ? variants : ok).add(l.char)
  }
  return { ok, variants }
}

describe('Layout: §15.2 on the page', () => {
  test('the rule of each benchmark page', () => {
    const want: Record<string, string> = { 雨: 'WholeEmerges', 闇: 'NestedRegions', 淋: 'FieldSingleton', 林: 'WholeEmerges', 州: 'FieldInterleave', 血: 'FieldSingleton', 囚: 'NestedRegions', 辻: 'CrossRoads', 悲: 'Separation', 海: 'RegionSplit', 問: 'GlyphItself', 森: 'WholeEmerges', 品: 'WholeEmerges' }
    for (const [c, rule] of Object.entries(want)) assert.equal(compose(c).rationale.plan, rule, c)
  })

  test('雨 林 森 品: the whole written exactly once, inside the field, not at its first place', () => {
    for (const c of '雨林森品') {
      const { draft, trace } = compose(c)
      const whole = draft.marks.filter((m) => m.char === c && !m.keep)
      assert.equal(whole.length, 1, c)
      const e = trace.geometry.extent!
      const w = whole[0]
      assert.ok(w.x > e.x && w.x < e.x + e.w && w.y > e.y && w.y < e.y + e.h, `${c}: the whole inside the field`)
      const units = draft.marks.filter((m) => m !== w)
      const first = [...units].sort((a, b) => a.y - b.y || a.x - b.x)[0]
      assert.ok(!(w.y < first.y && w.x <= first.x), `${c}: not the heading place`)
    }
  })

  test('雨: stroke units are the whole cut to one island, at the whole\'s own scale', () => {
    const { draft } = compose('雨')
    const whole = draft.marks.find((m) => m.char === '雨' && !m.keep)!
    const cut = draft.marks.filter((m) => m.keep)
    assert.ok(cut.length > 0)
    for (const m of cut) assert.equal(m.size, whole.size)
  })

  test('闇 囚: the whole at the interface takes a contained unit\'s place (not set apart on the white)', () => {
    for (const c of '闇囚') {
      const { draft, trace } = compose(c)
      const face = trace.geometry.detail!.interfaceAt!
      assert.ok(face.cell, c)
      const inner = trace.geometry.detail!.ring!
      const contained = draft.marks.filter((m) => m.char === inner.innerItem)
      assert.equal(contained.length, inner.innerCols * inner.innerRows - 1, c)
    }
  })

  test('辻: nothing on the roads but the whole at the crossing', () => {
    const { draft, trace } = compose('辻')
    const g = trace.geometry.detail!.grid!
    const midX = g.x0 + 2.5 * g.sx
    const midY = g.y0 + 2.5 * g.sy
    for (const m of draft.marks) if (Math.abs(m.x - midX) < 1 || Math.abs(m.y - midY) < 1) assert.equal(m.char, '辻')
  })

  test('悲: the parts written apart as characters in their own right, one measure, the seam between', () => {
    const { draft } = compose('悲')
    assert.deepEqual(draft.marks.map((m) => m.char).sort(), ['心', '非'].sort())
    assert.equal(draft.marks[0].size, draft.marks[1].size)
    const [a, b] = [...draft.marks].sort((x, y) => x.y - y.y)
    assert.ok(b.y - a.y > a.size, 'a seam of white between')
    for (const m of draft.marks) assert.equal(m.represents, 0)
  })
})

describe('Layout: §15.3 on every page', () => {
  test('no invariant broken: every title character is on the page, finite, inside the page', () => {
    for (const t of ALL) {
      const { draft, input } = compose(t)
      const gs = [...input.text].map((c, i) => ({ c, i })).filter((g) => g.c.trim())
      for (const m of draft.marks) {
        assert.ok(Number.isFinite(m.x) && Number.isFinite(m.y) && Number.isFinite(m.size) && m.size > 0, `${t}: ${JSON.stringify(m)}`)
        assert.ok(m.x >= 0 && m.x <= 1000 && m.y >= 0 && m.y <= 1000, `${t}: ${m.char} off the page`)
      }
      const written = new Set(draft.marks.flatMap((m) => [m.grapheme, m.represents]).filter((v) => v !== undefined))
      // grapheme indices are the analysis's; for these titles they are the code points' order
      for (const g of gs) assert.ok(written.has(g.i) || draft.marks.some((m) => m.char === g.c && m.grapheme !== undefined), `${t}: ${g.c} lost`)
    }
  })

  test('only the title\'s characters and the components its structure guarantees are written, never a variant alone (R4)', () => {
    for (const t of ALL) {
      const { draft } = compose(t)
      const { ok, variants } = allowed(t)
      for (const m of draft.marks) {
        assert.ok(ok.has(m.char), `${t}: ${m.char} is neither the title's nor a component of it`)
        if (!m.keep) assert.ok(!variants.has(m.char) || [...t].includes(m.char), `${t}: the variant ${m.char} alone`)
      }
    }
  })

  test('淋 海 血 州: (rule, count, singleton cell, whitespace) differ between them', () => {
    const sig = [...'淋海血州'].map((c) => {
      const g = compose(c).trace.geometry
      return JSON.stringify([compose(c).rationale.plan, g.count, g.singleton?.cell ?? null, g.whitespace.map((w) => w.cause)])
    })
    assert.equal(new Set(sig).size, 4)
  })

  test('a title\'s characters written as themselves share one size, beside a field (the rest of the title at the unit)', () => {
    for (const t of ['川または州', '国際空港', '木と林と森']) {
      const { draft, trace } = compose(t)
      const rest = draft.marks.filter((m) => m.role === 'context')
      assert.ok(rest.length > 0, t)
      for (const m of rest) assert.ok(Math.abs(m.size - Math.min(trace.geometry.unitSize, 0.16 * FRAME.w)) < 0.6, `${t}: ${m.char} ${m.size} against the unit ${trace.geometry.unitSize}`)
    }
  })

  test('a reduplication parts its line at each return (ころ | ころ); the recurrence is kept only where the line shows it', () => {
    const c = compose('ころころ')
    const line = c.trace.geometry.detail!.line!
    assert.deepEqual([...line.breaks], [2])
    assert.ok(c.rationale.constraints.some((x) => x.kind === 'recurrence'))
  })

  test('nothing found: the title once, the longer title longer, not smaller than a quarter of a one-character title', () => {
    const one = compose('月').draft.marks[0].size
    const five = compose('あいうえお').draft.marks
    assert.equal(five.length, 5)
    for (const m of five) assert.ok(m.size >= one / 4 && m.size < one)
  })

  test('the same title gives the same page', () => {
    for (const t of ALL) assert.equal(JSON.stringify(compose(t).draft), JSON.stringify(compose(t).draft), t)
  })

  test('the composition reads no fixture and no benchmark list; no random number', () => {
    for (const dir of ['src/v2/layout', 'src/v2/field']) for (const f of readdirSync(join(root, dir))) {
      const src = readFileSync(join(root, dir, f), 'utf8')
      assert.ok(!/fixtures|Math\.random|crypto/.test(src), `${dir}/${f}`)
    }
    const src = readFileSync(join(root, 'src/v2/compose.ts'), 'utf8')
    assert.ok(!/fixtures|Math\.random|tools\//.test(src))
  })

  test('the evaluation page is a development tool: nothing in src reads it', () => {
    const walk = (d: string): string[] => readdirSync(join(root, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]))
    for (const f of walk('src')) assert.ok(!readFileSync(join(root, f), 'utf8').includes('v2/eval'), f)
  })
})

export type { Mark }
