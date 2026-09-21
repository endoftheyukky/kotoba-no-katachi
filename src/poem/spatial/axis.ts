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
import { Rng } from '../../core/random'
import { EM } from '../../glyph/font'
import { PAGE } from '../../render/stage'
import { MIN_READABLE, planContext, seatLine } from '../context'
import { bandOf, fitSizes, jitter, midOf } from '../contract'
import { seatsOf } from '../scope'
import type { Analysis, Decision, Fitted, Mark, Material, SpatialComposition, Unit, Vec } from '../types'
import { centredLine, directions, isWritten, lineMarks, offCentre, placeRegion, unitMarks } from './common'
import { axisShape, closeness, poles, POLE_SCORE, type Poles } from './axisParams'
import { jointHolds, jointLine, layJoint } from './joint'

/**
 * How large the part is against the whole it was taken from, so that the part
 * and what is left of the whole carry the same weight of ink:
 *   ink(part) = density(part) · s²,  ink(residue) = share · density(whole) · S²
 * The measure is the reading's (share of the outer's ink left in pieces); the
 * decision to balance the two is one of form.
 */
function residueRatio(a: Analysis, inner: string, outer: string, share: number): number {
  const d = (c: string) => {
    try {
      return a.glyphs.get(c).metrics.density
    } catch {
      return 0.25
    }
  }
  return clamp(Math.sqrt((share * d(outer)) / Math.max(0.01, d(inner))), 0.2, 1)
}

/** a pole without the erased characters at its ends (inside, they hold their place) */
function trim(units: Unit[]): Unit[] {
  let lo = 0
  let hi = units.length
  while (lo < hi && !isWritten(units[lo])) lo++
  while (hi > lo && !isWritten(units[hi - 1])) hi--
  return lo < hi ? units.slice(lo, hi) : units.slice(0, 1)
}

/**
 * In-place mutation — when the feature is one character of the title.
 *
 * The title is not a caption to an analysis. It is laid out first, whole, as
 * one line of writing at a size that reads; the character the feature acts on
 * stays in its own seat, a little larger; and only what came out of it — the
 * form read inside it, what is left when that form is taken away — grows out
 * of that seat, across the line. The reader sees a title in which one
 * character has changed on the spot, not a magnified fragment with the title
 * noted beside it.
 *
 * Used only where one written character of the title is the whole target and
 * the figure is what that character decomposes into. Everything else in this
 * composition keeps the two poles and the seats around them.
 */
