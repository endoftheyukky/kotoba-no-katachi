/**
 * 経路 — PATH / FLOW
 *
 * The reading has an order, and an order can be a route. The title is written
 * once along it: not multiplied as in a band, not tabulated as in a grid, but
 * walked.
 *
 * What the language gives and what form takes are kept apart:
 *
 *   linguistic  the order itself, and where the route is articulated — a
 *               token boundary, a written space, the joint between a stem
 *               and its ending, the boundary between the groups of a
 *               reduplication. How many corners there are is not a choice.
 *   plastic     which line of the page the route runs on, how wide each
 *               corner opens (30–90°), and the curvature of a run that has
 *               no corner at all. All of it from the title's own seed, so
 *               the same title always walks the same way.
 *
 * A recurrence is not a corner. That the same character comes back says that
 * it comes back; it does not say that the route turns there. A recurrence may
 * make a short title eligible for a route — there is something to follow —
 * but the route then runs, and only an articulated boundary bends it.
 *
 * Rotation is not a parameter here. Each mark is turned by the angle between
 * the route's tangent and the direction the title is written in, so a
 * straight route rotates nothing and a bent one carries its characters round
 * with it. No other composition sets rotation.
 */
import { clamp } from '../../core/math'
import { PAGE } from '../../render/stage'
import { layContext, MIN_READABLE } from '../context'
import { BANDS } from '../contract'
import { seatsOf } from '../scope'
import type { Analysis, Mark, Material, Realization, SpatialComposition, Unit, Vec } from '../types'
import { allUnits, directions, isWritten, unitMarks } from './common'

/**
 * How far the whole route may change direction, end to end. The budget is
 * shared out between the corners, so a short sequence with several
 * articulations bends as much as a short sequence with one — a route, not a
 * pile of tipped-over characters. Bounds and rate are plastic (v1).
 */
const TURN = { min: 30, max: 90, perUnit: 12 }
/** how far a run may bend, per step — plastic, run only */
const CURVE_MAX = 10
/** the route claims about this much of the page, and may run past it */
const REACH = 0.95
const BLEED = 1.15

interface Step {
  unit: Unit | null
  /** how far the route advances here: a beat that lasts two takes two */
  weight: number
  /** set where the language articulates the sequence at this step */
  turn?: string
  /** whether anything is drawn here: a seat the poem writes as space is not */
  visible: boolean
}

/** at least this many characters must be drawn for a route to be one */
const ROUTE_MARKS = 4
/** a corner is read from the direction on either side of it */
const SUPPORT = 2

/**
 * Which articulations a route can actually show.
 *
 * A corner is read from the characters around it: the two seats it lies
 * between must both be written, and there must be enough drawn on either
 * side for a direction to be seen at all. Where the poem writes a seat as
 * space, the language still articulates there — the analysis keeps it — but
 * the route cannot bend where nothing is drawn, and the corner is not moved
 * somewhere more convenient. It is simply not available to this realization.
 */
function support(steps: Step[]): { usable: number[]; blocked: { at: number; why: string; reason: string }[] } {
  const usable: number[] = []
  const blocked: { at: number; why: string; reason: string }[] = []
  const before = (i: number) => steps.slice(0, i).filter((s) => s.visible).length
  const after = (i: number) => steps.slice(i).filter((s) => s.visible).length
  steps.forEach((s, i) => {
    if (!s.turn || i === 0) return
    if (!steps[i - 1].visible || !s.visible)
      blocked.push({ at: i, why: s.turn, reason: '境の前後どちらかが空白として書かれていて、折れが見えない' })
    else if (before(i) < SUPPORT || after(i) < SUPPORT)
      blocked.push({ at: i, why: s.turn, reason: `折れの前後に向きを読める字が足りない（${before(i)}字 / ${after(i)}字）` })
    else usable.push(i)
  })
  return { usable, blocked }
}

