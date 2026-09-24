/**
 * The inside of one letterform, read as a physical structure and nothing
 * more. No meaning is taken from a shape here: a round form is not soft, a
 * heavy right side is not unstable. Only what is measurably there and can be
 * carried over to the page as it is.
 *
 *   counter   white the strokes close in — not the gaps between them.
 *             口 holds 47% of its box as enclosed white, 日 two of 20% each,
 *             田 four of 10%. あ holds 4%: that is a gap, not a counter.
 *   echoForm  the same form returning inside one character: 品 three 口,
 *             羽 two halves, 川 three strokes. 嘘's four islands are only
 *             0.40 alike — four different things, not a repetition.
 *
 * Left-right symmetry is measured but is never a candidate: twelve of
 * nineteen characters sampled score above 0.9, so it distinguishes nothing.
 * Where two halves are both separable and alike, that is already an echoForm.
 *
 * Thresholds are heuristics chosen to keep coincidences out.
 */
import { EM } from './font'
import type { GlyphMetrics } from './metrics'
import { islands, type GlyphPart } from './parts'
import type { Rect } from '../render/stage'

/** a white must hold this much of the ink box to be a counter and not a gap */
export const COUNTER_MIN = 0.08
/** members of an echo must be at least this alike, and this much of the ink */
export const ECHO_MIN = 0.8
export const ECHO_MEMBER_MIN = 0.12

const ON = 60

export interface Counter {
  /** area as a share of the ink box */
  area: number
  /** em space, ink centre = origin */
  box: Rect
  centre: { x: number; y: number }
  /** this white wraps around another white (回) */
  encloses: boolean
}

export type CounterArrangement = 'single' | 'stacked' | 'beside' | 'grid' | 'nested'

export interface Interior {
  counters: Counter[]
  arrangement: CounterArrangement
  /** how alike the counters are in area, 0–1 */
  even: number
  echo: { members: GlyphPart[]; similarity: number } | null
  /** measured only, never a candidate */
  symmetry: { x: number; y: number; r: number }
}

/** white the outside cannot reach */
export function counters(m: GlyphMetrics): Counter[] {
  const { w, h, data, left, top, px } = m.ink
  const ink = (x: number, y: number) => data[y * w + x] > ON
  const outside = new Uint8Array(w * h)
  const stack: number[] = []
  for (let x = 0; x < w; x++) stack.push(x, 0, x, h - 1)
  for (let y = 0; y < h; y++) stack.push(0, y, w - 1, y)
  while (stack.length) {
    const y = stack.pop()!
    const x = stack.pop()!
    if (x < 0 || y < 0 || x >= w || y >= h) continue
    const i = y * w + x
    if (outside[i] || ink(x, y)) continue
    outside[i] = 1
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1)
  }

  const seen = new Uint8Array(w * h)
  const out: Counter[] = []
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (outside[i] || seen[i] || ink(x, y)) continue
      let n = 0
      let x0 = x
      let x1 = x
      let y0 = y
      let y1 = y
      const q = [x, y]
      seen[i] = 1
      while (q.length) {
        const cy = q.pop()!
        const cx = q.pop()!
        n++
        x0 = Math.min(x0, cx)
        x1 = Math.max(x1, cx)
        y0 = Math.min(y0, cy)
        y1 = Math.max(y1, cy)
        const near = [cx + 1, cy, cx - 1, cy, cx, cy + 1, cx, cy - 1]
        for (let k = 0; k < near.length; k += 2) {
          const nx = near[k]
          const ny = near[k + 1]
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const j = ny * w + nx
          if (seen[j] || outside[j] || ink(nx, ny)) continue
          seen[j] = 1
          q.push(nx, ny)
        }
      }
      const area = n / (w * h)
      if (area < COUNTER_MIN) continue
      const box: Rect = { x: left + x0 * px, y: top + y0 * px, w: (x1 - x0 + 1) * px, h: (y1 - y0 + 1) * px }
      out.push({ area, box, centre: { x: box.x + box.w / 2, y: box.y + box.h / 2 }, encloses: false })
    }
  // a white that wraps another: 回
  for (const c of out)
    c.encloses = out.some(
      (o) =>
        o !== c &&
        o.centre.x > c.box.x &&
        o.centre.x < c.box.x + c.box.w &&
        o.centre.y > c.box.y &&
        o.centre.y < c.box.y + c.box.h,
    )
  return out.sort((a, b) => b.area - a.area)
}

