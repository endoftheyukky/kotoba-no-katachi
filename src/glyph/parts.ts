/**
 * The computer's reading of a glyph's structure. Two readings:
 *   partition — where the letterform can be cut: repeatedly cut the part
 *               holding the most ink at its thinnest line;
 *   islands   — the separate islands of ink the font draws (connected
 *               components), each kept exactly.
 * A part is a region of the glyph's own em space (one or more rectangles),
 * so a figure can keep it with a clip. Nothing here knows about radicals;
 * it only reads ink.
 */
import type { Rect } from '../render/stage'
import { valley, type Axis, type GlyphMetrics } from './metrics'

export interface GlyphPart {
  /** the region of the glyph kept by this part: em space, ink centre = origin */
  keep: Rect[]
  /** share of the glyph's ink */
  share: number
  /** ink centroid, em space */
  centroid: { x: number; y: number }
  /** the cut that made this part: its axis and how open it was (0 = clean gap, 1 = through solid ink) */
  cut: { axis: Axis; closure: number } | null
}

/** how open the part's separation is: 1 for a separate island or a clean gap, 0 for a cut through solid ink */
export function openness(p: GlyphPart): number {
  return p.cut ? 1 - p.cut.closure : 1
}

/** how a glyph's parts lie: side by side, one above another, or neither */
export type Arrangement = 'row' | 'column' | 'mixed'

export function arrangement(parts: readonly GlyphPart[]): Arrangement {
  if (parts.length < 2) return 'mixed'
  const xs = parts.map((p) => p.centroid.x)
  const ys = parts.map((p) => p.centroid.y)
  const spread = (v: number[]) => Math.max(...v) - Math.min(...v)
  const sx = spread(xs)
  const sy = spread(ys)
  if (sy < sx * 0.25) return 'row'
  if (sx < sy * 0.25) return 'column'
  return 'mixed'
}

interface Region {
  x0: number
  y0: number
  x1: number
  y1: number
  ink: number
  cut: GlyphPart['cut']
}

/**
 * Cut into at most `count` parts. With `maxClosure`, a cut is made only where
 * the letterform is already open (closure ≤ maxClosure): a structural reading
 * that needs no knowledge of the sound. Such a cut is looked for across most
 * of the part (15–85%) and must leave each side at least 6% of the ink.
 */
export function partition(m: GlyphMetrics, count: number, maxClosure = Infinity): GlyphPart[] {
  const structural = Number.isFinite(maxClosure)
  const [from, to] = structural ? [0.15, 0.85] : [0.28, 0.72]
  const { w, h, data, left, top, px } = m.ink
  if (!w || !h) return []
  const at = (x: number, y: number) => data[y * w + x] / 255

  const inkOf = (r: Omit<Region, 'ink' | 'cut'>) => {
    let s = 0
    for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++) s += at(x, y)
    return s
  }
  /** shrink a region to the ink it holds */
  const trim = (r: Omit<Region, 'ink' | 'cut'>, cut: Region['cut']): Region | null => {
    let x0 = r.x1, y0 = r.y1, x1 = r.x0, y1 = r.y0
    for (let y = r.y0; y < r.y1; y++)
      for (let x = r.x0; x < r.x1; x++)
        if (data[y * w + x] > 24) {
          if (x < x0) x0 = x
          if (x >= x1) x1 = x + 1
          if (y < y0) y0 = y
          if (y >= y1) y1 = y + 1
        }
    if (x1 <= x0 || y1 <= y0) return null
    const t = { x0, y0, x1, y1 }
    return { ...t, ink: inkOf(t), cut }
  }

  const total = inkOf({ x0: 0, y0: 0, x1: w, y1: h }) || 1
  let regions: Region[] = [trim({ x0: 0, y0: 0, x1: w, y1: h }, null)!]

  const closed = new Set<Region>() // regions that cannot (or may not) be cut further
  while (regions.length < count) {
    const target = [...regions].filter((r) => !closed.has(r)).sort((a, b) => b.ink - a.ink)[0]
    if (!target) break
    const rw = target.x1 - target.x0
    const rh = target.y1 - target.y0
    if (rw < 8 && rh < 8) {
      closed.add(target)
      continue
    }
    const cols = Array.from({ length: rw }, (_, i) => {
      let s = 0
      for (let y = target.y0; y < target.y1; y++) s += at(target.x0 + i, y)
      return s
    })
    const rows = Array.from({ length: rh }, (_, j) => {
      let s = 0
      for (let x = target.x0; x < target.x1; x++) s += at(x, target.y0 + j)
      return s
    })
    const vx = rw >= 8 ? valley(cols, from, to) : { index: 0, score: Infinity }
    const vy = rh >= 8 ? valley(rows, from, to) : { index: 0, score: Infinity }
    const axis: Axis = vx.score <= vy.score ? 'x' : 'y'
    const v = axis === 'x' ? vx : vy
    const closure = Math.min(1, v.score)
    if (closure > maxClosure) {
      closed.add(target)
      continue
    }
    const split = axis === 'x' ? target.x0 + v.index : target.y0 + v.index
    const a = axis === 'x' ? { ...target, x1: split } : { ...target, y1: split }
    const b = axis === 'x' ? { ...target, x0: split } : { ...target, y0: split }
    const parts = [trim(a, { axis, closure }), trim(b, { axis, closure })].filter((r): r is Region => !!r)
    if (parts.length < 2 || (structural && parts.some((r) => r.ink < total * 0.06))) {
      closed.add(target)
      continue
    }
    regions = regions.filter((r) => r !== target).concat(parts)
  }

  const pad = 0.6 // pixels, so antialiased edges are not shaved
  return regions.map((r) => {
    let sx = 0, sy = 0, s = 0
    for (let y = r.y0; y < r.y1; y++)
      for (let x = r.x0; x < r.x1; x++) {
        const a = at(x, y)
        sx += a * (x + 0.5)
        sy += a * (y + 0.5)
        s += a
      }
    return {
      keep: [
        {
          x: left + (r.x0 - pad) * px,
          y: top + (r.y0 - pad) * px,
          w: (r.x1 - r.x0 + 2 * pad) * px,
          h: (r.y1 - r.y0 + 2 * pad) * px,
        },
      ],
      share: r.ink / total,
      centroid: { x: left + (sx / (s || 1)) * px, y: top + (sy / (s || 1)) * px },
      cut: r.cut,
    }
  })
}

