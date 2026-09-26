// v2 Stage 10 (spec-1 §16, §9.3, TODO-10): the flow of a line, and a longer title's figure in its line. Every
// shape a line takes names the relation that caused it; a line of writing stays a line that reads in its order.
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { FRAME } from '../src/v2/field'
import { flowOf } from '../src/v2/field/flow'
import { composeNode, observeNode } from './v2-node'
import { constrain } from '../src/v2/constraints'
import { discover, select } from '../src/v2/discovery'
import { leavesOf, resonate } from '../src/v2/resonance'

/** the flow of a whole title, as Sequence walks it, at a given room (steps along) */
async function flow(text: string, wrapAt = Infinity, reading?: string) {
  const o = await observeNode(text, reading)
  const din = { language: o.language, structure: o.tables.structure, align: o.tables.align, relations: o.titleRelations }
  const ds = discover(din)
  const sel = select(ds, din)
  const ev = resonate(ds, sel, o.tables.resonance, leavesOf(o.tables.structure), (g) => o.language.graphemes[g]?.char)
  const cs = constrain(ds, sel, ev, o.language).constraints
  const gs = o.language.graphemes.map((g) => g.index)
  return { f: flowOf(gs, cs, o.language, wrapAt), cs, o }
}
const kinds = (f: { behaviours: readonly { kind: string }[] }) => new Set(f.behaviours.map((b) => b.kind))

describe('the flow of a line: its shapes, each from a relation', () => {
  test('a sound heard again after another turns the line (かなしいかな); a mirror closes it (たけやぶやけた)', async () => {
    assert.ok(kinds((await flow('かなしいかな')).f).has('curve'))
    const m = await flow('たけやぶやけた')
    const c = m.f.behaviours.find((b) => b.kind === 'curve')!
    assert.ok(c && m.cs.find((x) => x.id === c.because)?.kind === 'recurrence')
  })

  test('no curve for a mark written twice that is not a sound returning (コーヒー: ー), nor a mora doubled in place (ささやき)', async () => {
    for (const t of ['コーヒー', 'ささやき']) assert.ok(!kinds((await flow(t)).f).has('curve'), t)
  })

  test('no curve on a line of two characters', async () => {
    for (const t of ['東京', '入口', '休日']) assert.ok(!kinds((await flow(t)).f).has('curve'), t)
  })

  test('a reduplication inside a word returns at its repeat (かえる ぴょこ | ぴょこ), never bent, and reads in order', async () => {
    const { f, o } = await flow('かえるぴょこぴょこ')
    assert.ok(kinds(f).has('return') && !kinds(f).has('curve'))
    assert.deepEqual(f.lines.map((l) => l.length), [6, 3])
    // the repeat starts at the head of the next line (vertical: to the left; horizontal: below), level with the first
    const [a, b] = [f.points.find((p) => p.grapheme === 3)!, f.points.find((p) => p.grapheme === 6)!]
    if (o.language.direction === 'vertical') assert.ok(Math.abs(a.y - b.y) < 0.01 && b.x < a.x)
    else assert.ok(Math.abs(a.x - b.x) < 0.01 && b.y > a.y)
  })

  test('a character doubled inside a longer word is not a reduplication of a word (ささやき, 東京特許許可局): no return', async () => {
    for (const t of ['ささやき', '東京特許許可局']) assert.ok(!kinds((await flow(t)).f).has('return'), t)
  })

  test('words part into lines only where the lines still read as lines; else by a half step along the line', async () => {
    assert.ok(kinds((await flow('夜の位置')).f).has('verse'))
    const s = await flow('手と足')
    assert.ok(kinds(s.f).has('gap') && !kinds(s.f).has('verse'))
    assert.equal(s.f.lines.length, 1)
  })

  test('where the page ends a line: two characters a line at least, no wider across than long, at a word\'s beginning, never a line opening on ！ or a small kana', async () => {
    for (const t of ['私の影を踏まないでください！', '今日も明日も雨が降るでしょう', 'かえるぴょこぴょこ', '空をさがせ！'])
      for (const room of [1, 2, 3, 4]) {
        const { f, o } = await flow(t, room)
        const written = (l: readonly number[]) => l.filter((g) => o.language.graphemes[g].char.trim()).length
        const wraps = new Set(f.behaviours.filter((b) => b.kind === 'wrap').flatMap((b) => b.at))
        // the lines one line broke into: each two characters at least, together no wider across than long
        const groups: (readonly number[])[][] = []
        for (const l of f.lines) (wraps.has(l[0]) ? groups[groups.length - 1] : groups[groups.push([]) - 1]).push(l)
        for (const gr of groups.filter((x) => x.length > 1)) {
          for (const l of gr) assert.ok(written(l) >= 2, `${t} @${room}: a line of ${written(l)}`)
          assert.ok(Math.max(...gr.map(written)) >= gr.length * 1.3, `${t} @${room}: ${gr.length} lines`)
        }
        for (const g of wraps) assert.ok(!/[！？、。ーぁぃぅぇぉゃゅょっ]/.test(o.language.graphemes[g].char), `${t} @${room}: a line opens on ${o.language.graphemes[g].char}`)
      }
    // at a word's beginning: が降る | でしょう is one word to v1, so it breaks inside it; 今日も 明日も part at 明日
    const { f } = await flow('今日も明日も', 3)
    assert.ok(!f.lines.some((l) => l[0] === 4), 'not inside 明日')
  })

  test('a word in letters or a number is not split inside: it stays one line (Stage 11)', async () => {
    for (const [t, room] of [['morning', 3], ['Good morning!', 3], ['12345678', 3], ['2026年の春', 2]] as const) {
      const { f, o } = await flow(t, room)
      const w = (g: number) => /^[\p{Script=Latin}\p{Nd}]$/u.test(o.language.graphemes[g].char)
      for (let i = 1; i < f.lines.length; i++) {
        const a = f.lines[i - 1][f.lines[i - 1].length - 1]
        const b = f.lines[i][0]
        assert.ok(!(w(a) && w(b) && o.language.tokenOf[a] === o.language.tokenOf[b]), `${t} @${room}: split inside ${o.language.graphemes[a].char}${o.language.graphemes[b].char}`)
      }
    }
  })
})

