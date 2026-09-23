/**
 * v4 — the trace: one parametric curve that contains a line, an arc and a ring.
 *
 * v1–v2c hold a sequence in several separate compositions — a band (a straight
 * row), a joint line, a path (a line that turns at the language's breaks), an
 * orbit ring (a closed circle of copies) — and a title belongs to one of them.
 * Here they are one generator with continuous parameters, and a title takes a
 * place in it:
 *
 *   closure 0                    a straight row          (band, joint line)
 *   closure 0.1–0.4, corners 1   a line that turns at its word boundaries (path)
 *   closure 0.5–0.8              an arc that bends back toward its start
 *   closure 1, opening 0         a closed ring           (orbit)
 *   closure 1, opening > 0       a ring left open        (a directed relation)
 *
 * The units are walked with a turtle: each step advances by its own weight
 * (the beats it takes to say) and turns by its share of the total turning.
 * Where the turning is spent at the language's breaks the curve has corners;
 * where it is spread over every step the curve bends smoothly. Eccentricity
 * swells the curve toward its heaviest character; branches leave it at a
 * coordination. Nothing here is random: every parameter is derived in
 * parametric/params.ts, and the plastic choices are the same ones the v1
 * compositions make (which side, where on the page).
 */
import { PAGE } from '../../render/stage'
import type { Analysis, Mark, Unit, Vec } from '../types'
import { directions, isWritten, unitMarks } from '../spatial/common'
import { CENTRED, fit, type PaperParams } from './paper'
import type { Acts } from './acts'
import type { Rect } from '../../render/stage'

export interface TraceParams {
  /** total turning, in turns: 0 a straight line, 0.5 a half turn, 1 a closed ring */
  closure: number
  /** how much of that turning is spent at the language's breaks (1) rather than evenly (0) */
  corners: number
  /** the arc a closed curve leaves empty, in turns, on the side it opens toward */
  opening: number
  /** how far the curve swells toward its heaviest character */
  eccentricity: number
  /** how far each mark turns with the tangent */
  tangency: number
  /** which way the curve turns */
  side: 1 | -1
  /** per unit: how long a step it takes (its beats) */
  weights: number[]
  /** per unit: its size, relative to the base size */
  sizes: number[]
  /** the units at which the curve turns (indices into the units) */
  breaks: number[]
  /** at a coordination the trace divides: from this unit, this many ways, this wide (turns) */
  branch: { at: number; groups: number[][]; spread: number } | null
  /**
   * How many times the title is written, each time a row of its own. 1 is a
   * single trace; 2.5 writes it twice and half again; at many rows with no
   * turning the figure is v1's grid, and with turning it is a warped lattice.
   * There is no threshold between the two: a lattice of one row is a trace.
   */
  rows: number
  /** how far apart the rows stand, in steps of the reading's own */
  spacing: number
  /** how far each row is moved along the writing against the one before it */
  shear: number
  /** how much smaller each row is than the one before it */
  decay: number
  /** where the figure stands on the page, and how much of it it takes */
  paper: PaperParams
  /** what is done to the title's own characters (parametric/acts.ts) */
  acts?: Acts
}

/**
 * The longest a trace may reach across the page, and the smallest and largest a
 * character may be. The range is v2c's own (poem/scale.ts): micro 3.5 %, macro
 * up to 110 % — a character larger than the page, which the edge then cuts.
 */
const REACH = 0.86
const MIN_SIZE = 0.035
const MAX_SIZE = 1.15

export interface Traced {
  marks: Mark[]
  /** where each unit went, for the study sheet */
  put: { grapheme: number; x: number; y: number; size: number; rotate: number }[]
}

interface Step {
  unit: Unit
  weight: number
  size: number
}

/** the turn each step takes: the total, spent at the breaks and over the rest */
function turns(p: TraceParams, n: number): number[] {
  const closing = p.closure * (1 - p.opening)
  const total = 2 * Math.PI * closing * p.side
  const breaks = p.breaks.filter((i) => i > 0 && i < n)
  const atBreaks = breaks.length ? total * p.corners : 0
  const spread = total - atBreaks
  const out = new Array(n).fill(0)
  // As the curve closes, the turning is shared over one more place than there
  // are gaps — the turn that would bring it back to its start. Without that a
  // closing curve writes its last character on top of its first.
  for (let i = 0; i < n; i++) out[i] = spread / Math.max(1, n - 1 + closing)
  for (const b of breaks) out[b - 1] += atBreaks / (breaks.length + closing)
  return out
}

