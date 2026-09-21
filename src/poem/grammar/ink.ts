/**
 * Measurements of a glyph's ink that a form drawn in small marks needs (v2):
 * how wide its strokes are, where, and how far a point lies from its edge.
 * Read from the same ink raster the rest of the work measures
 * (glyph/metrics.ts), with a chamfer distance transform — nothing about what
 * the glyph means.
 */
import type { InkRaster } from '../../glyph/metrics'
import type { Vec } from '../types'

const ON = 96

export interface InkDistance {
  ink: InkRaster
  /** for an ink pixel: distance to the nearest white, in em units; 0 on white */
  inside: Float32Array
  /** for a white pixel: distance to the nearest ink, in em units; 0 on ink */
  outside: Float32Array
}

const cache = new WeakMap<InkRaster, InkDistance>()

/** two-pass 3-4 chamfer distance to the nearest pixel where `target` holds */
function chamfer(w: number, h: number, target: (i: number) => boolean): Float32Array {
  const INF = 1e9
  const d = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) d[i] = target(i) ? 0 : INF
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? INF : d[y * w + x])
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (!d[i]) continue
      d[i] = Math.min(d[i], at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4)
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x
      if (!d[i]) continue
      d[i] = Math.min(d[i], at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4)
    }
  for (let i = 0; i < w * h; i++) d[i] /= 3
  return d
}

export function distances(ink: InkRaster): InkDistance {
  let d = cache.get(ink)
  if (!d) {
    const on = (i: number) => ink.data[i] > ON
    // outside the raster is white: a stroke touching its edge is still that wide
    const inside = chamfer(ink.w, ink.h, (i) => !on(i))
    const outside = chamfer(ink.w, ink.h, on)
    for (let i = 0; i < inside.length; i++) {
      const x = i % ink.w
      const y = Math.floor(i / ink.w)
      inside[i] = Math.min(inside[i], x + 1, y + 1, ink.w - x, ink.h - y) * ink.px
      outside[i] *= ink.px
    }
    d = { ink, inside, outside }
    cache.set(ink, d)
  }
  return d
}

const index = (ink: InkRaster, e: Vec) => {
  const i = Math.floor((e.x - ink.left) / ink.px)
  const j = Math.floor((e.y - ink.top) / ink.px)
  return i >= 0 && j >= 0 && i < ink.w && j < ink.h ? j * ink.w + i : -1
}

/** the widest stroke within a square of half-side `r` about a point (em units): 0 where there is no ink */
export function widthNear(d: InkDistance, e: Vec, r: number): number {
  const { ink } = d
  const n = Math.max(1, Math.round(r / ink.px))
  const i0 = Math.floor((e.x - ink.left) / ink.px)
  const j0 = Math.floor((e.y - ink.top) / ink.px)
  let best = 0
  for (let j = j0 - n; j <= j0 + n; j++)
    for (let i = i0 - n; i <= i0 + n; i++) {
      if (i < 0 || j < 0 || i >= ink.w || j >= ink.h) continue
      best = Math.max(best, d.inside[j * ink.w + i])
    }
  return best * 2
}

/** share of a square of half-side `r` about a point that is ink */
export function coverNear(d: InkDistance, e: Vec, r: number): number {
  const { ink } = d
  let on = 0
  const n = 4
  for (let v = 0; v <= n; v++)
    for (let u = 0; u <= n; u++) {
      const k = index(ink, { x: e.x - r + (2 * r * u) / n, y: e.y - r + (2 * r * v) / n })
      if (k >= 0 && ink.data[k] > ON) on++
    }
  return on / ((n + 1) * (n + 1))
}

/** distance from a point to the nearest ink, in em units (a point off the raster: to its edge, at least) */
export function edgeDistance(d: InkDistance, e: Vec): number {
  const { ink } = d
  const k = index(ink, e)
  if (k >= 0) return d.outside[k]
  const dx = Math.max(ink.left - e.x, 0, e.x - (ink.left + ink.w * ink.px))
  const dy = Math.max(ink.top - e.y, 0, e.y - (ink.top + ink.h * ink.px))
  return Math.hypot(dx, dy)
}

/**
 * How the widths of a glyph's strokes vary: the widths along the middle of
 * its strokes (pixels no shallower than any neighbour), as a mean and a
 * coefficient of variation. An even face (the reading face) varies little;
 * a face with thick verticals and thin horizontals (the writing face) a lot.
 */
export function strokeWidths(ink: InkRaster): { mean: number; cv: number } {
  const d = distances(ink)
  const { w, h } = ink
  const ws: number[] = []
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const v = d.inside[i]
      if (!v) continue
      // the middle of a stroke: no neighbour lies deeper in the ink
      let ridge = true
      for (const o of [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1]) if (d.inside[i + o] > v) ridge = false
      if (ridge) ws.push(v * 2)
    }
  if (!ws.length) return { mean: 0, cv: 0 }
  const mean = ws.reduce((s, v) => s + v, 0) / ws.length
  const sd = Math.sqrt(ws.reduce((s, v) => s + (v - mean) ** 2, 0) / ws.length)
  return { mean, cv: sd / mean }
}
