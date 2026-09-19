/**
 * 片隅 — CLUSTER (asymmetric, sparse)
 * A title that shows no strong relation is not enlarged to fill the page:
 * it gathers small in one place, and the rest of the page is white.
 */
import { EM } from '../../glyph/font'
import { PAGE } from '../../render/stage'
import type { Mark, SpatialComposition, Vec } from '../types'
import { allUnits, directions, lineMarks } from './common'

export const cluster: SpatialComposition = {
  id: 'cluster',
  title: '片隅',
  rules: [
    '題に強い関係が見つからないとき、題は拡大されない：紙面の一隅に小さく集まり、残りは白である',
    '分解された字があれば、その部品は語から書字の方向へ離れていき、白の中へ出ていく',
    '集まる場所は縁か角。紙面の中央ではない',
  ],

  fit(_a, m) {
    const score = 0.2 + 0.45 * (1 - m.primary.salience.value)
    return { id: 'cluster', score, grounds: [`主操作の salience ${m.primary.salience.value.toFixed(2)} → 弱い題は小さく集まる`] }
  },

  realize(a, m, rng) {
    const units = allUnits(m)
    const { along, vertical } = directions(a)
    const s = rng.range(0.07, 0.11) * PAGE
    const margin = rng.range(0.06, 0.14) * PAGE
    // 造形: which corner or edge
    const spots: Vec[] = [
      { x: PAGE - margin, y: margin },
      { x: margin, y: margin },
      { x: PAGE - margin, y: PAGE * rng.range(0.35, 0.55) },
      { x: margin, y: PAGE - margin - units.length * s },
      { x: PAGE * rng.range(0.55, 0.7), y: margin },
    ]
    const start = rng.pick(spots)
    if (vertical) start.y = Math.min(start.y, PAGE - margin - units.length * s)
    else start.x = Math.min(start.x, PAGE - margin - units.length * s)
    const marks: Mark[] = lineMarks(a, units, start, s)

    const f = m.primary.focus
    if (f.kind === 'parts') {
      // the parts leave the word along the direction of writing, further and further apart;
      // where the page ends, they go on in the next line, as writing does
      const char = a.graphemes[f.grapheme].char
      const S = s * rng.range(1.6, 2.8)
      const k = S / EM
      const { across } = directions(a)
      const along0 = vertical ? start.y : start.x
      let t = units.length * s + S * 0.6
      let line = 0
      f.parts.forEach((p, i) => {
        t += S * (0.5 + 0.45 * i) * rng.range(0.9, 1.2)
        if (along0 + t > PAGE - S * 0.4) {
          line++
          t = S * 0.6 - along0 + margin
        }
        const shift = line * S * 1.3
        let at = { x: start.x + along.x * t + across.x * shift, y: start.y + along.y * t + across.y * shift }
        // a line that would leave the page is written on the other side of the word
        if (at.x < 0 || at.x > PAGE) at = { ...at, x: start.x - across.x * shift }
        if (at.y < 0 || at.y > PAGE) at = { ...at, y: start.y - across.y * shift }
        // off the line a little, to the side the part came from
        const side = vertical ? p.centroid.x : p.centroid.y
        const off = (Math.sign(side) || 1) * S * 0.25
        marks.push({
          char,
          x: at.x - p.centroid.x * k + (vertical ? off : 0),
          y: at.y - p.centroid.y * k + (vertical ? 0 : off),
          size: S,
          keep: p.keep,
        })
      })
    }
    return marks
  },
}