/** walk the units, in unit steps; the caller scales the result onto the page */
function walk(steps: Step[], p: TraceParams, base: number): { at: Vec[]; heading: number[] } {
  const dθ = turns(p, steps.length)
  const at: Vec[] = []
  const heading: number[] = []
  let x = 0
  let y = 0
  let h = base
  for (const [i, s] of steps.entries()) {
    at.push({ x, y })
    heading.push(h)
    x += Math.cos(h) * s.weight
    y += Math.sin(h) * s.weight
    h += dθ[i]
  }
  return { at, heading }
}

/**
 * How far from the page's edge a character's middle must stay, as a share of
 * its size. A large character may be cut by the edge — up to half of it off the
 * page, v2c's macro — and the cut reads as intended. A small character cut by
 * the edge reads as a mistake (a word in a corner losing its top), and may
 * change into another character (愛 cut at the top reads as 受): it stays wholly
 * on the page, with a little room. Continuous in size.
 */
export function edgeKeep(size: number): number {
  const t = Math.min(1, Math.max(0, (size / PAGE - 0.12) / (0.4 - 0.12)))
  return 0.62 + (0.26 - 0.62) * t
}

/** one placed unit: which unit, where, turned how far, how large */
export interface Placed {
  unit: Unit
  at: Vec
  heading: number
  /** its size against the figure's em */
  size: number
  /** which writing of the title it belongs to */
  row: number
  /** how far it leans (degrees) */
  lean?: number
  /** what of the glyph is kept (em space, ink centre = origin) */
  keep?: Rect[]
  /** for the halves of a cut character: which way the half moves, as a share of its size */
  part?: { x: number; y: number }
  /**
   * A character that has withdrawn from the others: it does not decide how
   * large the figure is written or where it stands — it goes where the act sent
   * it and is held on the page there.
   */
  free?: boolean
  /** where a withdrawn character would have stood had it stayed (figure units) */
  home?: Vec
}

/**
 * The figure's geometry: the title walked once, written as many times as
 * `rows` says, and put on the page where `paper` says. Nothing is drawn yet.
 */
