/**
 * 二極 — AXIS / TWO POLES
 * A binary relation is held apart: two poles, a long space between them.
 *
 * The poles and the parameters that shape the page live in axisParams.ts;
 * here they are only drawn. Nothing about the shape is chosen by the seed:
 * the seed moves the line of the axis across the page and picks sizes inside
 * the range the scale regime allows.
 */
import { clamp } from '../../core/math'
import { EM } from '../../glyph/font'
import { PAGE } from '../../render/stage'
import type { Mark, SpatialComposition, Vec } from '../types'
import { centredLine, isWritten, lineMarks, offCentre, placeRegion } from './common'
import { axisShape, poles, POLE_SCORE } from './axisParams'

export const axis: SpatialComposition = {
  id: 'axis',
  title: '二極',
  rules: [
    '二項の関係（A または B、A と B、AがB、AをB、鏡像、よく似た二つの字形、語幹と活用語尾）は、一本の軸の両端に引き離される',
    '二極の間の長い白が、その関係である。関係語は極の間に小さく置かれるか、欠落として白になる',
    '包含の二極では、取り出された字は小さく、残りは大きい。類似の二極は同じ大きさで、二つを分ける小さな差だけが間に置かれる',
    '題の外の部品との関係では、一方の極に元の字をそのまま、もう一方にその字から部品を引いた残りを置き、間に見つかった部品を小さく置く：読み手が三者を一枚で辿れるようにする',
    '二極の間の白は、軸の長さの40%を下回らない',
    'この構成では、読める字を表現のために回さない（放射や流れのように、構成そのものが向きを持つ場合はその限りではない：これは二極に限った制約）',
    '距離・大小の比・揃え方・白の寄り・軸の向き・横ずれは、題の特徴から決まる（axisParams.ts）。一篇で中立から動くのは、最も強い二つだけ',
  ],

  fit(a, m) {
    const p = poles(a, m)
    return p ? { id: 'axis', score: POLE_SCORE[p.kind], grounds: [p.ground] } : null
  },

  realize(a, m, rng, scale) {
    const p = poles(a, m)!
    const shape = axisShape(a, m, p, PAGE)
    const vertical = shape.vertical
    const at = (t: number, cross: number): Vec => (vertical ? { x: cross, y: t } : { x: t, y: cross })

    // where the pair sits along the axis, and how far apart
    const half = (shape.distance * PAGE) / 2
    const centre = clamp(shape.whitePull * PAGE, 0.12 * PAGE + half, 0.88 * PAGE - half)
    const startAt = centre - half
    const endAt = centre + half
    const length = endAt - startAt

    // 造形: which line across the page the axis runs on
    const line = offCentre(rng)
    const lineA = clamp(line + shape.offsetA, 0.08 * PAGE, 0.92 * PAGE)
    const lineB = clamp(line + shape.offsetB + shape.alignment, 0.08 * PAGE, 0.92 * PAGE)

    const marks: Mark[] = []
    if (p.kind === 'containment') {
      // the glyph taken out, at body size; what remains of the other is the result
      const sa = Math.min(scale.pick('body', rng, [0.05, 0.3]) * Math.sqrt(shape.scaleRatio), length * 0.3)
      marks.push(...centredLine(a, p.a, at(startAt + sa / 2, lineA), sa))
      const outer = p.b[0]
      const r = m.primary.focus.kind === 'pair' ? m.primary.focus.relation : null
      const S = scale.pick('result', rng, [0.05, 0.4])
      const box = r?.residue.box ?? { x: -EM / 2, y: -EM / 2, w: EM, h: EM }
      const extent = (vertical ? box.h : box.w) * (S / EM)
      const g = placeRegion(box, S, at(Math.min(PAGE - extent / 2, endAt + extent / 2), lineB))
      marks.push({ char: outer.char, x: g.x, y: g.y, size: S, minus: outer.minus, keep: outer.minus?.keep })
    } else {
      const base = scale.pick('body', rng, [0.2, 0.8])
      const k = Math.sqrt(shape.scaleRatio)
      let sa = base * k
      let sb = base / k
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
      // the difference of two similar forms, or the component read inside a character
      const u = difference[0]
      const s = Math.min(scale.pick('result', rng, [0.2, 0.8]), length * 0.3)
      marks.push({ char: u.char, x: mid.x, y: mid.y, size: s, minus: u.minus, keep: u.minus?.keep })
    } else if (between.length) {
      const s = p.kind === 'mirror' ? Math.min(scale.pick('body', rng, [0.2, 0.6]), length * 0.3) : scale.pick('aside', rng)
      marks.push(...centredLine(a, between, mid, s))
    }
    return { marks, parameters: shape.parameters }
  },
}
