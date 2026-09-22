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
}

/** the longest a trace may reach across the page, and the least a mark may be */
const REACH = 0.86
const MIN_SIZE = 0.035
const MAX_SIZE = 0.3

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

/** the trace's geometry: where each unit falls, how large, before anything is drawn */
export function traceGeometry(a: Analysis, units: Unit[], p: TraceParams) {
  const { vertical } = directions(a)
  const base = vertical ? Math.PI / 2 : 0
  const steps: Step[] = units.map((u, i) => ({ unit: u, weight: p.weights[i] ?? 1, size: p.sizes[i] ?? 1 }))
  if (!steps.length) return null

  let path = p.branch ? branched(steps, p, base) : walk(steps, p, base)
  path = swell(path, p)

  // fit: the longer side of the figure reaches REACH of the page
  const xs = path.at.map((q) => q.x)
  const ys = path.at.map((q) => q.y)
  const box = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }
  const extent = Math.max(box.x1 - box.x0, box.y1 - box.y0) || 1
  // a step of 1 unit must still hold a readable glyph: the size follows the spacing
  const nearest = Math.min(...steps.map((s) => s.weight), 1)
  const k = (REACH * PAGE) / (extent + nearest)
  let em = Math.min(MAX_SIZE * PAGE, Math.max(MIN_SIZE * PAGE, nearest * k * 0.86))
  const cx = (box.x0 + box.x1) / 2
  const cy = (box.y0 + box.y1) / 2

  // Where the curve turns back on itself, marks that are far apart along the
  // reading come near on the page. No two characters are written over each
  // other: the size follows the closest pair, whichever pair that is.
  const written = steps.map((s, i) => ({ i, s })).filter(({ s }) => isWritten(s.unit))
  let room = 1
  for (let u = 0; u < written.length; u++)
    for (let v = u + 1; v < written.length; v++) {
      const at1 = path.at[written[u].i]
      const at2 = path.at[written[v].i]
      const d = Math.hypot(at1.x - at2.x, at1.y - at2.y) * k
      // a turned glyph needs its diagonal
      // a turned glyph claims its diagonal
      const want = 0.5 * (written[u].s.size + written[v].s.size) * (p.tangency > 0.2 ? 1.45 : 0.92)
      if (want > 0) room = Math.min(room, d / (want * em))
    }
  em = Math.max(MIN_SIZE * PAGE, em * Math.min(1, room))

  return { steps, path, k, em, cx, cy }
}

/** the trace's marks, fitted onto the page */
export function traceMarks(a: Analysis, units: Unit[], p: TraceParams, centre: Vec = { x: PAGE / 2, y: PAGE / 2 }): Traced {
  const g = traceGeometry(a, units, p)
  if (!g) return { marks: [], put: [] }
  const { steps, path, k, em, cx, cy } = g
  const { vertical } = directions(a)
  const base = vertical ? Math.PI / 2 : 0
  const marks: Mark[] = []
  const put: Traced['put'] = []
  for (const [i, s] of steps.entries()) {
    const at = { x: centre.x + (path.at[i].x - cx) * k, y: centre.y + (path.at[i].y - cy) * k }
    const size = Math.max(MIN_SIZE * PAGE, em * s.size)
    const rotate = ((path.heading[i] - base) * 180 * p.tangency) / Math.PI
    if (isWritten(s.unit)) {
      const made = unitMarks(a, s.unit, at, size).map((m) => (rotate ? { ...m, rotate: (m.rotate ?? 0) + rotate } : m))
      marks.push(...made)
      put.push({ grapheme: s.unit.grapheme, x: at.x, y: at.y, size, rotate })
    }
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
