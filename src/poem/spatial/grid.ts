/**
 * 格子 — GRID / TILING
 *
 * A field is ground; a grid has addresses. The difference is that a cell can
 * be empty and be read as empty, and that a cell can hold a module rather
 * than a single character.
 *
 * Two ways, and only where the structure is measured:
 *
 *   1×N  the beats of a word laid out at one pitch, with the silent mora's
 *        square left open (きっと → き □ と). The square is a beat, not a
 *        character, so a palatal mora keeps two characters in one square.
 *   N×M  a repetition that is already grouped: the groups are the lines, the
 *        units inside a group are the cells along the reading. ころころ is
 *        two groups of two, so it is two columns of two — not a hundred
 *        characters poured over the page.
 *
 * A grid is never offered merely because something can be counted. 1×N needs
 * a square that is empty; N×M needs a grouping the language itself shows (a
 * reduplication, the morae of a token) with at least two groups of at least
 * two. With no grouping there is no second dimension to invent, and a row of
 * identical cells with nothing missing is a band, not a grid.
 */
import { clamp } from '../../core/math'
import { PAGE } from '../../render/stage'
import { gridReadable } from '../potential'
import type { Analysis, Mark, Material, Realization, SpatialComposition, Unit } from '../types'
import { allUnits, centredLine, directions, isWritten } from './common'

/** the grid keeps this much of the page at most */
const EXTENT = 0.86

interface Shape {
  /** cells along the reading direction */
  cols: number
  /** lines of cells, advancing the way lines advance */
  rows: number
  /** cell (row, col) → the units written in it; empty for an open square */
  cells: Unit[][][]
}

/** the beats of the title, one square each */
function beatShape(a: Analysis, m: Material): Shape | null {
  const read = a.morae.filter((mo) => mo.kind !== 'unread')
  if (!read.length) return null
  const units = allUnits(m)
  const cells = [read.map((mo) => units.filter((u) => mo.graphemes.includes(u.grapheme) && isWritten(u)))]
  return { cols: read.length, rows: 1, cells }
}

/** a repetition that is already grouped: groups × units in a group */
function groupShape(_a: Analysis, m: Material): Shape | null {
  const f = m.primary.focus
  if (f.kind !== 'repetition') return null
  const groups = f.occurrences
  if (groups.length < 2) return null
  const cols = Math.max(...groups.map((g) => g.length))
  if (cols < 2) return null
  const units = allUnits(m)
  const cells = groups.map((g) =>
    Array.from({ length: cols }, (_, i) =>
      g[i] === undefined ? [] : units.filter((u) => u.grapheme === g[i] && isWritten(u)),
    ),
  )
  return { cols, rows: groups.length, cells }
}


