/**
 * 二極 — AXIS / TWO POLES
 * A binary relation is held apart: two poles, a long space between them.
 */
import { EM } from '../../glyph/font'
import { PAGE } from '../../render/stage'
import type { Analysis, Material, Mark, SpatialComposition, Unit, Vec } from '../types'
import { allUnits, centredLine, directions, isWritten, lineMarks, offCentre, placeRegion } from './common'
import { coordinated, dependencyBy, relationsOf } from './relations'

/** particles that point from one term to another: object, subject, direction */
const POINTING = ['を', 'が', 'に', 'へ']

interface Poles {
  a: Unit[]
  b: Unit[]
  middle: Unit[]
  kind: 'containment' | 'similarity' | 'coordination' | 'mirror' | 'dependency' | 'imperative'
  ground: string
}

function poles(an: Analysis, m: Material): Poles | null {
  const units = allUnits(m)
  const tokenUnits = (t: number) => m.tokens[t] ?? []
  const rest = (...used: Unit[][]) => units.filter((u) => !used.some((g) => g.includes(u)))
  const f = m.primary.focus

  if (f.kind === 'pair') {
    const r = f.relation
    // the inner glyph may be one the title never writes (read inside another)
    const inner = units.find((u) => u.char === r.inner) ?? { grapheme: -1, token: -1, char: r.inner }
    const outer = units.find((u) => u.char === r.outer)
    if (outer) {
      const minus = { char: r.inner, dx: r.dx, dy: r.dy, scale: r.scale, keep: r.residue.pieces }
      const b = r.kind === 'containment' ? [{ ...outer, minus }] : [outer]
      // found against a component the title never writes: the character itself
      // stands at one pole, what is left of it at the other, the component between
      if (m.primary.origin === 'exogenous')
        return {
          a: [outer],
          b,
          middle: [{ grapheme: -1, token: -1, char: r.inner }],
          kind: 'containment',
          ground: `「${r.outer}」の中に「${r.inner}」を読んだ（題の外の部品）→ 元の字と、引いた残りを二極に`,
        }
      const hasCoordination = coordinated(an).length === 2
      // for a similarity, the small difference stands between the two
      const difference = r.kind === 'similarity' ? [{ ...outer, minus, grapheme: -1 }] : []
      if (r.kind === 'similarity' || hasCoordination)
        return {
          a: [inner],
          b,
          middle: [...difference, ...rest([inner], [outer])],
          kind: r.kind,
          ground: r.kind === 'similarity' ? `「${r.inner}」≈「${r.outer}」 → 二つの同じような形を離す` : `「${r.inner}」と「${r.outer}」が接続語で結ばれ、字形も包含する → 二極`,
        }
    }
    return null
  }

  const members = coordinated(an)
  if (members.length === 2) {
    const [l, r] = members
    const a = tokenUnits(l)
    const b = tokenUnits(r)
    return { a, b, middle: rest(a, b), kind: 'coordination', ground: `「${an.tokens[l].surface}」と「${an.tokens[r].surface}」の並列 → 二極` }
  }

  const mirror = relationsOf(an, 'mirror')[0]
  if (mirror) {
    const written = units.filter((u) => an.graphemes[u.grapheme].script !== 'symbol')
    const half = Math.floor(written.length / 2)
    const a = written.slice(0, half)
    const b = written.slice(written.length - half)
    return { a, b, middle: rest(a, b), kind: 'mirror', ground: '題は前から読んでも後ろから読んでも同じ → 対称の軸' }
  }

  const dep = dependencyBy(an, POINTING)
  if (dep) {
    const a = units.filter((u) => u.token <= dep.dependent)
    const b = units.filter((u) => u.token >= dep.head)
    return { a, b, middle: rest(a, b), kind: 'dependency', ground: `「${an.tokens[dep.marker].surface}」は一方から他方へ向かう → 二極` }
  }

  const imp = relationsOf(an, 'imperative')[0]
  if (imp && an.tokens.length > 1) {
    const b = tokenUnits(imp.token)
    const a = units.filter((u) => u.token < imp.token)
    if (a.length) return { a, b, middle: rest(a, b), kind: 'imperative', ground: '命令は向かう先を持つ → 二極' }
  }
  return null
}

const SCORE: Record<Poles['kind'], number> = {
  containment: 0.9,
  similarity: 0.85,
  coordination: 0.85,
  mirror: 0.8,
  dependency: 0.7,
  imperative: 0.6,
}

