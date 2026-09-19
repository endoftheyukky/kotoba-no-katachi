/**
 * Properties of a letterform, measured from its ink.
 * The poem reads the glyph as a physical shape: where its ink is, how much of
 * it there is, and where it is thinnest (its natural seam — often the joint
 * between 偏 and 旁, or 冠 and 脚).
 *
 * Measured from a canvas rendering for now. An opentype.js outline source can
 * compute the same structure from path geometry later.
 */
import { EM, FONT_FAMILY, FONT_WEIGHT } from './font'

export type Axis = 'x' | 'y'

export interface Seam {
  /** 'x': a vertical cut at x = at (left | right). 'y': a horizontal cut at y = at (top / bottom). */
  axis: Axis
  /** em units, relative to the ink centre */
  at: number
  /** fraction of ink on each side: [left|top, right|bottom] */
  share: [number, number]
}

export interface GlyphMetrics {
  /** pen origin (baseline start) relative to the ink centre, em units */
  pen: { x: number; y: number }
  /** half-size of the ink box, em units */
  half: { w: number; h: number }
  /** ink per em square, 0–1 */
  density: number
  /** ink per horizontal band, top→bottom across the ink box (max = 1) */
  rows: number[]
  /** ink per vertical band, left→right across the ink box (max = 1) */
  cols: number[]
  /** coarse ink map over the ink box: GRID × GRID coverage 0–1, row-major, top→bottom */
  grid: number[][]
  seam: Seam
}

const PX = 200
const BANDS = 40
export const GRID = 24
let canvas: HTMLCanvasElement | null = null

export function measure(char: string): GlyphMetrics {
  const size = PX * 3
  canvas ??= document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.clearRect(0, 0, size, size)
  ctx.font = `${FONT_WEIGHT} ${PX}px ${FONT_FAMILY}`
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#000'
  const ox = PX
  const oy = PX * 2
  ctx.fillText(char, ox, oy)
  const data = ctx.getImageData(0, 0, size, size).data

  let x0 = size, y0 = size, x1 = -1, y1 = -1
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      if (data[(y * size + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }

  const s = EM / PX
  if (x1 < 0) {
    // no ink (unsupported character): an empty em square
    return {
      pen: { x: -EM / 2, y: EM * 0.38 },
      half: { w: EM / 2, h: EM / 2 },
      density: 0,
      rows: new Array(BANDS).fill(0),
      cols: new Array(BANDS).fill(0),
      grid: Array.from({ length: GRID }, () => new Array(GRID).fill(0)),
      seam: { axis: 'x', at: 0, share: [0.5, 0.5] },
    }
  }

  const w = x1 - x0 + 1
  const h = y1 - y0 + 1
  const colSum = new Float64Array(w)
  const rowSum = new Float64Array(h)
  const grid = Array.from({ length: GRID }, () => new Array(GRID).fill(0))
  let total = 0
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const a = data[(y * size + x) * 4 + 3] / 255
      colSum[x - x0] += a
      rowSum[y - y0] += a
      grid[Math.floor(((y - y0) / h) * GRID)][Math.floor(((x - x0) / w) * GRID)] += a
      total += a
    }
  const cellArea = (w / GRID) * (h / GRID)
  for (const row of grid) row.forEach((v, i) => (row[i] = Math.min(1, v / cellArea)))

  const cx = x0 + w / 2
  const cy = y0 + h / 2
  const vx = valley(colSum)
  const vy = valley(rowSum)
  const axis: Axis = vx.score <= vy.score ? 'x' : 'y'
  const v = axis === 'x' ? vx : vy
  const sums = axis === 'x' ? colSum : rowSum
  let first = 0
  for (let i = 0; i < v.index; i++) first += sums[i]
  const at = axis === 'x' ? (x0 + v.index - cx) * s : (y0 + v.index - cy) * s

  return {
    pen: { x: (ox - cx) * s, y: (oy - cy) * s },
    half: { w: (w / 2) * s, h: (h / 2) * s },
    density: total / (PX * PX),
    rows: bands(rowSum),
    cols: bands(colSum),
    grid,
    seam: { axis, at, share: [first / total, 1 - first / total] },
  }
}

/** The thinnest place in the middle of the glyph; score = its ink relative to the average. */
function valley(sums: Float64Array): { index: number; score: number } {
  const n = sums.length
  if (n < 6) return { index: Math.floor(n / 2), score: 1 }
  const lo = Math.floor(n * 0.28)
  const hi = Math.ceil(n * 0.72)
  const r = Math.max(1, Math.round(n * 0.02))
  let mean = 0
  for (let i = lo; i < hi; i++) mean += sums[i]
  mean /= hi - lo
  let best = Infinity
  let index = lo
  for (let i = lo; i < hi; i++) {
    let acc = 0
    let k = 0
    for (let j = Math.max(0, i - r); j <= Math.min(n - 1, i + r); j++, k++) acc += sums[j]
    if (acc / k < best) {
      best = acc / k
      index = i
    }
  }
  return { index, score: best / (mean || 1) }
}

function bands(sums: Float64Array): number[] {
  const out = new Array(BANDS).fill(0)
  for (let i = 0; i < sums.length; i++) out[Math.min(BANDS - 1, Math.floor((i / sums.length) * BANDS))] += sums[i]
  const max = Math.max(...out) || 1
  return out.map((v) => v / max)
}
