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

/** where the figure writes a character of the title */
type Placed = { grapheme: number; x: number; y: number; size: number }

/** the poles as drawn, and where each character of the title went */
type Figure = { marks: Mark[]; placedAt: Placed[] }

type Box = [x0: number, y0: number, x1: number, y1: number]

/**
 * The box of the ink a mark draws on the page: the glyph's measured ink box,
 * not its em square (a turned mark takes its longer side both ways); for a
 * mark that keeps only some regions of its glyph, the box of those regions;
 * a mark that keeps nothing draws nothing. What a subtraction removes is
 * still counted — the box never says less than the ink.
 */
function drawnBox(a: Analysis, k: Mark): Box | null {
  const s = k.size / EM
  if (k.keep) {
    if (!k.keep.length) return null
    const t = ((k.rotate ?? 0) * Math.PI) / 180
    const pts = k.keep
      .flatMap((r) => [
        [r.x, r.y],
        [r.x + r.w, r.y],
        [r.x, r.y + r.h],
        [r.x + r.w, r.y + r.h],
      ])
      .map(([u, w]) => {
        const x0 = (u + (k.shift?.x ?? 0)) * s
        const y0 = (w + (k.shift?.y ?? 0)) * s
        return [k.x + x0 * Math.cos(t) - y0 * Math.sin(t), k.y + x0 * Math.sin(t) + y0 * Math.cos(t)]
      })
    return [Math.min(...pts.map((q) => q[0])), Math.min(...pts.map((q) => q[1])), Math.max(...pts.map((q) => q[0])), Math.max(...pts.map((q) => q[1]))]
  }
  const half = a.glyphs.get(k.char).metrics.half
  const w = (k.rotate ? Math.max(half.w, half.h) : half.w) * s
  const h = (k.rotate ? Math.max(half.w, half.h) : half.h) * s
  const x = k.x + (k.shift?.x ?? 0) * s
  const y = k.y + (k.shift?.y ?? 0) * s
  return [x - w, y - h, x + w, y + h]
}

