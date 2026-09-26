/**
 * Build time only: a glyph's ink as the fit reads it.
 *
 * The raster is v1's own (glyph/metrics measure: 200 px per em, ink = alpha
 * above 127), measured in the reading face in headless Chrome. The fit works
 * on a coarser grid of 1 em cells over ±GRID_R em around the ink centre (v1's
 * em space, EM = 100): a cell is ink when at least half of it is.
 */
export const GRID_R = 60
export const GRID_N = 2 * GRID_R
export const CELLS = GRID_N * GRID_N

/** a glyph as measured (tools/v2/align/page.ts), with its v1 ink raster unpacked to one byte per pixel */
export interface Measured {
  c: string
  covered: boolean
  pen?: { x: number; y: number }
  half?: { w: number; h: number }
  ink?: { w: number; h: number; left: number; top: number; px: number; bits: string }
}

export interface Glyph {
  char: string
  half: { w: number; h: number }
  /** GRID_N × GRID_N, row-major, 1 = ink */
  grid: Uint8Array
  /** the ink cells' centres (em, ink centre = origin), row-major order */
  points: Float64Array
  /** a coarser sample of the same (every other cell each way) */
  sparse: Float64Array
  /** coarser still (every fourth cell each way; the sparse sample when that would be too few), for the first look */
  thin: Float64Array
  /** the ink cells each thin point stands for */
  thinWeight: number
  cells: number
}

/** below this many points the thin sample is the sparse one */
const THIN_MIN = 12

export const cellX = (i: number) => -GRID_R + i + 0.5
export const cellOf = (x: number, y: number): number => {
  const i = Math.floor(x + GRID_R)
  const j = Math.floor(y + GRID_R)
  return i >= 0 && j >= 0 && i < GRID_N && j < GRID_N ? j * GRID_N + i : -1
}

export function unpack(bits: string, n: number): Uint8Array {
  const bin = atob(bits)
  const bytes = new Uint8Array(bin.length)
  for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k)
  const out = new Uint8Array(n)
  for (let k = 0; k < n; k++) out[k] = (bytes[k >> 3] >> (7 - (k & 7))) & 1
  return out
}

export function glyphOf(m: Measured): Glyph {
  if (!m.covered || !m.ink || !m.half) throw new Error(`${m.c}: not in the reading face`)
  const { w, h, left, top, px, bits } = m.ink
  const data = unpack(bits, w * h)
  const count = new Float64Array(CELLS)
  for (let b = 0; b < h; b++)
    for (let a = 0; a < w; a++) {
      if (!data[b * w + a]) continue
      const k = cellOf(left + (a + 0.5) * px, top + (b + 0.5) * px)
      if (k >= 0) count[k] += px * px
    }
  const grid = new Uint8Array(CELLS)
  const pts: number[] = []
  const sparse: number[] = []
  const thin: number[] = []
  let cells = 0
  for (let k = 0; k < CELLS; k++) {
    if (count[k] < 0.5) continue
    grid[k] = 1
    cells++
    const i = k % GRID_N
    const j = (k - i) / GRID_N
    pts.push(cellX(i), cellX(j))
    if (i % 2 === 0 && j % 2 === 0) sparse.push(cellX(i), cellX(j))
    if (i % 4 === 0 && j % 4 === 0) thin.push(cellX(i), cellX(j))
  }
  const few = thin.length < 2 * THIN_MIN
  return { char: m.c, half: m.half, grid, points: Float64Array.from(pts), sparse: Float64Array.from(sparse), thin: Float64Array.from(few ? sparse : thin), thinWeight: few ? 4 : 16, cells }
}

/** distance (em, chamfer 3-4 ÷ 3) from each cell to the nearest ink cell */
export function distance(grid: Uint8Array): Float32Array {
  const N = GRID_N
  const d = new Float32Array(CELLS)
  const INF = 1e6
  for (let k = 0; k < CELLS; k++) d[k] = grid[k] ? 0 : INF
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const k = j * N + i
      let v = d[k]
      if (i > 0) v = Math.min(v, d[k - 1] + 3)
      if (j > 0) {
        v = Math.min(v, d[k - N] + 3)
        if (i > 0) v = Math.min(v, d[k - N - 1] + 4)
        if (i < N - 1) v = Math.min(v, d[k - N + 1] + 4)
      }
      d[k] = v
    }
  for (let j = N - 1; j >= 0; j--)
    for (let i = N - 1; i >= 0; i--) {
      const k = j * N + i
      let v = d[k]
      if (i < N - 1) v = Math.min(v, d[k + 1] + 3)
      if (j < N - 1) {
        v = Math.min(v, d[k + N] + 3)
        if (i < N - 1) v = Math.min(v, d[k + N + 1] + 4)
        if (i > 0) v = Math.min(v, d[k + N - 1] + 4)
      }
      d[k] = v
    }
  for (let k = 0; k < CELLS; k++) d[k] /= 3
  return d
}

/** grow a mask by r cells (square neighbourhood) */
export function dilate(g: Uint8Array, r = 1): Uint8Array {
  const N = GRID_N
  const out = new Uint8Array(CELLS)
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      if (!g[j * N + i]) continue
      for (let b = Math.max(0, j - r); b <= Math.min(N - 1, j + r); b++)
        for (let a = Math.max(0, i - r); a <= Math.min(N - 1, i + r); a++) out[b * N + a] = 1
    }
  return out
}

/** the 8-connected pieces of a mask, each a list of cells in scan order; pieces in order of their first cell */
export function pieces(g: Uint8Array): number[][] {
  const N = GRID_N
  const seen = new Uint8Array(CELLS)
  const out: number[][] = []
  for (let k = 0; k < CELLS; k++) {
    if (!g[k] || seen[k]) continue
    const cells: number[] = []
    const stack = [k]
    seen[k] = 1
    while (stack.length) {
      const q = stack.pop()!
      cells.push(q)
      const x = q % N
      const y = (q - x) / N
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          const n = ny * N + nx
          if (nx >= 0 && ny >= 0 && nx < N && ny < N && g[n] && !seen[n]) {
            seen[n] = 1
            stack.push(n)
          }
        }
    }
    cells.sort((a, b) => a - b)
    out.push(cells)
  }
  return out
}