function arrangementOf(cs: Counter[]): CounterArrangement {
  if (cs.some((c) => c.encloses)) return 'nested'
  if (cs.length <= 1) return 'single'
  const xs = cs.map((c) => c.centre.x)
  const ys = cs.map((c) => c.centre.y)
  const spread = (v: number[]) => Math.max(...v) - Math.min(...v)
  const dx = spread(xs)
  const dy = spread(ys)
  if (cs.length >= 4 && dx > EM * 0.15 && dy > EM * 0.15) return 'grid'
  return dy >= dx ? 'stacked' : 'beside'
}

/** a part, normalised to a small square grid: the same reading legibility uses */
function normalise(m: GlyphMetrics, p: GlyphPart, n = 16): Float32Array {
  const { w, h, data, left, top, px } = m.ink
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const r of p.keep) {
    x0 = Math.min(x0, r.x)
    y0 = Math.min(y0, r.y)
    x1 = Math.max(x1, r.x + r.w)
    y1 = Math.max(y1, r.y + r.h)
  }
  const px0 = Math.round((x0 - left) / px)
  const py0 = Math.round((y0 - top) / px)
  const pw = Math.max(1, Math.round((x1 - x0) / px))
  const ph = Math.max(1, Math.round((y1 - y0) / px))
  const g = new Float32Array(n * n)
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const sx = px0 + Math.floor((x * pw) / n)
      const sy = py0 + Math.floor((y * ph) / n)
      if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue
      g[y * n + x] = data[sy * w + sx] > ON ? 1 : 0
    }
  return g
}

function iou(a: Float32Array, b: Float32Array): number {
  let inter = 0
  let union = 0
  for (let i = 0; i < a.length; i++) {
    inter += Math.min(a[i], b[i])
    union += Math.max(a[i], b[i])
  }
  return union ? inter / union : 0
}

/** the largest group of islands that are all alike */
export function echoForm(m: GlyphMetrics): { members: GlyphPart[]; similarity: number } | null {
  const parts = islands(m).filter((p) => p.share >= ECHO_MEMBER_MIN)
  if (parts.length < 2) return null
  const grids = parts.map((p) => normalise(m, p))
  let best: { members: GlyphPart[]; similarity: number } | null = null
  for (let i = 0; i < parts.length; i++) {
    const group = [i]
    let worst = 1
    for (let j = 0; j < parts.length; j++) {
      if (j === i) continue
      const s = Math.min(...group.map((k) => iou(grids[k], grids[j])))
      if (s >= ECHO_MIN) {
        group.push(j)
        worst = Math.min(worst, s)
      }
    }
    if (group.length >= 2 && (!best || group.length > best.members.length))
      best = { members: group.map((k) => parts[k]), similarity: worst }
  }
  return best
}

function symmetry(m: GlyphMetrics): { x: number; y: number; r: number } {
  const { w, h, data } = m.ink
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : data[y * w + x])
  let total = 0
  let sx = 0
  let sy = 0
  let sr = 0
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = at(x, y)
      total += v
      sx += Math.min(v, at(w - 1 - x, y))
      sy += Math.min(v, at(x, h - 1 - y))
      sr += Math.min(v, at(w - 1 - x, h - 1 - y))
    }
  return total ? { x: sx / total, y: sy / total, r: sr / total } : { x: 0, y: 0, r: 0 }
}

export function readInterior(m: GlyphMetrics): Interior {
  const cs = counters(m)
  const areas = cs.map((c) => c.area)
  const even = areas.length > 1 ? Math.min(...areas) / Math.max(...areas) : 0
  return { counters: cs, arrangement: arrangementOf(cs), even, echo: echoForm(m), symmetry: symmetry(m) }
}