export function traceGeometry(a: Analysis, units: Unit[], p: TraceParams) {
  const { vertical } = directions(a)
  const base = vertical ? Math.PI / 2 : 0
  const steps: Step[] = units.map((u, i) => ({ unit: u, weight: p.weights[i] ?? 1, size: p.sizes[i] ?? 1 }))
  if (!steps.length) return null

  let path = p.branch ? branched(steps, p, base) : walk(steps, p, base)
  path = swell(path, p)

  // The title written again: each row moved across the writing by `spacing`,
  // along it by `shear`, and smaller by `decay`. The last row may be partial —
  // `rows` is 2.5 when the title is written twice and half again — which is
  // how a repetition that does not come out even is held.
  const step = steps.reduce((t, x) => t + x.weight, 0) / Math.max(1, steps.length)
  const along = { x: Math.cos(base), y: Math.sin(base) }
  const across = { x: -Math.sin(base), y: Math.cos(base) }
  // How far apart the rows stand. A row that turns sweeps across the writing,
  // and two rows may not cross: the gap is the greater of what `spacing` asks
  // for and what the row's own turning takes, with room for a character.
  const sweptAcross = path.at.map((q) => q.x * across.x + q.y * across.y)
  const sweep = Math.max(...sweptAcross) - Math.min(...sweptAcross)
  const nearestStep = Math.min(...steps.map((x) => x.weight), 1)
  const gap = Math.max(p.spacing * step, sweep + nearestStep * 0.95)
  // What is done to the characters (parametric/acts.ts), in the figure's own
  // units, before anything is fitted: every guard below (no two characters over
  // each other, none lost at the edge) still holds whatever the acts did.
  const acts = p.acts
  const offsets: number[] = [0]
  for (let i = 1; i < steps.length; i++) offsets.push(offsets[i - 1] + (acts?.gaps[i - 1] ?? 0) * step)
  const acted = (i: number, last: boolean) => {
    const d = offsets[i]
    let dx = along.x * d
    let dy = along.y * d
    let scale = 1
    const w = acts?.withdraw
    // one character leaves the others: in a title written more than once, it
    // leaves from the last writing only
    const free = !!w && w.unit === i && steps.length > 1 && last
    const home = { x: dx, y: dy }
    if (free) {
      dx += Math.cos(w!.angle) * w!.distance * step
      dy += Math.sin(w!.angle) * w!.distance * step
      scale = 1 - w!.shrink
    }
    const lean = acts?.lean[i] ?? 0
    const e = acts?.erosion[i]
    const keep = e?.keep ?? undefined
    const c = acts?.cut
    const halves = c && c.unit === i ? cutHalves(c, keep) : undefined
    return { dx, dy, scale, lean, keep, halves, free, home }
  }
  const lay = (rows: number): Placed[] => {
    const whole = Math.ceil(rows - 1e-6)
    const out: Placed[] = []
    for (let r = 0; r < whole; r++) {
      const part = Math.min(1, rows - r)
      // a partial writing holds a character once it has at least half of that
      // character's share (rows 1.04 on a two-character title writes nothing more)
      const count = r === whole - 1 && part < 1 ? Math.round(part * steps.length) : steps.length
      if (!count) continue
      // a row dwindles, but never past being read: below two fifths the glyphs
      // would be smaller than the page allows and the row would fold into itself
      const shrink = Math.max(0.4, (1 - p.decay) ** r)
      const move = {
        x: (across.x * gap + along.x * p.shear * step) * r,
        y: (across.y * gap + along.y * p.shear * step) * r,
      }
      for (let i = 0; i < count; i++) {
        const done = acted(i, r === whole - 1)
        const item: Placed = {
          unit: steps[i].unit,
          at: { x: (path.at[i].x + done.dx) * shrink + move.x, y: (path.at[i].y + done.dy) * shrink + move.y },
          heading: path.heading[i],
          size: steps[i].size * shrink * done.scale,
          row: r,
          ...(done.lean ? { lean: done.lean } : {}),
          ...(done.keep ? { keep: done.keep } : {}),
          ...(done.free
            ? { free: true, home: { x: (path.at[i].x + done.home.x) * shrink + move.x, y: (path.at[i].y + done.home.y) * shrink + move.y } }
            : {}),
        }
        if (done.halves) for (const half of done.halves) out.push({ ...item, keep: half.keep, part: half.part })
        else out.push(item)
      }
    }
    return out
  }

  // fit: the figure takes as much of the page as `occupancy` says, and stands
  // where `offset` and `toward` put it
  const paper = p.paper ?? CENTRED
  const nearest = nearestStep
  const measure = (placed: Placed[], shrink: number) => {
    const held = placed.filter((q) => !q.free)
    const xs = (held.length ? held : placed).map((q) => q.at.x)
    const ys = (held.length ? held : placed).map((q) => q.at.y)
    const box = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }
    const fitted = fit({ ...paper, scale: paper.scale * shrink }, box, nearest)
    const k = fitted.k
    // the largest character is what the page's limit applies to: a mark stands
    // at `em` times its own relative size, and no character is written larger
    // than the page's macro
    const largest = Math.max(...placed.map((q) => q.size), 1)
    const first = Math.min((MAX_SIZE * PAGE) / largest, nearest * k * 0.86)
    // Where the curve turns back on itself, or where one row comes near the
    // next, marks far apart along the reading come near on the page. No two
    // characters are written over each other: the size follows the closest pair.
    const written = placed.filter((q) => isWritten(q.unit) && !q.free)
    let room = 1
    for (let u = 0; u < written.length; u++)
      for (let v = u + 1; v < written.length; v++) {
        // the two halves of a cut character are one character
        if (written[u].part && written[v].part && written[u].unit === written[v].unit && written[u].row === written[v].row) continue
        const d = Math.hypot(written[u].at.x - written[v].at.x, written[u].at.y - written[v].at.y) * k
        // a turned glyph claims its diagonal
        // a turned glyph claims its diagonal — turned with the curve, or leaning
        const leaning = Math.min(1, (Math.abs(written[u].lean ?? 0) + Math.abs(written[v].lean ?? 0)) / 24)
        const want = 0.5 * (written[u].size + written[v].size) * (p.tangency > 0.2 ? 1.45 : 0.92 + 0.53 * leaning)
        if (want > 0) room = Math.min(room, d / (want * first))
      }
    return {
      placed,
      written,
      box,
      k,
      centre: fitted.centre,
      em: first * Math.min(1, room),
      cx: (box.x0 + box.x1) / 2,
      cy: (box.y0 + box.y1) / 2,
    }
  }

  // Where the figure stands, once every character is on the page. A character
  // may be cut by the edge, but more than half of it stays: its middle keeps a
  // quarter of its size clear. Where no place satisfies every character the
  // figure is too large for the page, and it is drawn smaller until one does.
  const stand = (laid: ReturnType<typeof measure>) => {
    const em = Math.max(MIN_SIZE * PAGE, laid.em)
    const centre = { ...laid.centre }
    const at = (q: Placed, axis: 'x' | 'y') =>
      axis === 'x' ? centre.x + (q.at.x - laid.cx) * laid.k : centre.y + (q.at.y - laid.cy) * laid.k
    let ok = true
    for (const axis of ['x', 'y'] as const) {
      if (!laid.written.length) break
      let low = -Infinity
      let high = Infinity
      for (const q of laid.written) {
        const size = Math.max(MIN_SIZE * PAGE, em * q.size)
        const pos = at(q, axis)
        const keep = edgeKeep(size)
        low = Math.max(low, keep * size - pos)
        high = Math.min(high, PAGE - keep * size - pos)
      }
      if (low > high) ok = false
      centre[axis] += low <= high ? Math.min(Math.max(0, low), high) : (low + high) / 2
    }
    return { centre, ok }
  }

  // The title is written as many times as the page can hold and still be read:
  // where the rows would drive the characters below the smallest the page
  // allows, the last writing of the title is given up.
  let rows = Math.max(1, p.rows)
  let laid = measure(lay(rows), 1)
  while (laid.em < MIN_SIZE * PAGE && rows > 1) {
    rows = Math.max(1, rows - 0.5)
    laid = measure(lay(rows), 1)
  }
  let shrink = 1
  let stood = stand(laid)
  // drawn smaller only down to the smallest the page allows: below that the
  // characters would be written back up to it and could cover each other
  while (!stood.ok && shrink > 0.06) {
    const next = measure(lay(rows), shrink * 0.85)
    if (next.em < MIN_SIZE * PAGE) break
    shrink *= 0.85
    laid = next
    stood = stand(laid)
  }
  const { placed, k, cx, cy } = laid
  const em = Math.max(MIN_SIZE * PAGE, laid.em)
  const centre = stood.centre

  return { steps, path, placed, k, em, cx, cy, centre, base }
}

