/**
 * 中心・周縁 — CENTRE / PERIPHERY
 * One term holds the page; what depends on it stays at the edge.
 */
import { EM } from '../../glyph/font'
import { PAGE } from '../../render/stage'
import type { Analysis, Material, Mark, SpatialComposition, Unit, Vec } from '../types'
import { allUnits, centredLine, directions, inside, lineMarks, offCentre, placeRegion } from './common'
import { coordinated, dependencyBy } from './relations'

interface Roles {
  centre: Unit[]
  periphery: Unit[]
  kind: 'dependency' | 'containment'
  ground: string
}

function roles(a: Analysis, m: Material): Roles | null {
  const units = allUnits(m)
  const f = m.primary.focus
  // a component the title never writes needs the character it was found in on
  // the same page: that is the axis's business, not this one
  if (f.kind === 'pair' && m.primary.origin === 'exogenous') return null
  if (f.kind === 'pair' && f.relation.kind === 'containment' && coordinated(a).length !== 2) {
    const r = f.relation
    const outer = units.find((u) => u.char === r.outer)
    if (!outer) return null
    return {
      centre: [{ ...outer, minus: { char: r.inner, dx: r.dx, dy: r.dy, scale: r.scale, keep: r.residue.pieces } }],
      periphery: units,
      kind: 'containment',
      ground: `「${r.inner}」は「${r.outer}」の中にある → 残りが中心、題は周縁`,
    }
  }
  const dep = dependencyBy(a, ['の'])
  if (dep) {
    return {
      centre: units.filter((u) => u.token >= dep.head),
      periphery: units.filter((u) => u.token < dep.head),
      kind: 'dependency',
      ground: `「${a.tokens[dep.dependent].surface}」→の→「${a.tokens[dep.head].surface}」 → 修飾される語が中心、修飾する語が周縁`,
    }
  }
  return null
}

export const centre: SpatialComposition = {
  id: 'centre',
  title: '中心・周縁',
  rules: [
    '「AのB」では、Bが紙面の重心を占め、Aは紙面の縁に小さく退く。「の」は二つの間の距離である',
    '字形の包含では、外の字から内の字を引いた残りが重心を占め、題そのものは縁に小さく置かれる',
    '重心は紙面の中央に置かない。周縁は重心から最も遠い縁に寄る',
  ],

  fit(a, m) {
    const r = roles(a, m)
    return r ? { id: 'centre', score: r.kind === 'dependency' ? 0.75 : 0.7, grounds: [r.ground] } : null
  },

  realize(a, m, rng, scale) {
    const r = roles(a, m)!
    const { vertical } = directions(a)
    const c: Vec = { x: offCentre(rng, 0.3, 0.42), y: offCentre(rng, 0.3, 0.42) }
    const marks: Mark[] = []

    if (r.kind === 'containment') {
      const u = r.centre[0]
      const f = m.primary.focus
      const box = f.kind === 'pair' ? f.relation.residue.box : { x: -EM / 2, y: -EM / 2, w: EM, h: EM }
      const S = scale.pick('result', rng, [0.2, 0.6])
      const g = placeRegion(box, S, c)
      marks.push({ char: u.char, x: g.x, y: g.y, size: S, minus: u.minus, keep: u.minus?.keep })
    } else {
      // the centre holds the page by its place, at body size, not by being enlarged past it
      const n = Math.max(1, r.centre.length)
      const S = Math.min(scale.pick('body', rng, [0.5, 1]), (0.7 * PAGE) / n)
      marks.push(...centredLine(a, r.centre, inside(a, c, n * S, S), S))
    }

    // the periphery: small, at the edge farthest from the centre
    const s = scale.pick('aside', rng)
    const margin = rng.range(0.05, 0.1) * PAGE
    const edgeX = c.x < PAGE / 2 ? PAGE - margin : margin
    const edgeY = c.y < PAGE / 2 ? PAGE - margin : margin
    const n = r.periphery.length
    const start = vertical
      ? { x: edgeX, y: edgeY > PAGE / 2 ? edgeY - (n - 1) * s : edgeY }
      : { x: edgeX > PAGE / 2 ? edgeX - (n - 1) * s : edgeX, y: edgeY }
    marks.push(...lineMarks(a, r.periphery, start, s))
    return { marks }
  },
}
