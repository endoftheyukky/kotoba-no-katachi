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
  rules: [
    '題全体が反復でできているとき（ころころ・人々）、題は紙面を覆う場になる',
    '題は字間なしに書き継がれる。一行は（字数×2＋1）マス：行ごとに一字ずれ、同じ字は斜めの層をなす（短い題ほど字は大きい）',
    '場が紙面を覆う割合 ＝ 反復の強さ×被覆。書き終えた先は白。書き始めは紙面の外にある',
  ],

  fit(_a, m) {
    const f = m.primary.focus
    if (m.primary.op !== 'proliferation') return null
    if (f.kind === 'repetition' && f.whole) return { id: 'field', score: 0.9, grounds: ['題全体が反復している → 紙面を覆う'] }
    if (f.kind === 'repetition') return { id: 'field', score: 0.3 + 0.2 * m.primary.salience.coverage, grounds: ['題の一部が反復する'] }
    return { id: 'field', score: 0.3, grounds: ['反復の根拠がない：書き継ぐことだけが残る'] }
  },

  realize(a, m, rng) {
    const units = allUnits(m)
    const n = units.length
    const vertical = a.direction === 'vertical'
    // 造形: the grid may be a little finer or coarser
    const span = clamp(2 * n, 5, 12) + rng.pick([-1, 0, 0, 1])
    const s = PAGE / span
    const lineLength = span + 1
    const cells: Vec[] = []
    for (let l = 0; l <= span; l++)
      for (let c = 0; c < lineLength; c++) cells.push(vertical ? { x: PAGE - l * s, y: c * s } : { x: c * s, y: l * s })
    const { relationStrength, coverage } = m.primary.salience
    const fill = clamp(0.3 + 0.65 * relationStrength * coverage, 0.3, 0.95)
    const used = Math.round(cells.length * fill)
    return cells.slice(0, used).flatMap((at, k) => unitMarks(a, units[k % n], at, s * 0.96))
  },
}
