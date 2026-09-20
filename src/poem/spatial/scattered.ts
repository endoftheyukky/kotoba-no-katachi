/**
 * 散在 — SCATTERED
 * Words that stand side by side without depending on each other do not share
 * a line: each keeps its own place on the page.
 */
import { PAGE } from '../../render/stage'
import type { Analysis, Mark, SpatialComposition, Unit, Vec } from '../types'
import { centredLine, inside, isWritten } from './common'
import { coordinated, has, relationsOf } from './relations'

/** the words to place: every token with something written, except bare marks */
function independentGroups(a: Analysis, tokens: Unit[][]): Unit[][] {
  return tokens.filter((t) => t.some(isWritten) && !t.every((u) => a.graphemes[u.grapheme].script === 'symbol'))
}

export const scattered: SpatialComposition = {
  id: 'scattered',
  title: '散在',
  rules: [
    '空白で隔てられた語、三つ以上並列された語は、互いに依存しない：一語ずつ紙面の別々の場所に置かれる',
    '語どうしは一行を共有しない。置き場所は紙面の中央を避け、互いにできるだけ離れる',
    '語の大きさは互いに異なってよい（造形）',
  ],

  fit(a, m) {
    const groups = independentGroups(a, m.tokens)
    if (groups.length < 2) return null
    if (relationsOf(a, 'separation').length) return { id: 'scattered', score: 0.85, grounds: ['語が空白で隔てられている → 散在'] }
    if (coordinated(a).length >= 3) return { id: 'scattered', score: 0.8, grounds: ['三つ以上の語が並列 → 散在'] }
    if (groups.length >= 3 && !has(a, 'dependency') && !has(a, 'coordination'))
      return { id: 'scattered', score: 0.5, grounds: ['互いに依存しない語が並ぶ'] }
    return null
  },

  realize(a, m, rng, scale) {
    const groups = independentGroups(a, m.tokens)
    // candidate places: a 5 × 5 lattice without its centre, jittered
    const places: Vec[] = []
    for (let i = 0; i < 5; i++)
      for (let j = 0; j < 5; j++) if (!(i === 2 && j === 2)) places.push({ x: (i + 0.5) * 200, y: (j + 0.5) * 200 })
    const chosen: Vec[] = []
    const marks: Mark[] = []
    for (const g of groups) {
      // the first word near where writing begins; each next as far as possible from the others
      const score = (p: Vec) =>
        chosen.length
          ? Math.min(...chosen.map((q) => Math.hypot(p.x - q.x, p.y - q.y))) + rng.range(0, 120)
          : (a.direction === 'vertical' ? p.x - p.y : -p.x - p.y) + rng.range(0, 200)
      const at = [...places].sort((p, q) => score(q) - score(p))[0]
      places.splice(places.indexOf(at), 1)
      const jittered = { x: at.x + rng.range(-40, 40), y: at.y + rng.range(-40, 40) }
      chosen.push(jittered)
      const s = Math.min(scale.pick('body', rng, [0, 0.5]), (0.7 * PAGE) / g.length)
      marks.push(...centredLine(a, g, inside(a, jittered, g.length * s, s), s))
    }
    return marks
  },
}
