/**
 * 軌道 — ORBIT (v2)
 *
 *   linguistic input  two terms the page holds apart, and how they are related:
 *                     symmetrically (A と B, A ≈ B, a mirror) or with a
 *                     direction (an ending hangs on its stem, a word depends on
 *                     another, an object on its verb).
 *   rule              a symmetric relation is an exchange: each term is ringed
 *                     by small copies of the other. A directed one is a
 *                     dependence: the dependent term's characters circle the
 *                     term they depend on. One ring per character of the
 *                     circling term, in reading order from the inside out; each
 *                     ring as full as its circumference allows.
 *   visual output     two poles that are no longer merely apart: each carries
 *                     the other, or one carries what hangs on it.
 *
 * The radius of the first ring and the spacing of the rings are plastic; which
 * term circles which, and how many rings, are not.
 */
import { PAGE } from '../../render/stage'
import { poles } from '../spatial/axisParams'
import type { Mark, Unit } from '../types'
import { derive, free, within, type MarkGrammar } from './common'
import type { PageView } from './page'

interface Pair {
  /** the term ringed */
  around: Mark[]
  /** the characters that circle it, in reading order */
  by: Unit[]
  note: string
  /** a dependence: the ring stays open toward the term that hangs on it */
  toward?: Mark[]
  /** the other pole: the white between the two is what the rings must reach into */
  other: Mark[]
}

/** a ring the page lets fewer than this share of stand is a fragment, not a ring */
const WHOLE_RING = 0.6
/** the rings must reach at least this share of the way from a pole to the other */
const REACH_ACROSS = 0.25

const centreOf = (ks: Mark[]) => ({ x: ks.reduce((t, k) => t + k.x, 0) / ks.length, y: ks.reduce((t, k) => t + k.y, 0) / ks.length })
const reachOf = (ks: Mark[]) => {
  const c = centreOf(ks)
  return Math.max(...ks.map((k) => Math.hypot(k.x - c.x, k.y - c.y) + k.size / 2))
}

/**
 * Whether the rings reach into the white between the poles. A ring much
 * smaller than the distance it stands across is a halo round one pole, not an
 * orbit that exchanges or depends: the relation is not drawn across the page.
 * Judged at the middle of the plastic range of the first ring's radius.
 */
function reachesAcross(p: Pair): boolean {
  const a = centreOf(p.around)
  const b = centreOf(p.other)
  const d = Math.hypot(a.x - b.x, a.y - b.y)
  const r = reachOf(p.around) * 1.5 + 0.027 * PAGE
  return r >= REACH_ACROSS * d
}

function pairs(v: PageView): Pair[] | null {
  if (v.spatial.id !== 'axis' || v.spatial.mode !== 'default') return null
  const p = poles(v.a, v.m)
  if (!p || p.kind === 'containment') return null
  const marksOf = (us: Unit[]) => v.body.filter((k) => !k.keep && !k.minus && us.some((u) => u.grapheme === k.grapheme))
  const A = marksOf(p.a)
  const B = marksOf(p.b)
  if (!A.length || !B.length) return null
  const written = (us: Unit[]) => us.filter((u) => !u.absent && u.char.trim() && u.grapheme >= 0)
  const text = (us: Unit[]) => written(us).map((u) => u.char).join('')
  switch (p.kind) {
    case 'coordination':
    case 'similarity':
    case 'mirror':
      return [
        { around: A, by: written(p.b), other: B, note: `「${text(p.a)}」を「${text(p.b)}」が巡る（対称な関係：交換）` },
        { around: B, by: written(p.a), other: A, note: `「${text(p.b)}」を「${text(p.a)}」が巡る（対称な関係：交換）` },
      ]
    case 'inflection':
      return [{ around: A, by: written(p.b), toward: B, other: B, note: `語尾「${text(p.b)}」が語幹「${text(p.a)}」を巡る（語尾の側で開く）` }]
    case 'dependency':
    case 'imperative':
      return [{ around: B, by: written(p.a), toward: A, other: A, note: `「${text(p.a)}」が「${text(p.b)}」を巡る（依存する側で開く）` }]
    default:
      return null
  }
}