const meets = (p: Box, q: Box) => p[0] < q[2] && q[0] < p[2] && p[1] < q[3] && q[1] < p[3]

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
  marks.push({ char: outer.char, ...(outer.grapheme >= 0 ? { grapheme: outer.grapheme } : {}), x: g.x, y: g.y, size: S, minus: outer.minus, keep: outer.minus?.keep })

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
  // Two poles are fitted inside the page: where the page cannot hold the band
  // the grounds asked for, the marks are written smaller rather than cut by
  // its edge. A pole cropped by the paper says nothing the relation needs.
  bleed: false,
  rules: [
    '二項の関係（A または B、A と B、AがB、AをB、鏡像、よく似た二つの字形、語幹と活用語尾）は、一本の軸の両端に引き離される',
    '二極の間の長い白が、その関係である。関係語は極の間に小さく置かれるか、欠落として白になる',
    '言語上の隔たりは、紙面の広さではなく図形の内側の白になる：近い関係は大きな字が接して置かれ、遠い関係は字を紙面の端へ離す',
    '字形の差・語の継ぎ目を読ませる構成でも、字は拡大しない：二つを並べて比べられる大きさ（normal）で足りる。語と語の関係では、字の大きさではなく隔たりが働く（少数の小さな字と大きな余白も、それが関係の形であれば成り立つ）',
    '包含の二極（題が両方の字を書く場合）：取り出された字と、外の字からそれを引いた残りを並べる。大きさは帯から選ばず、残りが外の字のインクの何割を保つか（読みの測定値）から、二つが同じ量のインクを持つように解く。軸は残りの形の長い辺を横切る向きに取り、紙面の内に収める',
    '題の外の部品との関係では、一方の極に元の字をそのまま、もう一方にその字から部品を引いた残りを置き、間に見つかった部品を小さく置く：読み手が三者を一枚で辿れるようにする',
    '拍の重さが決めた大小の比は保たれる。紙面がそれを収めきれないときは、比を崩さずに全体を小さくする：極を紙面の縁で切ることはしない',
    'この構成では、読める字を表現のために回さない（放射や流れのように、構成そのものが向きを持つ場合はその限りではない：これは二極に限った制約）',
    '距離・大小の比・揃え方・白の寄り・軸の向き・横ずれは、題の特徴から決まる（axisParams.ts）。一篇で中立から動くのは、最も強い二つだけ',
    '題の一部だけが対象のとき、置かれなかった字は消えない：題の書字方向に、書かれた順のまま、一定の間隔で並ぶ（poem/context.ts）。対象が離れた席から引き出されているときは、その間隔が席の位置を保つ',
    '文脈は主要素より明確に小さく、しかし読める大きさを下回らない。対象は紙面の外へ出てよいが、文脈は出ない',
    '文脈の行は図形の上に書かない（図形が実際に描くインクの箱で判定：一部だけを残す字はその残す部分、何も残さない字は何も描かない）：遠い極から離れる側に場所がなければ、同じ極の反対側へ。ただし読みと軸が同じ向きのときだけ——読みが軸を横切るとき、反対側は二極の間の白、つまり関係そのものであり、文脈を入れない',
    'どちらの側にも行が立てないときは、軸を紙面の反対の外側に引く。軸がどちらの外側を走るかは種の選ぶ造形であり、題の残りが図形に重ならず読み順のまま読めることが先に立つ。極の大きさと軸に沿った位置は変えない',
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
      if (laid) return { marks: laid.marks, parameters: shape.parameters, contract: laid.contract, seats: laid.seats }
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

    // 造形: which line across the page the axis runs on. The seed chooses it,
    // and gives way only where the rest of the title would have nowhere to
    // stand (below); nothing else about the figure depends on it.
    const line = offCentre(rng)

    // the white inside the figure: what the language's distance asks for
    const gap = (1 - occ.fill) * occ.reach * PAGE
    // an erased character keeps its place inside a pole, but not at its edges:
    // absence writes a hole in a word, not an empty margin on the page
    const unitsA = trim(p.a)
    const unitsB = trim(p.b)
    const extentA = unitsA.length
    const extentB = unitsB.length

    const reading = directions(a)

    // the sizes of the poles and their places along the axis, decided once
    let fitted: Fitted
    let sa: number
    /** pole B, or for containment the residue */
    let sb: number
    let startAt: number
    let endAt: number
    let inkA: number
    /** containment: the residue's box, and its extent along the axis */
    let box = { x: -EM / 2, y: -EM / 2, w: EM, h: EM }
    let along = 1

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
      box = r?.residue.box ?? box
      const k = residueRatio(a, p.a[0]?.char ?? outer.char, outer.char, r?.residue.share ?? 1)
      // the residue's own form sets the axis: the pair runs across its long
      // side, so that a strip is seen as a strip and not cut lengthwise
      vertical = box.w >= box.h
      along = (vertical ? box.h : box.w) / EM
      const across = (vertical ? box.w : box.h) / EM
      const span = occ.reach * PAGE
      const S = Math.min((span - gap) / (k + along), (0.9 * PAGE) / Math.max(k, across)) * rng.range(0.97, 1)
      sa = k * S
      sb = S
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
    } else {
      // both poles are written: the sound decides their ratio, the page decides
      // how large that ratio can be drawn
      const k = Math.sqrt(shape.scaleRatio)
      fitted = fitSizes(
        { extents: [extentA, extentB], ratios: [k, 1 / k], band: close.band, note: close.note },
        occ,
        PAGE,
      )
      sa = jitter(rng, fitted.sizes[0])
      sb = jitter(rng, fitted.sizes[1])
      const length = extentA * sa + gap + extentB * sb
      const over = Math.max(0, (length - PAGE) / 2)
      const centre = clamp(shape.whitePull * PAGE, length / 2 - over, PAGE - length / 2 + over)
      startAt = centre - length / 2
      endAt = centre + length / 2
      inkA = extentA * sa
    }

    // the figure, drawn on one line across the page
    const draw = (line: number): Figure => {
      const lineA = clamp(line + shape.offsetA, 0.08 * PAGE, 0.92 * PAGE)
      const lineB = clamp(line + shape.offsetB + shape.alignment, 0.08 * PAGE, 0.92 * PAGE)
      const marks: Mark[] = []
      // where the figure writes each character of the title, for the seats
      const placedAt: Placed[] = []
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

      if (p.kind === 'containment') {
        const outer = p.b[0]
        const centreA = at(startAt + sa / 2, lineA)
        const halfA = ((unitsA.length - 1) * sa) / 2
        marks.push(...centredLine(a, unitsA, centreA, sa))
        put(unitsA, { x: centreA.x - reading.along.x * halfA, y: centreA.y - reading.along.y * halfA }, sa)
        const g = placeRegion(box, sb, at(endAt - (along * sb) / 2, lineB))
        marks.push({ char: outer.char, ...(outer.grapheme >= 0 ? { grapheme: outer.grapheme } : {}), x: g.x, y: g.y, size: sb, minus: outer.minus, keep: outer.minus?.keep })
        // what is left of a character is still that character's place in the title
        if (isWritten(outer)) placedAt.push({ grapheme: outer.grapheme, x: g.x, y: g.y, size: sb })
      } else {
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
      return { marks, placedAt }
    }

    // The rest of the title, in the order it was written, on a row beside the
    // figure — and never on it.
    //   input   the characters the poles do not carry, each with its seat
    //   rule    the row stands beside the first pole, on the side away from the
    //           far pole. The page's margin alone would take a row that has no
    //           room there back onto the pole; instead the other side of the
    //           same pole is tried, but only while the reading runs along the
    //           axis — across it, that side is the white between the poles,
    //           which is the relation and holds no context
    //   output  the same seats and size; only the side of the figure changes
    //   sound   none
    const row = (figure: Figure) => {
      const { placedAt } = figure
      const plan = placedAt.length
        ? planContext(a, m, new Set(placedAt.map((k) => k.grapheme)), Math.min(...placedAt.map((k) => k.size)), PAGE)
        : null
      if (!plan) return null
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
      const lay = (side: number): Mark[] => {
        const rowCross = clamp(
          crossOf(first) + side * (first.size / 2 + plan.size),
          0.04 * PAGE + plan.size / 2,
          0.96 * PAGE - plan.size / 2,
        )
        return plan.units.flatMap(({ unit, seat }) => {
          const t = line.origin + seat.index * line.pitch
          const where = reading.vertical ? { x: rowCross, y: t } : { x: t, y: rowCross }
          return unitMarks(a, unit, where, plan.size).map((k) => ({ ...k, context: true }))
        })
      }
      // what the figure draws, as boxes: a mark that keeps nothing draws nothing
      const figureInk = figure.marks.map((f) => drawnBox(a, f)).filter((b): b is Box => !!b)
      const clearOf = (row: Mark[]) =>
        row.every((k) => {
          const b = drawnBox(a, k)
          return !b || !figureInk.some((f) => meets(b, f))
        })
      const tried = (reading.vertical === vertical ? [side, -side] : [side]).map((s) => ({ s, marks: lay(s) }))
      const found = tried.find((t) => clearOf(t.marks))
      const decisions: Decision[] = [
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
      if (found && found.s !== side)
        decisions.push({
          name: 'row side',
          ground: 'plastic',
          value: '同じ極の反対側',
          note: '遠い極から離れる側には行の場所がない（紙面の端が行を極の上へ戻す）：読みと軸が同じ向きなので、反対側は二極の間の白ではない',
        })
      return { marks: (found ?? tried[0]).marks, decisions, clear: !!found }
    }

    let figure = draw(line)
    let rest = row(figure)
    let moved = false
    if (rest && !rest.clear) {
      // Neither side of the figure holds the row: the figure has taken the end
      // of the reading and the page across it. Which outer third the axis runs
      // in is the seed's choice (造形); that the rest of the title can be read,
      // clear of the figure and in its order, is the title's, and comes first.
      // The axis moves to the other outer third, and nothing else about it.
      const other = draw(PAGE - line)
      const again = row(other)
      if (again?.clear) {
        figure = other
        rest = again
        moved = true
      }
    }
    const context: Decision[] = rest ? [...rest.decisions] : []
    if (moved)
      context.push({
        name: 'axis line',
        ground: 'plastic',
        value: `${(line / PAGE).toFixed(2)} → ${((PAGE - line) / PAGE).toFixed(2)}`,
        note: '種の選んだ外側では、文脈の行が図形の外に立てない（題の続きが読みの中に場所を持たない）：軸を紙面の反対の外側に引く。大きさと軸に沿った位置は変えない',
      })
    else if (rest && !rest.clear)
      context.push({
        name: 'row',
        ground: 'plastic',
        value: '図形に重なる',
        note: '軸をどちらの外側に引いても、文脈の行が図形の外に立てない',
      })
    return {
      marks: [...figure.marks, ...(rest?.marks ?? [])],
      parameters: shape.parameters,
      contract: { occupancy: occ, fitted, context },
    }
  },
}
