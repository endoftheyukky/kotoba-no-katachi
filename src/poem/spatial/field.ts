/**
 * 場 — FIELD
 * A title that is repetition through and through covers the page.
 */
import { clamp } from '../../core/math'
import { PAGE } from '../../render/stage'
import type { SpatialComposition, Vec } from '../types'
import { allUnits, unitMarks } from './common'

export const field: SpatialComposition = {
  id: 'field',
  title: '場',
  accepts: ['repetition', 'plain'],
  rules: [
    '題全体が反復でできているとき（ころころ・人々）、題は紙面を覆う場になる',
    '題は字間なしに書き継がれる。一行は（字数×2＋1）マス：行ごとに一字ずれ、同じ字は斜めの層をなす（短い題ほど字は大きい）',
    '場が紙面を覆う割合 ＝ 反復の強さ×被覆。書き終えた先は白。書き始めは紙面の外にある',
    '場が保つのは「いくつあるか」だけである：席も、群の境も、欠けた枡も残らない。題がそれらを測れる形で持っているなら、場はその分だけ題を失う構成になる',
  ],

  offer(_a, m) {
    const f = m.primary.focus
    if (m.primary.op !== 'proliferation') return []
    const uses: { property: string; value: string }[] = []
    const losses: { property: string; value: string }[] = []
    const grounds: string[] = []

    // what the field is for: many of the same thing, and the many is the subject
    let fitness: number
    if (f.kind === 'repetition' && f.whole) {
      fitness = 0.9
      uses.push({ property: 'repeats', value: `${f.occurrences.length}` }, { property: 'covers', value: '題全体' })
      grounds.push('題全体が反復している → 紙面を覆う')
    } else if (f.kind === 'repetition') {
      fitness = 0.3 + 0.2 * m.primary.linguisticSalience.coverage
      uses.push(
        { property: 'repeats', value: `${f.occurrences.length}` },
        { property: 'covers', value: m.primary.linguisticSalience.coverage.toFixed(2) },
      )
      grounds.push('題の一部が反復する')
    } else {
      fitness = 0.3
      grounds.push('反復の根拠がない：書き継ぐことだけが残る')
    }

    // What a field cannot keep. Copies poured over the page hold the count and
    // nothing else: where the title carries structure that can be measured —
    // a grouping, an empty place in the sequence — writing it as a field is
    // writing less of the title than was read.
    let loss = 0
    if (f.kind === 'repetition') {
      const groups = f.occurrences.length
      const inGroup = Math.max(...f.occurrences.map((g) => g.length))
      if (groups >= 2 && inGroup >= 2) {
        loss += 0.2
        losses.push({ property: 'grouping', value: `${groups}×${inGroup}` })
        grounds.push(`群の境（${groups}群×${inGroup}単位）は場では残らない`)
      }
    }
    const missing = m.tokens.flat().filter((u) => u.absent).length
    if (missing) {
      loss += 0.15
      losses.push({ property: 'empty places', value: `${missing}` })
      grounds.push('欠けた場所は、場では空いた枡として読めない')
    }

    return [
      {
        id: 'field',
        mode: 'field',
        uses,
        losses,
        grounds,
        fitness: clamp(fitness * (1 - loss)),
        realisable: true,
        demand: { reach: 1, spread: 'field', minSize: 0 },
      },
    ]
  },

  fit(a, m) {
    const [r] = this.offer!(a, m)
    return r ? { id: 'field', score: r.fitness, grounds: r.grounds } : null
  },

  realize(a, m, rng, scale) {
    const units = allUnits(m)
    const n = units.length
    const vertical = a.direction === 'vertical'
    // 造形: the grid may be a little finer or coarser; the cell stays within the scale's range
    const [lo, hi] = scale.range('body')
    const s = clamp(PAGE / (clamp(2 * n, 5, 12) + rng.pick([-1, 0, 0, 1])), lo, hi)
    const span = Math.round(PAGE / s)
    const lineLength = span + 1
    const cells: Vec[] = []
    for (let l = 0; l <= span; l++)
      for (let c = 0; c < lineLength; c++) cells.push(vertical ? { x: PAGE - l * s, y: c * s } : { x: c * s, y: l * s })
    const { relationStrength, coverage } = m.primary.linguisticSalience
    const fill = clamp(0.3 + 0.65 * relationStrength * coverage, 0.3, 0.95)
    const used = Math.round(cells.length * fill)
    return { marks: cells.slice(0, used).flatMap((at, k) => unitMarks(a, units[k % n], at, s * 0.96)) }
  },
}