/** the figure's marks, on the page */
export function traceMarks(a: Analysis, units: Unit[], p: TraceParams, at?: Vec): Traced {
  const g = traceGeometry(a, units, p)
  if (!g) return { marks: [], put: [] }
  const { placed, k, em, cx, cy, base } = g
  const centre = at ?? g.centre
  const marks: Mark[] = []
  const put: Traced['put'] = []
  for (const q of placed) {
    let point = { x: centre.x + (q.at.x - cx) * k, y: centre.y + (q.at.y - cy) * k }
    const size = Math.max(MIN_SIZE * PAGE, em * q.size)
    // The withdrawn character is held on the page where it went (more than half
    // of it stays, as with every other character). Where that would put it on
    // another character it looks, in this order, for where it stood before it
    // withdrew, then for the page's corners — the first place that holds it
    // without covering anything. Deterministic; the act never breaks a rule.
    if (q.free) {
      const room = edgeKeep(size) * size
      const hold = (v: Vec) => ({ x: Math.min(PAGE - room, Math.max(room, v.x)), y: Math.min(PAGE - room, Math.max(room, v.y)) })
      const others = placed
        .filter((o) => o !== q && !o.free && isWritten(o.unit))
        .map((o) => ({ at: { x: centre.x + (o.at.x - cx) * k, y: centre.y + (o.at.y - cy) * k }, size: Math.max(MIN_SIZE * PAGE, em * o.size) }))
      const clear = (v: Vec) => others.every((o) => {
        const reach = 0.5 * (o.size + size) * 0.95
        return Math.abs(o.at.x - v.x) >= reach || Math.abs(o.at.y - v.y) >= reach
      })
      const home = q.home ? { x: centre.x + (q.home.x - cx) * k, y: centre.y + (q.home.y - cy) * k } : point
      const corners = [
        { x: room, y: room },
        { x: PAGE - room, y: room },
        { x: room, y: PAGE - room },
        { x: PAGE - room, y: PAGE - room },
      ].sort((u, v) => Math.hypot(u.x - point.x, u.y - point.y) - Math.hypot(v.x - point.x, v.y - point.y))
      point = [hold(point), hold(home), ...corners].find(clear) ?? hold(point)
    }
    const rotate = ((q.heading - base) * 180 * p.tangency) / Math.PI + (q.lean ?? 0)
    if (!isWritten(q.unit)) continue
    // the rule every character keeps, held here by construction as a last
    // resort: more than half of it on the page
    if (!q.free) {
      const room = edgeKeep(size) * size
      point = { x: Math.min(PAGE - room, Math.max(room, point.x)), y: Math.min(PAGE - room, Math.max(room, point.y)) }
    }
    // the halves of a cut character part along the seam's normal
    const at = q.part ? { x: point.x + q.part.x * size, y: point.y + q.part.y * size } : point
    const plain = unitMarks(a, q.unit, at, size)
    const worn = plain.flatMap((m) => {
      let out = rotate ? { ...m, rotate: (m.rotate ?? 0) + rotate } : m
      if (q.keep) {
        // a part of the glyph the act took away entirely is not drawn at all
        const keep = intersect(m.keep, q.keep)
        if (!keep.length) return []
        out = { ...out, keep }
      }
      return [out]
    })
    // Where the glyph already came in parts of its own (an earlier operation)
    // and none of them lies in what the wear keeps, the wear yields: a
    // character is never taken off the page by an act.
    const made = worn.length ? worn : plain.map((m) => (rotate ? { ...m, rotate: (m.rotate ?? 0) + rotate } : m))
    marks.push(...made)
    if (!q.part || q.part.x + q.part.y < 0) put.push({ grapheme: q.unit.grapheme, x: point.x, y: point.y, size, rotate })
  }
  return { marks, put }
}

