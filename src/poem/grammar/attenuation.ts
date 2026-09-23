/**
 * 減衰 — ATTENUATION (v2)
 *
 *   linguistic input  seats the poem writes as space, following a written one
 *                     (a negation erasing the end of a word, a silent beat);
 *                     or a unit the title writes again and again (a repetition
 *                     carried along a band or a field).
 *   rule              the last written seat does not stop at the erasure: it
 *                     goes on into the empty seats as its own echo, each echo
 *                     smaller than the one before and a little further off,
 *                     until it is too small to be a character or the empty
 *                     seats run out. A run of repeated marks shrinks along its
 *                     own order, from full size down to a grain.
 *   visual output     writing that fades where the language fades: a word
 *                     trailing off into the space its ending left, a
 *                     repetition dwindling as it goes on.
 *
 * The ratio of one echo to the next is plastic (0.66–0.78). Nothing fades
 * where the title gives no erasure and no repetition.
 */
import { PAGE } from '../../render/stage'
import type { Mark } from '../types'
import { derive, GRAIN_MIN, silentSeat, within, type MarkGrammar } from './common'
import type { PageView } from './page'

interface Erasure {
  /** the last written seat before the erased ones */
  from: PageView['seats'][number]
  /** the erased seats, in reading order */
  empty: PageView['seats']
  /** the first written seat after them, if any */
  to?: PageView['seats'][number]
}

function erasures(v: PageView): Erasure[] {
  const out: Erasure[] = []
  v.seats.forEach((s, i) => {
    if (!s.written) return
    const empty: PageView['seats'] = []
    let j = i + 1
    for (; j < v.seats.length && !v.seats[j].written; j++) empty.push(v.seats[j])
    if (empty.length) out.push({ from: s, empty, to: v.seats[j] })
  })
  return out
}

/** place echoes of a mark along a line, shrinking by q, until the line runs out */
function echoes(source: Mark, start: { x: number; y: number }, towards: { x: number; y: number }, len: number, q: number, note: string): Mark[] {
  const dx = towards.x - start.x
  const dy = towards.y - start.y
  const d = Math.hypot(dx, dy) || 1
  const out: Mark[] = []
  let size = source.size
  let t = 0
  for (let j = 1; ; j++) {
    const next = size * q
    // the step opens as the echo fades: each gap a little wider than the last
    t += ((size + next) / 2) * (1 + 0.12 * j)
    size = next
    if (size < GRAIN_MIN * PAGE || t > len) break
    out.push({
      char: source.char,
      x: start.x + (dx / d) * t,
      y: start.y + (dy / d) * t,
      size,
      role: 'trace',
      derived: derive('attenuation', 'echo', note, source.grapheme),
    })
  }
  return out
}

/** marks of the title written more than once, by character, in the order they were placed */
function runs(v: PageView): Mark[][] {
  const by = new Map<string, Mark[]>()
  for (const k of v.body) {
    if (k.keep || k.minus) continue
    by.set(k.char, [...(by.get(k.char) ?? []), k])
  }
  return [...by.values()].filter((r) => r.length >= 3)
}

export const attenuation: MarkGrammar = {
  id: 'attenuation',
  title: '減衰',
  rules: [
    '消された席の手前で書かれた字は、そこで止まらない：自分の残響として空いた席へ続き、一つごとに小さく、少しずつ離れていく。字として読めなくなるか、空いた席が尽きたところで終わる',
    '黙った拍（促音）の席は逆向き：促音は次の拍の子音が先に鳴っているものなので、次の字が小さな残響としてそこから育ち、本体に至る',
    '繰り返し書かれる字の並びは、並んだ順に小さくなる：最初は元の大きさ、終わりは粒',
    '一つの残響と次の比は造形（0.66〜0.78）。消去も反復もない題では何も減衰しない',
  ],

  offer(v) {
    const e = erasures(v)
    if (e.length)
      return {
        grounds: e.map((x) =>
          x.to && x.empty.every((s) => silentSeat(v, s.grapheme))
            ? `「${v.a.graphemes[x.to.grapheme]?.char}」の前の${x.empty.length}拍は黙っている → そこで「${v.a.graphemes[x.to.grapheme]?.char}」が小さく先に現れる`
            : `「${v.a.graphemes[x.from.grapheme]?.char}」の後の${x.empty.length}席は空として書かれる → そこへ残響が減衰していく`,
        ),
        uses: [{ property: 'erased seats', value: `${e.reduce((n, x) => n + x.empty.length, 0)}` }],
      }
    const r = runs(v)
    if (r.length)
      return {
        grounds: r.map((x) => `「${x[0].char}」が${x.length}回書かれる → 並んだ順に小さくなる`),
        uses: [{ property: 'repeated marks', value: r.map((x) => `${x[0].char}×${x.length}`).join(' ') }],
      }
    return null
  },

  apply(v, rng) {
    const q = within(rng, 0.66, 0.78)
    const e = erasures(v)
    if (e.length) {
      const marks = [...v.marks]
      const writes = (g: number) => v.body.find((k) => k.grapheme === g && !k.keep && !k.minus)
      for (const { from, empty, to } of e) {
        const last = empty[empty.length - 1]
        const silence = empty.every((s) => silentSeat(v, s.grapheme))
        const next = to && writes(to.grapheme)
        if (silence && to && next) {
          // a silent beat anticipates the next: its echoes run back from it,
          // smallest furthest, and stop short of the beat before
          const len = Math.hypot(to.x - from.x, to.y - from.y) - from.size / 2 - next.size / 2
          marks.push(...echoes(next, to, from, len, q, `黙った拍の席で「${next.char}」が先に鳴る`))
          continue
        }
        const source = writes(from.grapheme)
        if (!source) continue
        // along the seats, from the written one to the far edge of the last erased
        const len = Math.hypot(last.x - from.x, last.y - from.y) + last.size / 2
        marks.push(...echoes(source, from, last, len, q, `「${source.char}」が消された席へ減衰する`))
      }
      return marks
    }
    // a repetition dwindles along its own order
    const shrink = new Map<Mark, number>()
    for (const run of runs(v)) {
      const s = run[0].size
      const end = Math.max(GRAIN_MIN * PAGE, s * 0.22) / s
      run.forEach((k, j) => shrink.set(k, Math.pow(end, j / (run.length - 1))))
    }
    return v.marks.map((k) => {
      const f = shrink.get(k)
      return f === undefined ? k : { ...k, size: k.size * f, role: f < 0.999 ? 'trace' : k.role }
    })
  },
}