/**
 * The islands of ink, each as a part. Specks under 3% of the ink join the
 * nearest island. Each island is kept by the runs of its own pixels, so the
 * part is exactly that island even where islands interlock.
 */
export function islands(m: GlyphMetrics): GlyphPart[] {
  const { w, h, data, left, top, px } = m.ink
  if (!w || !h) return []
  const label = new Int32Array(w * h).fill(-1)
  const sizes: number[] = []
  const stack: number[] = []
  for (let k = 0; k < w * h; k++) {
    if (data[k] <= 64 || label[k] >= 0) continue
    const id = sizes.length
    let size = 0
    label[k] = id
    stack.push(k)
    while (stack.length) {
      const q = stack.pop()!
      size++
      const x = q % w
      const y = (q - x) / w
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const n = ny * w + nx
          if (label[n] < 0 && data[n] > 64) {
            label[n] = id
            stack.push(n)
          }
        }
    }
    sizes.push(size)
  }
  const total = sizes.reduce((a, b) => a + b, 0) || 1
  const kept = sizes.map((s, i) => (s >= total * 0.03 ? i : -1)).filter((i) => i >= 0)
  if (kept.length < 2) return []

  // centroids, to attach specks to the nearest island
  const cx = new Float64Array(sizes.length)
  const cy = new Float64Array(sizes.length)
  for (let k = 0; k < w * h; k++)
    if (label[k] >= 0) {
      cx[label[k]] += k % w
      cy[label[k]] += Math.floor(k / w)
    }
  for (let i = 0; i < sizes.length; i++) {
    cx[i] /= sizes[i]
    cy[i] /= sizes[i]
  }
  const owner = sizes.map((_, i) =>
    kept.includes(i) ? i : kept.reduce((b, j) => (Math.hypot(cx[j] - cx[i], cy[j] - cy[i]) < Math.hypot(cx[b] - cx[i], cy[b] - cy[i]) ? j : b), kept[0]),
  )

  let totalInk = 0
  for (let k = 0; k < w * h; k++) if (label[k] >= 0) totalInk += data[k] / 255
  const pad = 0.6
  return kept.map((id) => {
    const keep: Rect[] = []
    let ink = 0
    let sx = 0
    let sy = 0
    for (let y = 0; y < h; y++) {
      let x = 0
      while (x < w) {
        const k = y * w + x
        if (label[k] < 0 || owner[label[k]] !== id) {
          x++
          continue
        }
        const x0 = x
        while (x < w && label[y * w + x] >= 0 && owner[label[y * w + x]] === id) {
          const a = data[y * w + x] / 255
          ink += a
          sx += a * (x + 0.5)
          sy += a * (y + 0.5)
          x++
        }
        // rows overlap by half a pixel so the union of runs has no antialiased seams
        const run = { x: left + (x0 - pad) * px, y: top + (y - 0.25) * px, w: (x - x0 + 2 * pad) * px, h: 1.5 * px }
        // merge with the run directly above when it spans the same columns
        const above = keep.find((r) => Math.abs(r.x - run.x) < 1e-6 && Math.abs(r.w - run.w) < 1e-6 && Math.abs(r.y + r.h - run.y - 0.5 * px) < 0.1 * px)
        if (above) above.h += px
        else keep.push(run)
      }
    }
    return {
      keep,
      share: ink / (totalInk || 1),
      centroid: { x: left + (sx / (ink || 1)) * px, y: top + (sy / (ink || 1)) * px },
      cut: null,
    }
  })
}