describe('a longer title: the figure in its line', () => {
  test('a long title keeps a large figure; the rest is written once, at the figure\'s unit, in reading order', async () => {
    for (const t of ['私の影を踏まないでください！', '今日も明日も雨が降るでしょう']) {
      const c = await composeNode(t)
      const g = c.trace.geometry
      assert.ok(g.extent && (g.extent.w * g.extent.h) / (FRAME.w * FRAME.h) > 0.2, `${t}: the figure ${g.extent && Math.round((100 * g.extent.w * g.extent.h) / (FRAME.w * FRAME.h))}% of the frame`)
      const flows = g.detail!.flows!
      const pts = flows.flatMap((f) => f.points)
      assert.equal(new Set(pts.map((p) => p.grapheme)).size, pts.length)
      assert.equal(new Set(flows.map((f) => f.size)).size, 1)
    }
  })

  test('beside: the words before the figure on the line before it, the words after on the next, each from the head (vertical: right, then left)', async () => {
    const c = await composeNode('商品')
    const g = c.trace.geometry
    assert.ok(g.causes.some((x) => (x.value as { way?: string })?.way === 'beside'))
    const sho = g.detail!.flows![0].points[0]
    assert.ok(g.extent && sho.x > g.extent.x + g.extent.w, '商 on the line before 品: to its right')
  })

  test('every page keeps its invariants: the composition is the same twice', async () => {
    for (const t of ['私の影を踏まないでください！', '今日も明日も雨が降るでしょう', '商品', '白い 犬']) {
      const [a, b] = [await composeNode(t), await composeNode(t)]
      assert.equal(JSON.stringify(a.draft), JSON.stringify(b.draft))
    }
  })
})
