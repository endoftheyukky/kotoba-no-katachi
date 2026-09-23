/**
 * v4 — the frame: the reading's own path on the page, as the material's axes.
 *
 * Until now the material was placed in the page's own coordinates: dust thinned
 * from left to right whatever the figure did, and the satellites stood on a
 * circle around the largest character. That made the material a layer laid over
 * the page rather than something the page is made of.
 *
 * The frame is where the reading goes: the written units in their order, as one
 * or more strands (a trace is one strand, or one per arm of a branch; a lattice
 * is one per row). Everything the material does is then said in two numbers:
 *
 *   s   how far along the reading — 0 where the title begins, 1 where it ends
 *   d   how far from it, across the page
 *
 * So the dust thins along the trace instead of along the page, the grain of a
 * lattice runs with its rows however they are sheared or curled, and the
 * satellites stand at a fixed distance from what is written — a circle when the
 * page is one character (v2c's orbit), the shape of the reading when it is not.
 *
 * Nothing here is random and nothing is a parameter: this is the geometry the
 * generator has already made, read back.
 */
import type { Vec } from '../types'

export interface Strand {
  /** page-space points, in the reading's order */
  at: Vec[]
  /** the reading parameter at the first and last point (0–1 over the whole figure) */
  s0: number
  s1: number
  /** page length of the strand */
  length: number
  /** whether the strand comes back to where it began */
  closed: boolean
}

export interface Frame {
  strands: Strand[]
  /** page length of the whole reading */
  length: number
  /** the typical distance between two written units: the frame's own step */
  step: number
}

export interface At {
  p: Vec
  /** the unit tangent, along the reading */
  t: Vec
  /** the unit normal, to the left of it */
  n: Vec
  /** the reading parameter here */
  s: number
}

const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y)

/**
 * The frame of a figure, from where its written units went. A gap much longer
 * than the usual step is not part of the reading's path — it is the jump from
 * one row of a lattice to the next, or from a branch's fork to its arm — so the
 * strand breaks there.
 */
export function frameOf(put: { x: number; y: number; size: number }[]): Frame {
  const n = put.length
  if (!n) return { strands: [], length: 0, step: 0 }
  const gaps: number[] = []
  for (let i = 1; i < n; i++) gaps.push(dist(put[i - 1], put[i]))
  const sorted = [...gaps].sort((a, b) => a - b)
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0
  const breaks = new Set<number>()
  for (let i = 1; i < n; i++) if (median > 0 && gaps[i - 1] > Math.max(2.2 * median, 1.2 * put[i].size)) breaks.add(i)

  const strands: Strand[] = []
  let start = 0
  const emit = (from: number, to: number) => {
    const at = put.slice(from, to + 1).map((q) => ({ x: q.x, y: q.y }))
    let length = 0
    for (let i = 1; i < at.length; i++) length += dist(at[i - 1], at[i])
    const s = (i: number) => (n > 1 ? i / (n - 1) : 0)
    strands.push({ at, s0: s(from), s1: s(to), length, closed: at.length > 2 && dist(at[0], at[at.length - 1]) < length / at.length })
  }
  for (let i = 1; i <= n; i++)
    if (i === n || breaks.has(i)) {
      emit(start, i - 1)
      start = i
    }
  const length = strands.reduce((s, x) => s + x.length, 0)
  return { strands, length, step: median }
}

/** where the reading passes closest to a page point: how far along it, and how far from it */
export function project(f: Frame, x: number, y: number): { s: number; d: number } {
  let best = { s: 0, d: Infinity }
  for (const strand of f.strands) {
    const at = strand.at
    if (at.length === 1) {
      const d = Math.hypot(x - at[0].x, y - at[0].y)
      if (d < best.d) best = { s: strand.s0, d }
      continue
    }
    let run = 0
    for (let i = 1; i < at.length; i++) {
      const ax = at[i - 1].x
      const ay = at[i - 1].y
      const bx = at[i].x
      const by = at[i].y
      const vx = bx - ax
      const vy = by - ay
      const len2 = vx * vx + vy * vy || 1
      const u = Math.min(1, Math.max(0, ((x - ax) * vx + (y - ay) * vy) / len2))
      const d = Math.hypot(x - (ax + u * vx), y - (ay + u * vy))
      if (d < best.d) {
        const along = strand.length ? (run + u * Math.hypot(vx, vy)) / strand.length : 0
        best = { s: strand.s0 + along * (strand.s1 - strand.s0), d }
      }
      run += Math.hypot(vx, vy)
    }
  }
  return best
}

