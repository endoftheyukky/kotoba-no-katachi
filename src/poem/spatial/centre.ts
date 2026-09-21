/**
 * 中心・周縁 — CENTRE / PERIPHERY
 * One term holds the page; what depends on it stays at the edge.
 */
import { EM } from '../../glyph/font'
import { PAGE } from '../../render/stage'
import type { Analysis, Material, Mark, SpatialComposition, Unit, Vec } from '../types'
import { allUnits, centredLine, directions, inside, isWritten, lineMarks, offCentre, placeRegion, unitMarks } from './common'
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
    '重心は紙面の中央に置かない。周縁は読みが始まる角に寄り、重心はその角から離れた側に置かれる：周縁は縁に退いても、読みの順では先に来る',
    '字がすでに抱えている閉じた白は、空いた場所である：その字は紙面いっぱいに書かれ、題の残りの字は白の中に、書かれた順に置かれる。白が二つ以上あれば一つずつ、余れば同じ白に重ねて置く',
  ],

  fit(a, m) {
    const f = m.primary.focus
    if (f.kind === 'counter') {
      const others = a.graphemes.filter((g) => g.index !== f.grapheme && g.char.trim()).length
      return {
        id: 'centre',
        score: others ? 0.78 : 0.7,
        grounds: [
          others
            ? `「${a.graphemes[f.grapheme].char}」が閉じ込めた白（${f.holes.length}つ）に、題の残りが入る`
            : `「${a.graphemes[f.grapheme].char}」が閉じ込めた白（${f.holes.length}つ・${f.arrangement}）が紙面を占める`,
        ],
      }
    }
    const r = roles(a, m)
    return r ? { id: 'centre', score: r.kind === 'dependency' ? 0.75 : 0.7, grounds: [r.ground] } : null
  },

  realize(a, m, rng, scale) {
    const focus = m.primary.focus
    if (focus.kind === 'counter') {
      // the character is written the size of the page, and what the title
      // still has to say is put where its strokes have already left room
      const units = allUnits(m)
      const target = units.find((u) => u.grapheme === focus.grapheme)!
      const others = units.filter((u) => u.grapheme !== focus.grapheme && isWritten(u))
      const metrics = a.glyphs.get(target.char).metrics
      const extent = (2 * Math.max(metrics.half.w, metrics.half.h)) / EM
      const S = Math.min((0.94 * PAGE) / Math.max(0.2, extent), 1.05 * PAGE)
      // 造形: not exactly on the middle of the page
      const at: Vec = { x: PAGE / 2 + rng.range(-0.04, 0.04) * PAGE, y: PAGE / 2 + rng.range(-0.04, 0.04) * PAGE }
      const marks: Mark[] = unitMarks(a, target, at, S)
      const k = S / EM
      const groups: Unit[][] = focus.holes.map(() => [])
      others.forEach((u, i) => groups[i % groups.length].push(u))
      focus.holes.forEach((hole, i) => {
        const group = groups[i]
        if (!group.length) return
        const w = hole.box.w * k
        const h = hole.box.h * k
        const s = Math.min(w, h) * 0.62
        const centre = { x: at.x + hole.centre.x * k, y: at.y + hole.centre.y * k }
        marks.push(...centredLine(a, group, centre, Math.min(s, (Math.max(w, h) * 0.8) / group.length)))
      })
      return { marks }
    }

    const r = roles(a, m)!
    const { vertical } = directions(a)
    // 造形: where the centre sits — but never in the quarter where the reading
    // begins, which belongs to the periphery (top right when the title is
    // written downward, top left when across)
    const c: Vec = { x: offCentre(rng, 0.3, 0.42), y: offCentre(rng, 0.3, 0.42) }
    const early = (vertical ? c.x > PAGE / 2 : c.x < PAGE / 2) && c.y < PAGE / 2
    if (early) c.x = PAGE - c.x
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

    // the periphery: small, in the corner where the reading begins, so that
    // what is read first is still read first
    const s = scale.pick('aside', rng)
    const margin = rng.range(0.05, 0.1) * PAGE
    const start = vertical ? { x: PAGE - margin, y: margin } : { x: margin, y: margin }
    marks.push(...lineMarks(a, r.periphery, start, s))
    return { marks }
  },
}
