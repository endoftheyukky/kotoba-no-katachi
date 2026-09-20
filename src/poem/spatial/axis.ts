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
import { planContext, seatLine } from '../context'
import { BANDS, fitSizes, jitter, midOf } from '../contract'
import type { Decision, Fitted, Mark, SpatialComposition, Unit, Vec } from '../types'
import { centredLine, directions, isWritten, lineMarks, offCentre, placeRegion, unitMarks } from './common'
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
    '題の一部だけが対象のとき、置かれなかった字は消えない：題の書字方向に、書かれた順のまま、一定の間隔で並ぶ（poem/context.ts）。対象が離れた席から引き出されているときは、その間隔が席の位置を保つ',
    '文脈は主要素より明確に小さく、しかし読める大きさを下回らない。対象は紙面の外へ出てよいが、文脈は出ない',
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
    // where the figure writes each character of the title, for the seats
    const placedAt: { grapheme: number; x: number; y: number; size: number }[] = []
    const reading = directions(a)
    const put = (us: Unit[], first: Vec, size: number) =>
      us.forEach((u, j) => {
        if (!isWritten(u)) return
        placedAt.push({
          grapheme: u.grapheme,
          x: first.x + reading.along.x * j * size,
          y: first.y + reading.along.y * j * size,
          size,
        })
      })
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
      const centreA = at(startAt + sa / 2, lineA)
      const halfA = ((unitsA.length - 1) * sa) / 2
      marks.push(...centredLine(a, unitsA, centreA, sa))
      put(unitsA, { x: centreA.x - reading.along.x * halfA, y: centreA.y - reading.along.y * halfA }, sa)
      const outer = p.b[0]
      const r = m.primary.focus.kind === 'pair' ? m.primary.focus.relation : null
      const box = r?.residue.box ?? { x: -EM / 2, y: -EM / 2, w: EM, h: EM }
      const extent = (vertical ? box.h : box.w) * (S / EM)
      const g = placeRegion(box, S, at(Math.min(PAGE - extent / 2, endAt + extent / 2), lineB))
      marks.push({ char: outer.char, x: g.x, y: g.y, size: S, minus: outer.minus, keep: outer.minus?.keep })
      // what is left of a character is still that character's place in the title
      if (isWritten(outer)) placedAt.push({ grapheme: outer.grapheme, x: g.x, y: g.y, size: S })
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
      const firstA = at(startAt + sa / 2, lineA)
      const firstB = at(endAt - extentB * sb + sb / 2, lineB)
      marks.push(...lineMarks(a, unitsA, firstA, sa))
      marks.push(...lineMarks(a, unitsB, firstB, sb))
      put(unitsA, firstA, sa)
      put(unitsB, firstB, sb)
    }

    // what lies between the poles, in the white they hold open
    const mid = at(startAt + inkA + gap / 2, (lineA + lineB) / 2)
    // Only what the title does not write itself stands between the poles: the
    // difference of two similar forms, or a component read inside a character.
    // Characters of the title the poles do not carry are not squeezed in here
    // — they keep their own place in the reading (below).
    const difference = p.middle.filter((u) => u.grapheme === -1)
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
    }

    // the rest of the title, in the order it was written
    const plan = placedAt.length
      ? planContext(a, m, new Set(placedAt.map((k) => k.grapheme)), Math.min(...placedAt.map((k) => k.size)), PAGE)
      : null
    let context: Decision[] = []
    if (plan) {
      const alongOf = (k: { x: number; y: number }) => (reading.vertical ? k.y : k.x)
      const crossOf = (k: { x: number; y: number }) => (reading.vertical ? k.x : k.y)
      const seatOf = new Map(plan.seats.map((k) => [k.grapheme, k.index]))
      const anchors = placedAt
        .filter((k) => seatOf.has(k.grapheme))
        .map((k) => ({ index: seatOf.get(k.grapheme)!, at: alongOf(k) }))
      const first = placedAt[0]
      const line = seatLine(anchors, plan.seats.length, first.size, plan.size, PAGE)
      // 造形: the row runs beside the figure, on the side away from the far pole
      const others = placedAt.filter((k) => Math.abs(crossOf(k) - crossOf(first)) > 1)
      const side = others.length
        ? Math.sign(crossOf(first) - crossOf(others[others.length - 1])) || 1
        : crossOf(first) < PAGE / 2
          ? 1
          : -1
      const rowCross = clamp(
        crossOf(first) + side * (first.size / 2 + plan.size),
        0.04 * PAGE + plan.size / 2,
        0.96 * PAGE - plan.size / 2,
      )
      for (const { unit, seat } of plan.units) {
        const t = line.origin + seat.index * line.pitch
        const where = reading.vertical ? { x: rowCross, y: t } : { x: t, y: rowCross }
        marks.push(...unitMarks(a, unit, where, plan.size).map((k) => ({ ...k, context: true })))
      }
      context = [
        ...plan.decisions,
        {
          name: 'seat pitch',
          ground: line.derived ? 'linguistic' : 'plastic',
          value: (line.pitch / PAGE).toFixed(3),
          note: line.derived
            ? '対象が離れた席から引き出されている：間隔は、対象がそれぞれの席に重なるように決まる'
            : '席の幅は、席を離れた字の幅にとる：空いた席が、何が抜けたかの大きさで読める',
        },
        {
          name: 'row / axis',
          ground: 'plastic',
          value: reading.vertical === vertical ? '平行' : '直交',
          note:
            reading.vertical === vertical
              ? '読みの線と軸が同じ向き：文脈は軸の脇に並ぶ'
              : '読みの線が軸を横切る：配列と構造が二つの向きに分かれる',
        },
      ]
    }
    return { marks, parameters: shape.parameters, contract: { occupancy: occ, fitted, context } }
  },
}
