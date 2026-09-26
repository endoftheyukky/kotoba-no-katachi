/**
 * Build time only: what is left of the whole's ink once a component is taken
 * away (for an addition, whole − base: 淋 − 林, 州 − 川, 血 − 皿).
 *
 *   linguistic input   a component the structure names, placed by the fit
 *   transformation     the whole's ink cells minus the placed component (grown by one cell, as v1
 *                      relate removes it); the rest cut into 8-connected pieces; pieces smaller than
 *                      SLIVER of the whole are a misfit's slivers and are dropped (v1 relate)
 *   visual output      the pieces: boxes, shares, centroids, the side of the component they lie on,
 *                      and how they lie together (a row, a column, interleaved with the component)
 */
import type { Rect } from '../../../render/stage'
import { A } from '../constants'
import type { Residual, ResidualPiece, Side } from '../table'
import { cellX, CELLS, GRID_N, pieces } from './raster'
import type { Box } from './regions'

const r2 = (v: number) => Math.round(v * 100) / 100
const r3 = (v: number) => Math.round(v * 1000) / 1000
export const rectOf = (b: Box): Rect => ({ x: r2(b.x0), y: r2(b.y0), w: r2(b.x1 - b.x0), h: r2(b.y1 - b.y0) })

function sideOf(c: { x: number; y: number }, base: Box | null): Side {
  if (!base) return 'within'
  if (c.x < base.x0) return 'left'
  if (c.x > base.x1) return 'right'
  if (c.y < base.y0) return 'above'
  if (c.y > base.y1) return 'below'
  return 'within'
}

/**
 * The residual of `whole` once `removed` is taken away, kept to `keep` when given.
 * `base` is the removed component's box (for the side of each piece), `baseInk` its ink (for interleaving).
 */
export function residual(whole: Uint8Array, wholeCells: number, removed: Uint8Array, base: Box | null, baseInk: Uint8Array, keep?: Box): Residual {
  const rest = new Uint8Array(CELLS)
  for (let k = 0; k < CELLS; k++) {
    if (!whole[k] || removed[k]) continue
    if (keep) {
      const x = cellX(k % GRID_N)
      const y = cellX(Math.floor(k / GRID_N))
      if (x < keep.x0 || x > keep.x1 || y < keep.y0 || y > keep.y1) continue
    }
    rest[k] = 1
  }
  const min = Math.max(3, A('SLIVER') * wholeCells)
  const kept = pieces(rest).filter((p) => p.length >= min)
  const boxes: Box[] = []
  const out: ResidualPiece[] = []
  let n = 0
  let sx = 0
  let sy = 0
  for (const cells of kept) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, px = 0, py = 0
    for (const k of cells) {
      const x = cellX(k % GRID_N)
      const y = cellX(Math.floor(k / GRID_N))
      px += x
      py += y
      x0 = Math.min(x0, x - 0.5)
      y0 = Math.min(y0, y - 0.5)
      x1 = Math.max(x1, x + 0.5)
      y1 = Math.max(y1, y + 0.5)
    }
    n += cells.length
    sx += px
    sy += py
    const b = { x0, y0, x1, y1 }
    boxes.push(b)
    const centroid = { x: r2(px / cells.length), y: r2(py / cells.length) }
    out.push({ keep: [rectOf(b)], share: r3(cells.length / wholeCells), centroid, side: sideOf(centroid, base) })
  }
  if (!out.length) return { share: 0, box: null, centroid: null, pieces: [], distribution: 'none', interleaved: false }
  const all = { x0: Math.min(...boxes.map((b) => b.x0)), y0: Math.min(...boxes.map((b) => b.y0)), x1: Math.max(...boxes.map((b) => b.x1)), y1: Math.max(...boxes.map((b) => b.y1)) }
  let distribution: Residual['distribution'] = 'single'
  let interleaved = false
  if (out.length >= 2) {
    const xs = out.map((p) => p.centroid.x)
    const ys = out.map((p) => p.centroid.y)
    const spreadX = Math.max(...xs) - Math.min(...xs)
    const spreadY = Math.max(...ys) - Math.min(...ys)
    distribution = spreadY <= 0.35 * spreadX ? 'row' : spreadX <= 0.35 * spreadY ? 'column' : 'scattered'
    if (distribution === 'row' || distribution === 'column') {
      const ax = distribution === 'row'
      const order = boxes.map((_, i) => i).sort((a, b) => (ax ? boxes[a].x0 - boxes[b].x0 : boxes[a].y0 - boxes[b].y0))
      // between each two neighbouring pieces, some of the component's own ink
      interleaved = order.slice(1).every((j, t) => {
        const a = boxes[order[t]]
        const b = boxes[j]
        const lo = ax ? a.x1 : a.y1
        const hi = ax ? b.x0 : b.y0
        const across0 = ax ? Math.min(a.y0, b.y0) : Math.min(a.x0, b.x0)
        const across1 = ax ? Math.max(a.y1, b.y1) : Math.max(a.x1, b.x1)
        for (let k = 0; k < CELLS; k++) {
          if (!baseInk[k]) continue
          const x = cellX(k % GRID_N)
          const y = cellX(Math.floor(k / GRID_N))
          const along = ax ? x : y
          const across = ax ? y : x
          if (along > lo && along < hi && across >= across0 && across <= across1) return true
        }
        return false
      })
    }
  }
  return {
    share: r3(n / wholeCells),
    box: rectOf(all),
    centroid: { x: r2(sx / n), y: r2(sy / n) },
    pieces: out,
    distribution,
    interleaved,
  }
}