/** the sequence to walk, and where the language articulates it */
function sequence(a: Analysis, m: Material): { steps: Step[]; turns: number } | null {
  const seats = seatsOf(a)
  if (seats.length < 2) return null
  const units = allUnits(m)
  const read = a.morae.filter((mo) => mo.kind !== 'unread')

  // where the language articulates the reading — never a mere recurrence
  const turnAt = new Map<number, string>()
  const say = (seat: number, why: string) => {
    const i = seats.indexOf(seat)
    if (i > 0 && !turnAt.has(i)) turnAt.set(i, why)
  }
  const spaced = new Set(
    a.relations.flatMap((r) => (r.kind === 'separation' ? [a.tokens[r.right]?.start ?? -1] : [])),
  )
  seats.forEach((g, i) => {
    if (i === 0) return
    if (a.tokenOf[g] !== a.tokenOf[seats[i - 1]]) turnAt.set(i, spaced.has(g) ? '書かれた空白' : '語の境')
  })
  for (const r of a.relations) if (r.kind === 'inflection') say(r.at, '語幹と活用語尾の継ぎ目')
  // the boundary between the groups of a reduplication: ころ|ころ
  const f = m.primary.focus
  if (f.kind === 'repetition' && f.occurrences.length >= 2 && f.occurrences.every((g) => g.length >= 2))
    for (const g of f.occurrences.slice(1)) say(g[0], '反復の群の境')

  const steps: Step[] = seats.map((g, i) => {
    const mo = read.find((x) => x.graphemes.includes(g))
    const weight = mo ? Math.max(0.6, mo.weight / mo.graphemes.length) : 1
    const unit = units.find((u) => u.grapheme === g) ?? null
    return { unit, weight, turn: turnAt.get(i), visible: !!unit && isWritten(unit) }
  })
  return { steps, turns: turnAt.size }
}

/** does the title give anything to follow at all? */
function eligible(a: Analysis, m: Material, steps: Step[], turns: number): string | null {
  if (steps.length >= 6) return `${steps.length}単位の列：一本の線では読み切れない長さ`
  if (turns >= 1) return '言語が列を節で区切っている'
  const f = m.primary.focus
  const recurs =
    f.kind === 'repetition' ||
    a.relations.some((r) => r.kind === 'recurrence' || r.kind === 'reduplication')
  if (recurs && steps.length >= 4) return '戻ってくるものがある列：辿るに足る'
  return null
}

interface Walk {
  at: Vec[]
  /** degrees, relative to the direction the title is written in */
  rotate: number[]
  box: { x0: number; y0: number; x1: number; y1: number }
}

/**
 * Walk the route in page units, from the origin, before it is placed.
 * `turns` holds one angle per articulation, in order; `curve` bends a run.
 */
function walk(
  steps: Step[],
  pitch: number,
  turns: { at: number[]; angle: number[] } | null,
  curve: number,
  base: number,
): Walk {
  let angle = base
  let x = 0
  let y = 0
  const at: Vec[] = []
  const rotate: number[] = []
  let taken = 0
  steps.forEach((s, i) => {
    if (i > 0) {
      if (turns && turns.at.includes(i)) angle += turns.angle[taken++ % turns.angle.length]
      else if (!turns) angle += curve
      const r = (angle * Math.PI) / 180
      x += Math.cos(r) * pitch * s.weight
      y += Math.sin(r) * pitch * s.weight
    }
    at.push({ x, y })
    rotate.push(angle - base)
  })
  const xs = at.map((p) => p.x)
  const ys = at.map((p) => p.y)
  return { at, rotate, box: { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) } }
}

