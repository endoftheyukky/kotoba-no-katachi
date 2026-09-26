// v2 Stage 9 (spec-1 §16): Layout and the whole composition. §15.2 and §15.3 on the pages themselves; the
// images are looked at with tools/v2/eval.mjs (the tests do not judge a page, they keep it honest).
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import type { Mark } from '../src/poem/types'
import { FRAME } from '../src/v2/field'
import type { IdsNode } from '../src/v2/types/structure'
import { composeV2 } from '../src/v2/compose'
import { composeNode, fileSource, observeNode, root } from './v2-node'

const BENCHMARK = [...'雨闇淋林州血囚辻悲']
const CONTROLS = [...'海問品森玉晶轟好男国閣日琳田回']
const LONGER = ['雨の中の雨', '木と林と森', '川または州', '見えない', 'ころころ', '触る', '音楽', '国際空港', '私の影を踏まないでください！', 'あいうえお', 'Good morning!']
const ALL = [...BENCHMARK, ...CONTROLS, ...LONGER]
const EXTRA = ['淋', '海', '血', '州', '国際空港', 'ころころ', '月', 'あいうえお']
// the relations between a title's own glyphs are v1's reading in the browser (glyph metrics); the node tests
// compose without them, the evaluation pages with them
const pages = new Map(await Promise.all([...new Set([...ALL, ...EXTRA])].map(async (t) => {
  const o = await observeNode(t)
  return [t, { o, c: composeV2(o) }] as const
})))
function compose(text: string) {
  const p = pages.get(text)
  if (!p) throw new Error(`not composed: ${text}`)
  return p.c
}

function leaves(n: IdsNode, out: { char: string; tier: string }[] = []) {
  if (n.kind === 'leaf') out.push({ char: n.char, tier: n.tier })
  else for (const c of n.children) leaves(c, out)
  return out
}
/** the characters a page may write: the title's own, and the components its characters' structures guarantee (R4), never a variant alone */
function allowed(text: string) {
  const structureOf = pages.get(text)!.o.tables.structure
  const ok = new Set<string>([...text])
  const variants = new Set<string>()
  for (const c of new Set(text)) {
    const s = structureOf.lookup(c)
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

  test('the rest of a longer title: written once, at one size no larger than the figure\'s measure (TODO-10)', () => {
    for (const t of ['川または州', '国際空港', '木と林と森', '雨の中の雨', '触る', '音楽']) {
      const { draft, trace } = compose(t)
      const flows = trace.geometry.detail!.flows ?? []
      assert.ok(flows.length > 0, t)
      const sizes = new Set(flows.map((f) => f.size))
      assert.equal(sizes.size, 1, `${t}: one size for the rest`)
      const g = trace.geometry
      const measure = g.detail?.strokeUnit && g.singleton ? g.unitSize * g.singleton.scale : g.unitSize
      for (const f of flows) assert.ok(f.size <= Math.min(measure, 0.16 * FRAME.w) + 0.6, `${t}: ${f.size} against ${measure}`)
      for (const f of flows) for (const p of f.points) assert.equal(draft.marks.filter((m) => m.grapheme === p.grapheme).length, 1, `${t}: grapheme ${p.grapheme} written once`)
    }
  })

  test('a title\'s character the figure repeats as its unit is written by the figure\'s first unit of it (木と林と森: the title\'s 木 among the units of 林)', () => {
    const { draft } = compose('木と林と森')
    const ki = draft.marks.filter((m) => m.char === '木')
    assert.equal(ki.filter((m) => m.grapheme === 0).length, 1)
    assert.ok(ki.filter((m) => m.derived).length > 1)
  })

  test('a reduplication returns: each repeat a line of its own from the head (ころ | ころ); the recurrence is kept where the page shows it', () => {
    const c = compose('ころころ')
    const f = c.trace.geometry.detail!.flow!
    assert.ok(f.behaviours.includes('return'))
    const [a, b] = [f.points.find((p) => p.grapheme === 0)!, f.points.find((p) => p.grapheme === 2)!]
    assert.ok(Math.abs(a.y - b.y) < 0.6 && b.x < a.x, 'the repeat starts at the head, beside the first (vertical: to its left)')
    const rec = c.rationale.constraints.filter((x) => x.kind === 'recurrence' && x.unit === 'token')
    assert.ok(rec.length && c.trace.geometry.satisfies.includes(rec[0].id))
  })

  test('nothing found: the title once, the longer title longer, not smaller than a quarter of a one-character title', () => {
    const one = compose('月').draft.marks[0].size
    const five = compose('あいうえお').draft.marks
    assert.equal(five.length, 5)
    for (const m of five) assert.ok(m.size >= one / 4 && m.size < one)
  })

  test('the same title gives the same page', async () => {
    for (const t of ALL) assert.equal(JSON.stringify((await composeNode(t)).draft), JSON.stringify(compose(t).draft), t)
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