/** walk a strand at an even step, with the tangent and the normal at each stop */
export function walk(strand: Strand, step: number): At[] {
  const at = strand.at
  if (step <= 0) return []
  if (at.length === 1) return [{ p: at[0], t: { x: 1, y: 0 }, n: { x: 0, y: -1 }, s: strand.s0 }]
  const out: At[] = []
  const count = Math.max(1, Math.round(strand.length / step))
  let seg = 1
  let base = 0
  for (let k = 0; k <= count; k++) {
    const want = (k / count) * strand.length
    while (seg < at.length - 1 && base + dist(at[seg - 1], at[seg]) < want) {
      base += dist(at[seg - 1], at[seg])
      seg++
    }
    const a = at[seg - 1]
    const b = at[seg]
    const l = dist(a, b) || 1
    const u = Math.min(1, Math.max(0, (want - base) / l))
    const t = { x: (b.x - a.x) / l, y: (b.y - a.y) / l }
    out.push({
      p: { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u },
      t,
      n: { x: t.y, y: -t.x },
      s: strand.s0 + (want / strand.length) * (strand.s1 - strand.s0),
    })
  }
  return out
}

/**
 * The loop at a fixed distance from a strand: the offset on one side, round its
 * end, back along the other, round its start. Where the strand is a single
 * point the two caps are the whole loop — a circle, which is what v2c's orbit
 * is. Where the strand closes, the loop is the outer offset alone.
 */
export function offsetLoop(strand: Strand, radius: number): Vec[] {
  const at = strand.at
  if (at.length === 1 || strand.length < radius * 0.5) {
    const c = at[0]
    return Array.from({ length: 48 }, (_, i) => {
      const th = (2 * Math.PI * i) / 48
      return { x: c.x + radius * Math.cos(th), y: c.y + radius * Math.sin(th) }
    })
  }
  const stops = walk(strand, Math.max(radius * 0.35, strand.length / 64))
  const side = (k: 1 | -1) => stops.map((q) => ({ x: q.p.x + k * q.n.x * radius, y: q.p.y + k * q.n.y * radius }))
  if (strand.closed) {
    // the outer of the two offsets: the one whose points stand further from the middle
    const cx = stops.reduce((s, q) => s + q.p.x, 0) / stops.length
    const cy = stops.reduce((s, q) => s + q.p.y, 0) / stops.length
    const spread = (loop: Vec[]) => loop.reduce((s, q) => s + Math.hypot(q.x - cx, q.y - cy), 0) / loop.length
    const left = side(1)
    const right = side(-1)
    return spread(left) >= spread(right) ? left : right
  }
  const cap = (q: At, from: 1 | -1) => {
    const a = Math.atan2(from * q.n.y, from * q.n.x)
    const turn = from === 1 ? -Math.PI : Math.PI
    return Array.from({ length: 8 }, (_, i) => {
      const th = a + (turn * (i + 1)) / 9
      return { x: q.p.x + radius * Math.cos(th), y: q.p.y + radius * Math.sin(th) }
    })
  }
  const end = stops[stops.length - 1]
  const start = stops[0]
  return [...side(1), ...cap(end, 1), ...side(-1).reverse(), ...cap(start, -1)]
}

/** walk a closed loop at an even step */
export function around(loop: Vec[], count: number): { p: Vec; t: Vec }[] {
  if (loop.length < 2 || count < 1) return []
  const seg: number[] = []
  let total = 0
  for (let i = 0; i < loop.length; i++) {
    const l = dist(loop[i], loop[(i + 1) % loop.length])
    seg.push(l)
    total += l
  }
  const out: { p: Vec; t: Vec }[] = []
  let i = 0
  let base = 0
  for (let k = 0; k < count; k++) {
    const want = (k / count) * total
    while (i < seg.length - 1 && base + seg[i] < want) {
      base += seg[i]
      i++
    }
    const a = loop[i]
    const b = loop[(i + 1) % loop.length]
    const l = seg[i] || 1
    const u = Math.min(1, Math.max(0, (want - base) / l))
    out.push({ p: { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }, t: { x: (b.x - a.x) / l, y: (b.y - a.y) / l } })
  }
  return out
}
