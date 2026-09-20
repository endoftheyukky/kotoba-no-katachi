/**
 * 二極 — AXIS / TWO POLES
 * A binary relation is held apart: two poles, a long space between them.
 *
 * The poles and the parameters that shape the page live in axisParams.ts;
 * here they are only drawn. This is the first composition to work under the
 * occupancy and scale contracts (poem/contract.ts): how much of the page the
 * figure claims, and how large its marks are, are two separate decisions, and
 * neither is taken by the seed. The seed moves the line of the axis across the
 * page and adds a final ±6% to sizes that are already decided.
 */
import { clamp } from '../../core/math'
import { EM } from '../../glyph/font'
import { PAGE } from '../../render/stage'
import { BANDS, fitSizes, jitter, midOf } from '../contract'
import type { Fitted, Mark, SpatialComposition, Unit, Vec } from '../types'
import { centredLine, isWritten, lineMarks, offCentre, placeRegion } from './common'
import { axisShape, closeness, poles, POLE_SCORE } from './axisParams'

/** a pole without the erased characters at its ends (inside, they hold their place) */
function trim(units: Unit[]): Unit[] {
  let lo = 0
  let hi = units.length
  while (lo < hi && !isWritten(units[lo])) lo++
  while (hi > lo && !isWritten(units[hi - 1])) hi--
  return lo < hi ? units.slice(lo, hi) : units.slice(0, 1)
}