/** the curve swells toward its heaviest character (eccentricity), once it has turned enough to have a centre */
function swell(path: { at: Vec[]; heading: number[] }, p: TraceParams): { at: Vec[]; heading: number[] } {
  if (p.eccentricity < 0.02 || p.closure < 0.45 || path.at.length < 4) return path
  const n = path.at.length
  const cx = path.at.reduce((s, q) => s + q.x, 0) / n
  const cy = path.at.reduce((s, q) => s + q.y, 0) / n
  const heavy = p.sizes.indexOf(Math.max(...p.sizes))
  const to = Math.atan2(path.at[heavy].y - cy, path.at[heavy].x - cx)
  return {
    heading: path.heading,
    at: path.at.map((q) => {
      const dx = q.x - cx
      const dy = q.y - cy
      const r = Math.hypot(dx, dy)
      const th = Math.atan2(dy, dx)
      const f = 1 + p.eccentricity * Math.cos(th - to)
      return { x: cx + r * f * Math.cos(th), y: cy + r * f * Math.sin(th) }
    }),
  }
}

/**
 * A coordination divides the trace: from the unit where the terms begin, one
 * arm per term, fanned about the heading the trace had there. Each arm walks
 * on with the trace's own rules; every unit is placed, and anything the terms
 * do not claim (the word that marks the coordination) stands at the fork.
 */
