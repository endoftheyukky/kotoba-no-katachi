/**
 * 勾配格子 — GRADIENT LATTICE (v2)
 *
 *   linguistic input  a repetition the page already lays in two dimensions,
 *                     each grounded in the title: along one, the reading (the
 *                     title's characters in their order); across the other, a
 *                     grouping the title measures — the occurrences of the unit
 *                     it repeats, each on its own row of a grid, or the lines
 *                     of a field, which are the title written again and again.
 *   rule              the lattice keeps its two dimensions and changes
 *                     continuously along one of them. On a grid, each row
 *                     is read again: every cell a little smaller than the one
 *                     before it, its own characters first, and then the row
 *                     goes on with them in the room that frees, until a cell
 *                     would be smaller than a grain, meets writing, or the
 *                     page ends. On a
 *                     field, the lines themselves shrink one after another
 *                     from where the reading begins, each written through
 *                     with the title, so that scale, spacing and the number of
 *                     marks change together down the page; where the title
 *                     reads the same both ways, from the middle line outward.
 *                     A field covers what it covered before, no more.
 *   visual output     a repetition that is no longer uniform: a surface of the
 *                     title that recedes.
 *
 * Plastic: how much the lattice changes over its length (a field from 2.5 to 4
 * times, within the page's bands; a grid's row by 0.66–0.74 a cell). The
 * direction, and what the rows are, are not.
 */
import { PAGE } from '../../render/stage'
import { TEXTURE } from '../contract'
import { unitMarks, allUnits } from '../spatial/common'
import type { Mark } from '../types'
import { derive, free, GRAIN_MIN, within, type MarkGrammar } from './common'
import type { PageView } from './page'

interface Row {
  marks: Mark[]
  chars: string[]
  from: number[]
}

/** a grid whose rows are the occurrences of the repeated unit, each on its own line */
function gridRows(v: PageView): Row[] | null {
  if (v.spatial.id !== 'grid') return null
  const f = v.m.primary.focus
  const red = v.a.relations.find((r) => r.kind === 'reduplication')
  const occ = f.kind === 'repetition' && !f.sound ? f.occurrences : red?.kind === 'reduplication' ? red.occurrences : null
  if (!occ || occ.length < 2) return null
  const vertical = v.a.direction === 'vertical'
  const rows = occ.map((o) => {
    // every mark of the occurrence, a residue as much as a whole character: the row ends where its last mark is
    const marks = v.body.filter((k) => k.grapheme !== undefined && o.includes(k.grapheme))
    return { marks, chars: o.map((g) => v.a.graphemes[g].char), from: o }
  })
  if (rows.some((r) => !r.marks.length)) return null
  // each occurrence on its own line: rows that do not share a line
  const line = (r: Row) => r.marks.reduce((s, k) => s + (vertical ? k.x : k.y), 0) / r.marks.length
  const size = Math.min(...rows.flatMap((r) => r.marks.map((k) => k.size)))
  const lines = rows.map(line).sort((p, q) => p - q)
  if (lines.some((l, i) => i > 0 && l - lines[i - 1] < size * 0.6)) return null
  return rows
}

/** a grid whose rows are the occurrences of what the title repeats (v2 selection) */
export function occurrenceGrid(v: PageView): boolean {
  return !!gridRows(v)
}

function fieldPage(v: PageView): boolean {
  return v.spatial.id === 'field' && v.body.length >= 8
}

