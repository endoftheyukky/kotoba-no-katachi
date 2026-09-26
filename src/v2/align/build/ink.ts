/**
 * Build time only: what the whole glyph's own ink shows, apart from any
 * component (spec-1 §2.3 CharInk: islands, alike groups, crossings). Read from
 * v1's measure and v1 glyph/parts islands, never from the structure; the
 * Discovery stage sets them beside what the structure says.
 *
 *   islands    v1 glyph/parts: the separate islands of ink (≥ 3% of it), as measured
 *   alike      islands of one shape and size (a unit repeated in the ink: 雨's four dots):
 *              shapes compared on a 16 × 16 grid over each island's box, IoU ≥ ALIKE_SHAPE,
 *              shares within ALIKE_SHARE of the larger; grouped in island order, groups of two or more
 *   crossings  where a long horizontal run of ink and a long vertical run pass straight through
 *              each other (十): both runs at least CROSS_RUN of the ink box, reaching CROSS_ARM of it
 *              on each side; cells within CROSS_JOIN em are one crossing
 */
import type { Rect } from '../../../render/stage'
import type { EmPoint, Island } from '../../types/observation'
import { A } from '../constants'
import { unpack, type Measured } from './raster'

const r2 = (v: number) => Math.round(v * 100) / 100
const r3 = (v: number) => Math.round(v * 1000) / 1000

export interface EntryInk {
  islands: readonly Island[]
  alike: readonly { members: readonly number[]; share: number }[]
  crossings: readonly EmPoint[]
}

function shapeBits(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length * 4)
  for (let i = 0; i < hex.length; i++) {
    const v = parseInt(hex[i], 16)
    for (let b = 0; b < 4; b++) out[i * 4 + b] = (v >> (3 - b)) & 1
  }
  return out
}

function iou(a: Uint8Array, b: Uint8Array): number {
  let I = 0
  let U = 0
  for (let k = 0; k < a.length; k++) {
    if (a[k] && b[k]) I++
    if (a[k] || b[k]) U++
  }
  return U ? I / U : 0
}

export function inkOf(m: Measured): EntryInk {
  const isl = m.islands ?? []
  const islands: Island[] = isl.map((p) => {
    const [x0, y0, x1, y1] = p.box
    const keep: Rect = { x: r2(x0), y: r2(y0), w: r2(x1 - x0), h: r2(y1 - y0) }
    return { keep: [keep], share: r3(p.share), centroid: { x: r2(p.centroid[0]), y: r2(p.centroid[1]) } }
  })
  // alike: the first island of a group stands for its shape and size
  const shapes = isl.map((p) => shapeBits(p.shape))
  const groups: number[][] = []
  isl.forEach((p, i) => {
    const g = groups.find((gr) => {
      const q = isl[gr[0]]
      return iou(shapes[gr[0]], shapes[i]) >= A('ALIKE_SHAPE') && Math.abs(q.share - p.share) <= A('ALIKE_SHARE') * Math.max(q.share, p.share)
    })
    if (g) g.push(i)
    else groups.push([i])
  })
  const alike = groups
    .filter((g) => g.length > 1)
    .map((g) => ({ members: g, share: r3(g.reduce((s, i) => s + isl[i].share, 0) / g.length) }))
  return { islands, alike, crossings: crossingsOf(m) }
}

/** long horizontal and vertical runs of ink passing straight through each other */
function crossingsOf(m: Measured): EmPoint[] {
  if (!m.ink) return []
  const { w, h, left, top, px, bits } = m.ink
  const data = unpack(bits, w * h)
  const on = (a: number, b: number) => a >= 0 && b >= 0 && a < w && b < h && data[b * w + a] === 1
  const run = A('CROSS_RUN')
  const arm = A('CROSS_ARM')
  const cells: [number, number][] = []
  for (let b = 1; b < h - 1; b += 2)
    for (let a = 1; a < w - 1; a += 2) {
      if (!on(a, b)) continue
      let l = 0, r = 0, u = 0, d = 0
      while (on(a - l - 1, b)) l++
      while (on(a + r + 1, b)) r++
      while (on(a, b - u - 1)) u++
      while (on(a, b + d + 1)) d++
      if ((l + r) / w >= run && (u + d) / h >= run && Math.min(l, r) >= arm * w && Math.min(u, d) >= arm * h) cells.push([left + a * px, top + b * px])
    }
  const clusters: { x: number; y: number; n: number }[] = []
  for (const [x, y] of cells) {
    const c = clusters.find((q) => Math.hypot(q.x - x, q.y - y) < A('CROSS_JOIN'))
    if (c) {
      c.n++
      c.x += (x - c.x) / c.n
      c.y += (y - c.y) / c.n
    } else clusters.push({ x, y, n: 1 })
  }
  return clusters.map((c) => ({ x: r2(c.x), y: r2(c.y) }))
}