export const path: SpatialComposition = {
  id: 'path',
  title: '経路',
  accepts: ['repetition', 'absence', 'joint', 'parts', 'plain'],
  // a route may run off the page; every character keeps a part of itself on it
  bleed: true,
  rules: [
    '読みには順序があり、順序は経路になりうる：題は増殖も表組みもされず、一度だけ、経路の上を歩かれる',
    '四単位に満たない列は経路にならない：三字の線の中の折れは、両側に辿るものがないので何も区切らない',
    '経路の折れは、言語が列を区切るところにだけ生まれる：語の境、書かれた空白、語幹と活用語尾の継ぎ目、畳語の群の境。折れの数は選べない',
    '同じ字が戻ってくることは、折れではない：戻りは「辿るに足るものがある」ことを示すだけで、そこで曲がる理由にはならない',
    '経路が向きを変える総量は、列の長さで決まる（一単位あたり12°、30〜90°の範囲）：その総量を、言語が与えた折れの数で分け合う。節が多いほど一つ一つの折れは浅くなり、短い列が倒れた字の散らばりにならない',
    '経路は全体で一方向へ回る：折れごとに左右を入れ替えない。境が複数あっても一本の経路として追える',
    '折れは、描かれる字だけで読めるときにだけ使う：境の前後が書かれていて、その両側に向きを読める字が二つ以上あること。欠落した席の上の折れは、解析には残すが経路には使わず、位置も動かさない',
    '折れの総量の使い切り方、回る向き、節のない走りの曲率、経路が紙面のどこを走るかは造形であり、題の種から決まる：同じ題は同じように歩かれる',
    '字の向きは経路の接線と書字方向の差から導かれる：まっすぐな経路は字を回さず、曲がった経路は字を連れて回る。向きを独立に与えることはしない',
    '拍の重さが歩幅になる：二拍分の長音では、経路はその分だけ長く進む',
    '経路は紙面の外へ出てよいが、どの字も紙面に見える部分を残す。文脈は紙面内に留まる',
  ],

  offer(a, m) {
    const seq = sequence(a, m)
    if (!seq) return []
    const why = eligible(a, m, seq.steps, seq.turns)
    if (!why) return []
    const n = seq.steps.length
    // fewer than four steps is not a route but a line of three: a corner in it
    // articulates nothing, because there is nothing on either side of it
    if (n < 4) return []
    const load = seq.steps.reduce((t, s) => t + s.weight, 0)
    const pitch = (REACH * PAGE) / Math.max(1, load - 1)
    const size = Math.min(BANDS.normal[1] * PAGE, pitch * 0.82)
    const beats = seq.steps.some((s) => s.weight !== seq.steps[0].weight)
    const realisable = size >= MIN_READABLE * PAGE

    const shared = [
      { property: 'order', value: `${n}単位` },
      ...(beats ? [{ property: 'beat spacing', value: seq.steps.map((s) => s.weight.toFixed(1)).join('/') }] : []),
    ]
    const losses: { property: string; value: string }[] = []
    const f = m.primary.focus
    if (f.kind === 'repetition' && f.occurrences.length >= 2 && f.occurrences.every((g) => g.length >= 2))
      losses.push({ property: 'grouping', value: `${f.occurrences.length}×${f.occurrences[0].length}` })
    if (m.tokens.flat().some((u) => u.absent)) losses.push({ property: 'empty places', value: '経路では長い一歩にしかならない' })

    // a route needs something to traverse: the longer the sequence, the more
    // there is of it to be a route at all
    const length = clamp((n - 3) / 4)
    const out: Realization[] = [
      {
        id: 'path',
        mode: 'run',
        uses: shared,
        losses,
        grounds: [
          `${why} → 題を一本の経路として歩かせる`,
          '走りは節を折れとして使わない：列全体をひと続きに歩き、上限つきのわずかな曲率だけを持つ',
        ],
        fitness: 0.8 * (0.55 + 0.45 * length) * (beats ? 1.05 : 1),
        realisable,
        demand: { reach: REACH, spread: 'line', minSize: size / PAGE, cells: n },
      },
    ]
    if (seq.turns >= 1) {
      const { usable, blocked } = support(seq.steps)
      const drawn = seq.steps.filter((s) => s.visible).length
      const shown = usable.map((i) => seq.steps[i].turn!)
      const held = drawn >= ROUTE_MARKS && usable.length >= 1
      out.push({
        id: 'path',
        mode: 'turned',
        uses: [
          ...shared,
          { property: 'articulation', value: `${usable.length}（${[...new Set(shown)].join('・') || '—'}）` },
          { property: 'drawn marks', value: `${drawn}` },
        ],
        losses: [
          ...losses,
          ...blocked.map((b) => ({ property: 'articulation', value: `${b.why}：${b.reason}` })),
        ],
        grounds: held
          ? [`列は${usable.length}箇所で区切られ、その折れは描かれる字だけで読める → そこで経路が折れる`]
          : [
              drawn < ROUTE_MARKS
                ? `描かれる字が${drawn}しかない：折れを持つ経路にならない`
                : '言語は列を区切っているが、その折れを描かれる字だけでは読めない',
              '折れの位置は動かさない：この紙面では見せられない、というだけ',
            ],
        fitness: 0.8 * (0.4 + 0.6 * length) * (0.7 + 0.3 * clamp(seq.turns / 2)) * (beats ? 1.05 : 1),
        realisable: realisable && held,
        demand: { reach: REACH, spread: 'line', minSize: size / PAGE, cells: n },
      })
    }
    return out
  },

  fit(a, m) {
    const [r] = this.offer!(a, m).filter((o) => o.realisable)
    return r ? { id: 'path', score: r.fitness, grounds: r.grounds } : null
  },

  realize(a, m, rng, _scale, r) {
    const seq = sequence(a, m)
    if (!seq) return { marks: [] }
    const turned = r?.mode === 'turned'
    const { vertical } = directions(a)
    // the route starts out the way the title is written
    const base = vertical ? 90 : 0
    // 造形, from the title's own seed: which side the first corner opens to,
    // how wide each corner opens, and how far a run without corners bends
    // 造形, from the title's own seed: the route turns one way for its whole
    // length, and the total change of direction is a budget set by how long
    // the sequence is, shared out between the corners the language gave it.
    const side = rng.next() < 0.5 ? 1 : -1
    let turns: { at: number[]; angle: number[] } | null = null
    if (turned) {
      // only the corners this realization can actually show
      const at = support(seq.steps).usable
      const count = Math.max(1, at.length)
      const budget = clamp(TURN.perUnit * (seq.steps.length - 1), TURN.min, TURN.max) * rng.range(0.8, 1)
      const share = Array.from({ length: count }, () => rng.range(0.8, 1.2))
      const sum = share.reduce((t, w) => t + w, 0)
      turns = { at, angle: share.map((w) => (side * budget * w) / sum) }
    }
    const curve = turned ? 0 : rng.range(-CURVE_MAX, CURVE_MAX)

    const load = seq.steps.reduce((t, s) => t + s.weight, 0)
    let pitch = (REACH * PAGE) / Math.max(1, load - 1)
    let placed: { marks: Mark[]; put: { grapheme: number; x: number; y: number; size: number }[] } | null = null

    // every character keeps a part of itself on the page
    for (let tries = 0; tries < 5 && !placed; tries++) {
      const w = walk(seq.steps, pitch, turns, curve, base)
      const size = Math.min(BANDS.normal[1] * PAGE, pitch * 0.82)
      const extent = Math.max(w.box.x1 - w.box.x0, w.box.y1 - w.box.y0) || 1
      const k = Math.min(1, (BLEED * PAGE) / extent)
      const cx = ((w.box.x0 + w.box.x1) / 2) * k
      const cy = ((w.box.y0 + w.box.y1) / 2) * k
      const s = size * k
      const marks: Mark[] = []
      const put: { grapheme: number; x: number; y: number; size: number }[] = []
      let visible = true
      seq.steps.forEach((step, i) => {
        const x = PAGE / 2 + w.at[i].x * k - cx
        const y = PAGE / 2 + w.at[i].y * k - cy
        if (!step.unit || !isWritten(step.unit)) return
        if (x + s / 2 < 0 || x - s / 2 > PAGE || y + s / 2 < 0 || y - s / 2 > PAGE) visible = false
        marks.push(...unitMarks(a, step.unit, { x, y }, s).map((k2) => ({ ...k2, rotate: (k2.rotate ?? 0) + w.rotate[i] })))
        put.push({ grapheme: step.unit.grapheme, x, y, size: s })
      })
      if (visible && marks.length) placed = { marks, put }
      else pitch *= 0.82
    }
    if (!placed) return { marks: [] }

    const context = layContext(a, m, placed.put, PAGE)
    return { marks: context ? [...placed.marks, ...context.marks] : placed.marks }
  },
}