export const axis: SpatialComposition = {
  id: 'axis',
  title: '二極',
  rules: [
    '二項の関係（A または B、A と B、AがB、AをB、鏡像、よく似た二つの字形）は、一本の軸の両端に引き離される',
    '二極の間の長い白が、その関係である。関係語は極の間に小さく置かれるか、欠落として白になる',
    '包含の二極では、取り出された字は小さく、残りは大きい。類似の二極は同じ大きさで、二つを分ける小さな差だけが間に置かれる',
    '題の外の部品との関係では、一方の極に元の字をそのまま、もう一方にその字から部品を引いた残りを置き、間に見つかった部品を小さく置く：読み手が三者を一枚で辿れるようにする',
    '軸は紙面の中央を通らない。軸は書字の方向に沿うか、斜めに紙面を横切る',
    '二極の間の白は、軸の長さの40%を下回らない。足りなければ極の字を小さくする',
  ],

  fit(a, m) {
    const p = poles(a, m)
    return p ? { id: 'axis', score: SCORE[p.kind], grounds: [p.ground] } : null
  },

  realize(a, m, rng, scale) {
    const p = poles(a, m)!
    const { vertical } = directions(a)
    // 造形: the line of the axis, and whether it runs straight or slants
    const line = offCentre(rng)
    const slant = rng.next() < 0.45
    const startAt = rng.range(0.1, 0.2) * PAGE
    const endAt = PAGE - rng.range(0.1, 0.22) * PAGE
    const at = (t: number, lineAt: number): Vec => (vertical ? { x: lineAt, y: t } : { x: t, y: lineAt })
    const lineA = line
    const lineB = slant ? PAGE - line : line

    const length = endAt - startAt
    const marks: Mark[] = []
    if (p.kind === 'containment') {
      // the glyph taken out, at body size; what remains of the other is the result
      const sa = Math.min(scale.pick('body', rng, [0.05, 0.3]), length * 0.3)
      marks.push(...centredLine(a, p.a, at(startAt + sa / 2, lineA), sa))
      const outer = p.b[0]
      const r = m.primary.focus.kind === 'pair' ? m.primary.focus.relation : null
      const S = scale.pick('result', rng, [0.05, 0.4])
      // the residue ends where the axis ends, and stays on the page when it can
      const box = r?.residue.box ?? { x: -EM / 2, y: -EM / 2, w: EM, h: EM }
      const k = S / EM
      const extent = (vertical ? box.h : box.w) * k
      const g = placeRegion(box, S, at(endAt + (PAGE - endAt) / 2 - extent / 2, lineB))
      marks.push({ char: outer.char, x: g.x, y: g.y, size: S, minus: outer.minus, keep: outer.minus?.keep })
    } else {
      const same = p.kind === 'similarity' || p.kind === 'mirror'
      const w = same ? rng.range(0.9, 1.1) : 1
      let sa = scale.pick('body', rng, [0.2, 0.8]) * w
      let sb = same ? sa : scale.pick('body', rng, [0.2, 0.8])
      // the white between the poles is at least 40% of the axis
      const used = p.a.length * sa + p.b.length * sb
      if (used > length * 0.6) {
        const f = (length * 0.6) / used
        sa *= f
        sb *= f
      }
      // pole A begins where the axis begins; pole B ends where it ends
      marks.push(...lineMarks(a, p.a, at(startAt + sa / 2, lineA), sa))
      marks.push(...lineMarks(a, p.b, at(endAt - sb / 2 - (p.b.length - 1) * sb, lineB), sb))
    }
    // what lies between the poles, at the middle of the axis
    const mid = at((startAt + endAt) / 2, (lineA + lineB) / 2)
    const difference = p.middle.filter((u) => u.grapheme === -1)
    const between = p.middle.filter((u) => u.grapheme !== -1 && isWritten(u))
    if (difference.length) {
      // the difference of two similar forms: only its pieces with form, at the size of the poles
      const u = difference[0]
      const s = Math.min(scale.pick('result', rng, [0.2, 0.8]), length * 0.3)
      marks.push({ char: u.char, x: mid.x, y: mid.y, size: s, minus: u.minus, keep: u.minus?.keep })
    } else if (between.length) {
      const s = p.kind === 'mirror' ? Math.min(scale.pick('body', rng, [0.2, 0.6]), length * 0.3) : scale.pick('aside', rng)
      marks.push(...centredLine(a, between, mid, s))
    }
    return marks
  },
}