export const orbit: MarkGrammar = {
  id: 'orbit',
  title: '軌道',
  rules: [
    '二つの項が引き離された紙面で、関係が対称なら交換になる：どちらの項も、相手の小さな字の環に巡られる',
    '関係に向きがあれば依存になる：依存する側の字が、依存される側を巡る（語尾は語幹を、目的語は動詞を）。その環は閉じず、依存する側に向かって開く：かかる向きが環の切れ目になる',
    '環は巡る側の字の数だけ、読みの順に内から外へ重なる。どの環も周の長さが許すだけ満ちる',
    '環は二極の間の白へ届くときだけ：環の半径が極から相手の極までの距離の四分の一に満たなければ、それは一方の極の光輪であって、関係を紙面に渡さない。描かない',
    '紙面が環の六割未満しか立たせないなら、その環は断片であって環ではない：描かない',
    '最初の環の半径と環の間隔は造形。どちらがどちらを巡るか、環がいくつかは造形ではない',
  ],

  offer(v) {
    const ps = pairs(v)
    if (!ps?.length || ps.every((p) => !p.by.length)) return null
    if (!ps.every(reachesAcross)) return null
    return {
      grounds: ps.map((p) => p.note),
      uses: ps.map((p) => ({ property: 'ring', value: `${p.around.map((k) => k.char).join('')}←${p.by.map((u) => u.char).join('')}` })),
    }
  },

  apply(v, rng) {
    const ps = pairs(v)
    if (!ps || !ps.every(reachesAcross)) return v.marks
    const out: Mark[] = [...v.marks]
    const added: Mark[] = []
    const grain = within(rng, 0.024, 0.03) * PAGE
    // an orbit stands off from what it circles: the first ring well clear of the ink
    const first = within(rng, 1.3, 1.7)
    const spacing = within(rng, 1.4, 1.8)
    for (const p of ps) {
      if (!p.by.length) continue
      // the term's centre and extent, whatever its number of characters
      const { x: cx, y: cy } = centreOf(p.around)
      const reach = reachOf(p.around)
      // where the dependent term lies: the ring is open there, a third of the way round
      const opening = p.toward?.length
        ? Math.atan2(
            p.toward.reduce((t, k) => t + k.y, 0) / p.toward.length - cy,
            p.toward.reduce((t, k) => t + k.x, 0) / p.toward.length - cx,
          )
        : null
      p.by.forEach((u, ring) => {
        const r = reach * first + grain * (1 + ring * spacing)
        const n = Math.max(8, Math.floor((2 * Math.PI * r) / (grain * 1.6)))
        // the ring begins where the reading begins (top for vertical writing, left for horizontal)
        const start = v.a.direction === 'vertical' ? -Math.PI / 2 : Math.PI
        const ring0 = added.length
        let wanted = 0
        for (let i = 0; i < n; i++) {
          const t = start + (i / n) * 2 * Math.PI
          if (opening !== null && Math.abs(Math.atan2(Math.sin(t - opening), Math.cos(t - opening))) < Math.PI / 3) continue
          wanted++
          const x = cx + Math.cos(t) * r
          const y = cy + Math.sin(t) * r
          if (x < grain || y < grain || x > PAGE - grain || y > PAGE - grain) continue
          if (!free(v, v.marks, added, x, y, grain)) continue
          added.push({
            char: u.char,
            x,
            y,
            size: grain * 0.92,
            role: 'satellite',
            derived: derive('orbit', 'repeat', p.note, u.grapheme),
          })
        }
        // what the page cut to pieces is not a ring
        if (added.length - ring0 < WHOLE_RING * wanted) added.length = ring0
      })
    }
    return [...out, ...added]
  },
}