export const grid: SpatialComposition = {
  id: 'grid',
  title: '格子',
  accepts: ['absence', 'repetition'],
  // the grid is measured: it stays on the page
  bleed: false,
  rules: [
    '格子は場ではない：枡には番地があり、空いた枡は空いたものとして読める',
    '1×N：拍は等時の単位なので、一拍を一枡とする。促音の枡は空く。枡は字ではなく拍なので、拗音は二字で一枡に入る',
    'N×M：すでに群に分かれている反復では、群が行になり、群の中の単位が読みの向きの枡になる（ころ／ころ → 二列二枡）。群は書字が進む向きへ進む',
    '第二の次元は作らない：言語が示す群分け（畳語、語ごとの拍）が無ければ 1×N しか作らない。欠けた枡もない同じ枡の一列は、格子ではなく帯である',
    '枡はすべて同じ大きさで、同じ間隔で並ぶ。変化がないことが、欠けた一枡を読ませる',
  ],

  offer(a, m) {
    const out: Realization[] = []
    const f = m.primary.focus

    // 1×N — the beats, with the silent one's square open
    if (f.kind === 'absence' && gridReadable(f)) {
      const shape = beatShape(a, m)
      if (shape) {
        const filled = shape.cells[0].filter((c) => c.length).length
        const cell = (EXTENT * PAGE) / shape.cols
        out.push({
          id: 'grid',
          mode: '1xN',
          uses: [
            { property: 'beats', value: `${f.beats}` },
            { property: 'empty cells', value: `${f.silentMorae.length}` },
            { property: 'filled cells', value: `${filled}` },
          ],
          grounds: [`拍は等時の単位 → ${f.beats}拍を${f.beats}枡に、${f.silentMorae.length}枡を空けて`],
          fitness: 0.85 * (0.7 + 0.3 * (filled / Math.max(1, shape.cols))),
          realisable: cell * 0.88 >= 0.055 * PAGE,
          demand: { reach: EXTENT, spread: 'line', minSize: (cell * 0.88) / PAGE, cells: shape.cols },
        })
      }
    }

    // N×M — a repetition that language has already grouped
    const g = groupShape(a, m)
    if (g && f.kind === 'repetition') {
      const cell = (EXTENT * PAGE) / Math.max(g.cols, g.rows)
      const full = g.cells.flat().filter((c) => c.length).length
      out.push({
        id: 'grid',
        mode: `${g.rows}x${g.cols}`,
        uses: [
          { property: 'groups', value: `${g.rows}` },
          { property: 'units in a group', value: `${g.cols}` },
          { property: 'grouping', value: f.contiguous ? 'reduplication' : 'recurrence' },
          { property: 'filled cells', value: `${full}/${g.rows * g.cols}` },
        ],
        grounds: [
          `「${f.value}」は${g.rows}群×${g.cols}単位に分かれている → 群が行、単位が枡`,
          '群分けは言語が示したもので、枡の形は数がそのまま決める',
        ],
        fitness: 0.85 * clamp(0.7 + 0.15 * (g.rows - 1) + (f.contiguous ? 0.15 : 0)),
        realisable: cell * 0.88 >= 0.055 * PAGE,
        demand: { reach: EXTENT, spread: 'field', minSize: (cell * 0.88) / PAGE, cells: g.rows * g.cols },
      })
    }
    return out
  },

  fit(a, m) {
    const [r] = this.offer!(a, m).filter((o) => o.realisable)
    return r ? { id: 'grid', score: r.fitness, grounds: r.grounds } : null
  },

  realize(a, m, rng, _scale, r) {
    const mode = r?.mode ?? '1xN'
    const { vertical } = directions(a)
    const shape = mode === '1xN' ? beatShape(a, m) : groupShape(a, m)
    if (!shape) return { marks: [] }

    const cell = (EXTENT * PAGE) / Math.max(shape.cols, shape.rows)
    const size = cell * 0.88
    const originAlong = (PAGE - (shape.cols - 1) * cell) / 2
    const originAcross = (PAGE - (shape.rows - 1) * cell) / 2
    // 造形: where a single line of squares crosses the page
    const single = shape.rows === 1 ? clamp(offset(rng), 0.14 * PAGE, 0.86 * PAGE) : 0
    const place = (col: number, row: number) => {
      const t = originAlong + col * cell
      const c = shape.rows === 1 ? single : originAcross + row * cell
      // lines advance the way lines advance: to the left when writing runs down
      return vertical ? { x: shape.rows === 1 ? c : PAGE - c, y: t } : { x: t, y: c }
    }

    const marks: Mark[] = []
    shape.cells.forEach((row, ri) =>
      row.forEach((units, ci) => {
        if (!units.length) return
        marks.push(...centredLine(a, units, place(ci, ri), size / units.length))
      }),
    )
    return { marks }
  },
}

/** 造形: a line of squares does not run down the middle of the page */
function offset(rng: { next(): number; range(lo: number, hi: number): number }): number {
  return (rng.next() < 0.5 ? rng.range(0.18, 0.36) : rng.range(0.64, 0.82)) * PAGE
}