export const axis: SpatialComposition = {
  id: 'axis',
  title: '二極',
  // two marks at the ends of a relation may leave the page rather than shrink
  bleed: true,
  rules: [
    '二項の関係（A または B、A と B、AがB、AをB、鏡像、よく似た二つの字形、語幹と活用語尾）は、一本の軸の両端に引き離される',
    '二極の間の長い白が、その関係である。関係語は極の間に小さく置かれるか、欠落として白になる',
    '言語上の隔たりは、紙面の広さではなく図形の内側の白になる：近い関係は大きな字が接して置かれ、遠い関係は字を紙面の端へ離す',
    '字形の差・語の継ぎ目そのものを読ませる構成では、字を大きく書く。語と語の関係では、字の大きさではなく隔たりが働く（少数の小さな字と大きな余白も、それが関係の形であれば成り立つ）',
    '包含の二極では、取り出された字は小さく、残りは大きい（残りは操作が生んだものなので macro を許す）',
    '題の外の部品との関係では、一方の極に元の字をそのまま、もう一方にその字から部品を引いた残りを置き、間に見つかった部品を小さく置く：読み手が三者を一枚で辿れるようにする',
    '拍の重さが決めた大小の比は保たれる。紙面がそれを収めきれないときは、比を崩さずに全体を小さくし、それでも収まらなければ字を紙面の外へ出す',
    'この構成では、読める字を表現のために回さない（放射や流れのように、構成そのものが向きを持つ場合はその限りではない：これは二極に限った制約）',
    '距離・大小の比・揃え方・白の寄り・軸の向き・横ずれは、題の特徴から決まる（axisParams.ts）。一篇で中立から動くのは、最も強い二つだけ',
  ],

  fit(a, m) {
    const p = poles(a, m)
    return p ? { id: 'axis', score: POLE_SCORE[p.kind], grounds: [p.ground] } : null
  },

  realize(a, m, rng, _scale) {
    const p = poles(a, m)!
    const shape = axisShape(a, m, p, PAGE, axis.bleed ?? false)
    const occ = shape.occupancy
    const close = closeness(p)
    const vertical = shape.vertical
    const at = (t: number, cross: number): Vec => (vertical ? { x: cross, y: t } : { x: t, y: cross })

    // 造形: which line across the page the axis runs on
    const line = offCentre(rng)
    const lineA = clamp(line + shape.offsetA, 0.08 * PAGE, 0.92 * PAGE)
    const lineB = clamp(line + shape.offsetB + shape.alignment, 0.08 * PAGE, 0.92 * PAGE)

    // the white inside the figure: what the language's distance asks for
    const gap = (1 - occ.fill) * occ.reach * PAGE
    // an erased character keeps its place inside a pole, but not at its edges:
    // absence writes a hole in a word, not an empty margin on the page
    const unitsA = trim(p.a)
    const unitsB = trim(p.b)
    const extentA = unitsA.length
    const extentB = unitsB.length

    const marks: Mark[] = []
    let fitted: Fitted
    let startAt: number
    let endAt: number
    let inkA: number

    if (p.kind === 'containment') {
      // the residue is what the operation produced: it keeps the macro band and
      // is not divided by the reach — the page is given to it
      const S = jitter(rng, BANDS.macro[0] * PAGE)
      const sa = Math.min(0.3 * S, 0.35 * occ.reach * PAGE)
      fitted = {
        sizes: [sa, S],
        desired: 'macro',
        achieved: 'macro',
        bled: S + sa + gap > PAGE,
        decisions: [
          { name: 'band', ground: 'linguistic', value: 'macro', note: close.note },
          { name: 'inner', ground: 'plastic', value: (sa / PAGE).toFixed(2), note: '取り出された字は残りの3割：残りが紙面を持つ' },
        ],
      }
      const span = occ.reach * PAGE
      const centre = clamp(shape.whitePull * PAGE, span / 2, PAGE - span / 2)
      startAt = centre - span / 2
      endAt = centre + span / 2
      inkA = sa
      marks.push(...centredLine(a, unitsA, at(startAt + sa / 2, lineA), sa))
      const outer = p.b[0]
      const r = m.primary.focus.kind === 'pair' ? m.primary.focus.relation : null
      const box = r?.residue.box ?? { x: -EM / 2, y: -EM / 2, w: EM, h: EM }
      const extent = (vertical ? box.h : box.w) * (S / EM)
      const g = placeRegion(box, S, at(Math.min(PAGE - extent / 2, endAt + extent / 2), lineB))
      marks.push({ char: outer.char, x: g.x, y: g.y, size: S, minus: outer.minus, keep: outer.minus?.keep })
    } else {
      // both poles are written: the sound decides their ratio, the page decides
      // how large that ratio can be drawn
      const k = Math.sqrt(shape.scaleRatio)
      fitted = fitSizes(
        { extents: [extentA, extentB], ratios: [k, 1 / k], band: close.band, note: close.note },
        occ,
        PAGE,
      )
      const sa = jitter(rng, fitted.sizes[0])
      const sb = jitter(rng, fitted.sizes[1])
      const length = extentA * sa + gap + extentB * sb
      const over = Math.max(0, (length - PAGE) / 2)
      const centre = clamp(shape.whitePull * PAGE, length / 2 - over, PAGE - length / 2 + over)
      startAt = centre - length / 2
      endAt = centre + length / 2
      inkA = extentA * sa
      // pole A begins where the figure begins; pole B ends where it ends
      marks.push(...lineMarks(a, unitsA, at(startAt + sa / 2, lineA), sa))
      marks.push(...lineMarks(a, unitsB, at(endAt - extentB * sb + sb / 2, lineB), sb))
    }

    // what lies between the poles, in the white they hold open
    const mid = at(startAt + inkA + gap / 2, (lineA + lineB) / 2)
    const difference = p.middle.filter((u) => u.grapheme === -1)
    const between = p.middle.filter((u) => u.grapheme !== -1 && isWritten(u))
    const body = (fitted.sizes[0] + fitted.sizes[1]) / 2
    if (difference.length) {
      // the difference of two similar forms is written at the size of the forms
      // it separates: the same stroke, left alone. A component read inside a
      // character is written smaller, as the third term of the reading.
      const u = difference[0]
      const s =
        p.kind === 'containment'
          ? Math.min(midOf('normal', PAGE), gap * 1.5)
          : Math.min(body, gap * 1.6)
      marks.push({ char: u.char, x: mid.x, y: mid.y, size: s, minus: u.minus, keep: u.minus?.keep })
    } else if (between.length) {
      const s =
        p.kind === 'mirror'
          ? Math.min(body, gap / Math.max(1, between.length))
          : Math.min(jitter(rng, midOf('micro', PAGE)), gap / Math.max(1, between.length))
      marks.push(...centredLine(a, between, mid, s))
    }
    return { marks, parameters: shape.parameters, contract: { occupancy: occ, fitted } }
  },
}