export const lattice: MarkGrammar = {
  id: 'lattice',
  title: '勾配格子',
  rules: [
    '二つの次元がどちらも題に根拠をもつ反復だけ：一方は読みの順、もう一方は題が測る群（反復単位の出現がそれぞれ一行をなす格子、または題を書き継いだ行でできた場）',
    '格子は二つの次元を保ち、その一方に沿って連続的に変わる。格子では、各行が読みの向きに一つごとに少し小さくなり（まず行自身の字、次に空いた余地へ同じ字の続き）、粒より小さくなるか、書かれたものに当たるか、紙面が終わるところまで続く',
    '場では、行そのものが読みの始まりから一行ごとに小さくなり、どの行も題で書き継がれる：大きさ・間隔・字の数が紙面を下るにつれて一緒に変わる。題が前後どちらから読んでも同じなら、中央の行から外へ',
    '場は、それまで覆っていた範囲を越えない',
    '格子が変わる量（場は全体で2.5〜4倍、格子の行は一つごとに0.66〜0.74倍）は造形。向きと、行が何であるかは造形ではない',
  ],

  offer(v) {
    const rows = gridRows(v)
    if (rows)
      return {
        grounds: [`格子の${rows.length}行は反復の出現（${rows.map((r) => r.chars.join('')).join('｜')}）：各行が読みの向きに縮みながら続く`],
        uses: [{ property: 'rows', value: rows.map((r) => r.chars.join('')).join('|') }],
      }
    if (fieldPage(v)) {
      const mirror = v.a.relations.some((r) => r.kind === 'mirror')
      return {
        grounds: [`題を書き継いだ行の場：行が${mirror ? '中央から外へ' : '読みの始まりから'}一行ごとに小さくなる`],
        uses: [{ property: 'lines', value: mirror ? 'from centre' : 'from start' }],
      }
    }
    return null
  },

  apply(v, rng) {
    const vertical = v.a.direction === 'vertical'
    const rows = gridRows(v)
    if (rows) {
      // a grid's cells are large: the step must be steep enough to free room within the page
      const q = within(rng, 0.66, 0.74)
      const moved = new Map<Mark, Mark>()
      const added: Mark[] = []
      const along = (k: Mark) => (vertical ? k.y : k.x)
      for (const r of rows) {
        // the row as it is read: its own marks first, each smaller than the last, then the row goes on
        const own = [...r.marks].sort((p, q2) => along(p) - along(q2))
        const fixed = vertical ? own[0].x : own[0].y
        let s = own[0].size
        let at = along(own[0]) - s / 2
        for (let i = 0; ; i++) {
          const centre = at + s / 2
          if (i < own.length) {
            const k = own[i]
            moved.set(k, { ...k, ...(vertical ? { y: centre } : { x: centre }), size: k.size * (s / own[0].size) })
          } else {
            if (s < GRAIN_MIN * PAGE || centre + s / 2 > PAGE - PAGE * 0.02) break
            const x = vertical ? fixed : centre
            const y = vertical ? centre : fixed
            const others = v.marks.filter((k) => !r.marks.includes(k)).map((k) => moved.get(k) ?? k)
            // a row does not pass over writing: where it would, it ends
            if (!free(v, others, added, x, y, s)) break
            added.push({
              char: r.chars[i % r.chars.length],
              x,
              y,
              size: s,
              role: 'trace',
              derived: derive('lattice', 'repeat', `行「${r.chars.join('')}」が読みの向きに縮みながら続く`, r.from[i % r.from.length]),
            })
          }
          at += s * 1.04
          s *= q
        }
      }
      return [...v.marks.map((k) => moved.get(k) ?? k), ...added]
    }
    if (!fieldPage(v)) return v.marks

    // the field again, its lines shrinking: over the same extent it covered
    const units = allUnits(v.m)
    const n = units.length
    const along = (k: Mark) => (vertical ? PAGE - k.x : k.y)
    const extent = Math.min(PAGE, Math.max(...v.body.map((k) => along(k) + k.size / 2)))
    const mirror = v.a.relations.some((r) => r.kind === 'mirror')
    const large = Math.min(0.13, TEXTURE[1] * 1.4) * PAGE
    const ratio = within(rng, 2.5, 4)
    const small = Math.max(GRAIN_MIN * PAGE, large / ratio)
    // how many lines: shrinking geometrically from large to small, they must fill the extent
    const sizes = (count: number) => {
      const q = count > 1 ? Math.pow(small / large, 1 / (count - 1)) : 1
      const one = Array.from({ length: count }, (_, l) => large * Math.pow(q, l))
      if (!mirror) return one
      // from the middle line outward: the same sequence on both sides
      const half = one.slice(0, Math.ceil(count / 2))
      return [...half.slice(1).reverse(), ...half].slice(0, count)
    }
    let count = 2
    while (sizes(count + 1).reduce((t, s) => t + s, 0) <= extent) count++
    const ss = sizes(count)
    // what is left of the extent is shared out between the lines, in proportion
    const stretch = extent / ss.reduce((t, s) => t + s, 0)
    const out: Mark[] = [...v.context]
    let k = 0
    let pos = 0
    for (const s of ss) {
      const line = s * stretch
      const centre = pos + line / 2
      for (let c = s / 2; c <= PAGE - s / 2 + 0.01; c += s) {
        const at = vertical ? { x: PAGE - centre, y: c } : { x: c, y: centre }
        out.push(...unitMarks(v.a, units[k % n], at, s * 0.96))
        k++
      }
      pos += line
    }
    return out
  },
}