function inPlace(
  a: Analysis,
  m: Material,
  p: Poles,
  rng: Rng,
  page: number,
): { marks: Mark[]; fitted: Fitted } | null {
  const scope = m.primary.scope
  const focus = m.primary.focus
  if (!scope || scope.kind !== 'unit' || scope.target.length !== 1) return null
  if (p.kind !== 'containment' || focus.kind !== 'pair') return null
  const at = scope.target[0]
  const outer = p.b[0]
  // the character the title writes must be the one the figure comes out of
  if (!outer || outer.grapheme !== at || p.a[0]?.grapheme !== at) return null
  const units = m.tokens.flat()
  const targetUnit = units.find((u) => u.grapheme === at)
  if (!targetUnit || !isWritten(targetUnit)) return null

  const seats = seatsOf(a)
  const index = seats.indexOf(at)
  if (index < 0) return null
  const { vertical } = directions(a)
  const r = focus.relation

  // the whole title, solved as one layout: the line of seats first
  const margin = 0.07 * page
  const pitch = Math.min((page - 2 * margin) / Math.max(1, seats.length), 0.3 * page)
  const target = pitch * 0.92
  const base = Math.max(MIN_READABLE * page, target / 1.5)
  const originAlong = (page - (seats.length - 1) * pitch) / 2
  // 造形: the line of the reading runs in one of the outer thirds; the figure
  // grows from the seat towards the open side of the page
  const lineCross = offCentre(rng)
  const dir = lineCross < page / 2 ? 1 : -1
  const place = (t: number, cross: number): Vec => (vertical ? { x: cross, y: t } : { x: t, y: cross })

  const marks: Mark[] = []
  for (const u of units) {
    if (!isWritten(u)) continue
    const i = seats.indexOf(u.grapheme)
    if (i < 0) continue
    const size = u.grapheme === at ? target : base
    marks.push(
      ...unitMarks(a, u, place(originAlong + i * pitch, lineCross), size).map((k) =>
        u.grapheme === at ? k : { ...k, context: true },
      ),
    )
  }

  // the arm: what was read inside the character, then what is left of it
  const gap = 0.04 * page
  const room = (dir > 0 ? page - lineCross : lineCross) - 0.05 * page - target / 2
  const box = r.residue.box
  const boxAcross = (vertical ? box.w : box.h) / EM
  const boxAlong = (vertical ? box.h : box.w) / EM
  let found = target
  let residue = Math.min(target * 1.3, pitch * 1.6)
  const need = 2 * gap + found + residue
  if (need > room) {
    const k = Math.max(0.35, room / need)
    found *= k
    residue *= k
  }
  const seatAlong = originAlong + index * pitch
  const foundAt = lineCross + dir * (target / 2 + gap + found / 2)
  const residueAt = foundAt + dir * (found / 2 + gap + residue / 2)
  marks.push(...centredLine(a, [{ grapheme: -1, token: -1, char: r.inner }], place(seatAlong, foundAt), found))
  // the residue is sized by how much of it has form, not by its em square
  const S = clamp(residue / Math.max(0.08, boxAcross), 0, Math.min(1.3 * page, (pitch * 2.2) / Math.max(0.08, boxAlong)))
  const g = placeRegion(box, S, place(seatAlong, residueAt))
  marks.push({ char: outer.char, x: g.x, y: g.y, size: S, minus: outer.minus, keep: outer.minus?.keep })

  const fitted: Fitted = {
    sizes: [base, target, found, S],
    desired: 'normal',
    achieved: 'normal',
    bled: false,
    decisions: [
      {
        name: 'base',
        ground: 'linguistic',
        value: (base / page).toFixed(3),
        note: `題の${seats.length}字を一本の行として先に置く：文脈は注釈ではなく、変形される前からある題そのもの`,
      },
      {
        name: 'target',
        ground: 'linguistic',
        value: (target / page).toFixed(3),
        note: '対象は自分の席に留まり、そこでだけ大きくなる',
      },
      {
        name: 'arm',
        ground: 'plastic',
        value: `${(found / page).toFixed(2)} / ${(residue / page).toFixed(2)}`,
        note: '字の中に読まれた形と、それを引いた残りが、その席から行の外へ伸びる',
      },
    ],
  }
  return { marks, fitted }
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
    '包含の二極（題が両方の字を書く場合）：取り出された字と、外の字からそれを引いた残りを並べる。大きさは帯から選ばず、残りが外の字のインクの何割を保つか（読みの測定値）から、二つが同じ量のインクを持つように解く。軸は残りの形の長い辺を横切る向きに取り、紙面の内に収める',
    '題の外の部品との関係では、一方の極に元の字をそのまま、もう一方にその字から部品を引いた残りを置き、間に見つかった部品を小さく置く：読み手が三者を一枚で辿れるようにする',
    '拍の重さが決めた大小の比は保たれる。紙面がそれを収めきれないときは、比を崩さずに全体を小さくし、それでも収まらなければ字を紙面の外へ出す',
    'この構成では、読める字を表現のために回さない（放射や流れのように、構成そのものが向きを持つ場合はその限りではない：これは二極に限った制約）',
    '距離・大小の比・揃え方・白の寄り・軸の向き・横ずれは、題の特徴から決まる（axisParams.ts）。一篇で中立から動くのは、最も強い二つだけ',
    '題の一部だけが対象のとき、置かれなかった字は消えない：題の書字方向に、書かれた順のまま、一定の間隔で並ぶ（poem/context.ts）。対象が離れた席から引き出されているときは、その間隔が席の位置を保つ',
    '文脈は主要素より明確に小さく、しかし読める大きさを下回らない。対象は紙面の外へ出てよいが、文脈は出ない',
    '対象が題の一字だけのときは、二極にしない：題を一本の行として先に置き、その字は自分の席に留まったまま変質し、そこから生じたもの（読まれた形・引いた残り）だけが席の外へ伸びる。題は図の注釈ではなく、変形される前からある詩の本体である',
    '継ぎ目（joint）：語幹と活用語尾の関係は、二極に引き離す代わりに、題を一本の行として一度だけ書き、言語が切るところで切ることができる。一席一字、どの字も同じ大きさ。開くのは境だけ——継ぎ目は半席、書かれた空白は一席、消された席は空席のまま。大きさは席の数から解かれ、帯から選ばない（joint.ts）',
    '継ぎ目を行にするのは、その行が二極の保てないものを保つときだけ：継ぎ目の片側が二席以上ある、消された席がある、題が空白を書いている、同じ読みの列に題の残りがある。一字と語尾だけの語では、行は二極より多くを言わず、しかも小さく言うので、二極のままにする。二つの書き方に別々の適合度は与えない——同じ一つの関係である',
  ],

  fit(a, m) {
    const p = poles(a, m)
    if (!p) return null
    // one relation, two ways of holding it: the seam becomes a line only where
    // the line keeps something the poles cannot. The fitness is the same
    // either way — this is not a second candidate.
    const held = p.kind === 'inflection' ? jointHolds(a, m) : null
    return {
      id: 'axis',
      score: POLE_SCORE[p.kind],
      grounds: held ? [p.ground, `一行に書いて継ぎ目で切る：${held.why}`] : [p.ground],
      mode: held ? 'joint' : undefined,
    }
  },

  realize(a, m, rng, _scale, r) {
    const p = poles(a, m)!
    const shape = axisShape(a, m, p, PAGE, axis.bleed ?? false)
    const occ = shape.occupancy
    const close = closeness(p)

    // 継ぎ目 — the word written as one line and cut where the language cuts
    // it, instead of pulled to two poles. Which way this title takes was
    // settled in `fit`; a review force may also name it ('joint'), or ask for
    // the poles back ('poles'), without touching the fitness either way.
    if (r?.mode === 'joint' && p.kind === 'inflection') {
      const line = jointLine(a, m)
      const laid = line && layJoint(a, line, rng, shape.whitePull, PAGE)
      if (laid) return { marks: laid.marks, parameters: shape.parameters, contract: laid.contract }
    }

    // one character of the title, changed where it stands
    const own = inPlace(a, m, p, rng, PAGE)
    if (own)
      return {
        marks: own.marks,
        parameters: shape.parameters,
        contract: {
          occupancy: occ,
          fitted: own.fitted,
          context: [
            {
              name: 'mode',
              ground: 'linguistic',
              value: 'その場での変質',
              note: '対象が題の一字だけのとき、題を一行として先に置き、対象はその席で変わる（大きな図形に小さな題を添えない）',
            },
            {
              name: 'reading direction',
              ground: 'linguistic',
              value: a.direction === 'vertical' ? '縦' : '横',
              note: '行は題の書字方向に、書かれた順のまま',
            },
          ],
        },
      }

    let vertical = shape.vertical
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
      // Two terms taken out of one character: the part the reading found, and
      // what is left of the character without it. Neither is given the page by
      // default. Their sizes come from the reading itself — what share of the
      // outer's ink the residue keeps — so that the two carry the same weight
      // of ink and can be compared side by side; a thin residue is written
      // larger than a solid one, and the part smaller than the remainder only
      // where the remainder has the body to hold it.
      const outer = p.b[0]
      const r = m.primary.focus.kind === 'pair' ? m.primary.focus.relation : null
      const box = r?.residue.box ?? { x: -EM / 2, y: -EM / 2, w: EM, h: EM }
      const k = residueRatio(a, p.a[0]?.char ?? outer.char, outer.char, r?.residue.share ?? 1)
      // the residue's own form sets the axis: the pair runs across its long
      // side, so that a strip is seen as a strip and not cut lengthwise
      vertical = box.w >= box.h
      const along = (vertical ? box.h : box.w) / EM
      const across = (vertical ? box.w : box.h) / EM
      const span = occ.reach * PAGE
      const S = Math.min((span - gap) / (k + along), (0.9 * PAGE) / Math.max(k, across)) * rng.range(0.97, 1)
      const sa = k * S
      const length = sa + gap + along * S
      const centre = clamp(shape.whitePull * PAGE, length / 2, PAGE - length / 2)
      startAt = centre - length / 2
      endAt = centre + length / 2
      inkA = sa
      fitted = {
        sizes: [sa, S],
        desired: bandOf(Math.max(sa, along * S, across * S), PAGE),
        achieved: bandOf(Math.max(sa, along * S, across * S), PAGE),
        bled: false,
        decisions: [
          {
            name: 'ratio',
            ground: 'linguistic',
            value: k.toFixed(2),
            note: `残りは外の字のインクの${((r?.residue.share ?? 1) * 100).toFixed(0)}%：取り出された字と残りが同じ量のインクを持つ大きさの比`,
          },
          {
            name: 'axis',
            ground: 'plastic',
            value: vertical ? '縦' : '横',
            note: `残りの形（${box.w.toFixed(0)}×${box.h.toFixed(0)}）の長い辺を横切る向き`,
          },
        ],
      }
      const centreA = at(startAt + sa / 2, lineA)
      const halfA = ((unitsA.length - 1) * sa) / 2
      marks.push(...centredLine(a, unitsA, centreA, sa))
      put(unitsA, { x: centreA.x - reading.along.x * halfA, y: centreA.y - reading.along.y * halfA }, sa)
      const g = placeRegion(box, S, at(endAt - (along * S) / 2, lineB))
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