function branched(steps: Step[], p: TraceParams, base: number): { at: Vec[]; heading: number[] } {
  const b = p.branch!
  const at: Vec[] = new Array(steps.length)
  const heading: number[] = new Array(steps.length)
  const stemIdx = Array.from({ length: Math.min(b.at, steps.length) }, (_, i) => i)
  const stem = walk(stemIdx.map((i) => steps[i]), p, base)
  stemIdx.forEach((i, j) => {
    at[i] = stem.at[j]
    heading[i] = stem.heading[j]
  })
  const last = stem.at.length - 1
  const h0 = last >= 0 ? stem.heading[last] : base
  const from =
    last >= 0
      ? { x: stem.at[last].x + Math.cos(h0) * steps[stemIdx[last]].weight, y: stem.at[last].y + Math.sin(h0) * steps[stemIdx[last]].weight }
      : { x: 0, y: 0 }
  const arms = b.groups.length
  const fan = 2 * Math.PI * b.spread
  b.groups.forEach((group, n) => {
    const h = h0 + (arms > 1 ? fan * (n / (arms - 1) - 0.5) : 0)
    const armSteps = group.map((i) => steps[i]).filter(Boolean)
    const arm = walk(armSteps, { ...p, branch: null, breaks: [] }, h)
    // Where there is no stem the fork is the origin itself: each arm starts one
    // step out along its own direction, so the terms do not stand on each other.
    // Each arm also begins a little further along the writing than the one
    // before it, so that the terms are still read in their own order.
    const lead = stem.at.length ? 0 : armSteps[0]?.weight ?? 1
    const step = n * (armSteps[0]?.weight ?? 1) * 0.9
    const off = {
      x: from.x + Math.cos(h) * lead + Math.cos(base) * step,
      y: from.y + Math.sin(h) * lead + Math.sin(base) * step,
    }
    group.forEach((i, j) => {
      if (!arm.at[j]) return
      at[i] = { x: off.x + arm.at[j].x, y: off.y + arm.at[j].y }
      heading[i] = arm.heading[j]
    })
  })
  for (let i = 0; i < steps.length; i++)
    if (!at[i]) {
      at[i] = from
      heading[i] = h0
    }
  return { at, heading }
}

/** the em size a trace of n units of this weight would take (for fitness, before anything is drawn) */
export const traceSize = (load: number) => Math.min(MAX_SIZE * PAGE, ((REACH * PAGE) / (load + 1)) * 0.86) / PAGE

/** a character divided at its own seam: two keep regions, and which way each half moves */
function cutHalves(c: NonNullable<Acts['cut']>, keep: Rect[] | undefined): { keep: Rect[]; part: { x: number; y: number } }[] {
  const far = 80
  const [first, second]: Rect[] =
    c.axis === 'x'
      ? [
          { x: -far, y: -far, w: far + c.at, h: 2 * far },
          { x: c.at, y: -far, w: far - c.at, h: 2 * far },
        ]
      : [
          { x: -far, y: -far, w: 2 * far, h: far + c.at },
          { x: -far, y: c.at, w: 2 * far, h: far - c.at },
        ]
  // The halves part across the seam and slide along it, the way a fault moves:
  // parted only, a divided character can close into another character (束 into
  // 東); slid, the break is unmistakably a break.
  const half = c.apart / 2
  const away = c.axis === 'x' ? { x: 1, y: 0 } : { x: 0, y: 1 }
  const slide = c.axis === 'x' ? { x: 0, y: 1 } : { x: 1, y: 0 }
  return [
    { keep: intersect(keep, [first]), part: { x: -away.x * half - slide.x * half * 0.7, y: -away.y * half - slide.y * half * 0.7 } },
    { keep: intersect(keep, [second]), part: { x: away.x * half + slide.x * half * 0.7, y: away.y * half + slide.y * half * 0.7 } },
  ]
}

/** the regions both keep lists keep (a missing list keeps everything) */
function intersect(a: Rect[] | undefined, b: Rect[]): Rect[] {
  if (!a?.length) return b
  const out: Rect[] = []
  for (const r of a)
    for (const q of b) {
      const x0 = Math.max(r.x, q.x)
      const y0 = Math.max(r.y, q.y)
      const x1 = Math.min(r.x + r.w, q.x + q.w)
      const y1 = Math.min(r.y + r.h, q.y + q.h)
      if (x1 > x0 && y1 > y0) out.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 })
    }
  return out
}
