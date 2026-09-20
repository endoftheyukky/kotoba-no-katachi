/**
 * Measuring a finished page, for the study sheet only — never for drawing.
 *
 * Two numbers say most of what is wrong or right with a page: how large the
 * largest mark is, and how far the figure reaches across the paper. A page
 * lives by one or the other. What kills it is neither: a few small marks
 * gathered in a small part of the page.
 *
 * The exception is the corner poem (cluster), whose whole content is that the
 * title has little structure to show; it is meant to be small.
 */
import { EM } from '../glyph/font'
import { PAGE } from '../render/stage'
import type { Mark, SpatialId } from './types'

export interface Measurement {
  count: number
  /** the longer side of the figure, as a share of the page */
  reach: number
  /** the figure's box, as a share of the page's area */
  area: number
  /** the largest mark's em size, as a share of the page */
  maxEm: number
  /** how much black the page carries, as a share of its area (em boxes, not ink) */
  weight: number
}

/**
 * The figure and the whole page are measured apart. The figure is what the
 * occupancy contract was written for; the page is what a reader sees, and it
 * includes the context — the rest of the title, which the contract does not
 * pay for. Judgements about how the page reads use the total.
 */
export interface Measurements {
  feature: Measurement
  total: Measurement
  context: Measurement | null
}

export function measureAll(marks: Mark[]): Measurements {
  const feature = marks.filter((k) => !k.context)
  const context = marks.filter((k) => k.context)
  return {
    feature: measure(feature.length ? feature : marks),
    total: measure(marks),
    context: context.length ? measure(context) : null,
  }
}

/** the box a mark actually covers: its em square, or what its mask keeps of it */
function drawn(k: Mark): { x: number; y: number; w: number; h: number } {
  const half = k.size / 2
  if (!k.keep?.length) return { x: k.x - half, y: k.y - half, w: k.size, h: k.size }
  const s = k.size / EM
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const r of k.keep) {
    x0 = Math.min(x0, r.x)
    y0 = Math.min(y0, r.y)
    x1 = Math.max(x1, r.x + r.w)
    y1 = Math.max(y1, r.y + r.h)
  }
  const dx = k.shift?.x ?? 0
  const dy = k.shift?.y ?? 0
  return { x: k.x + (x0 + dx) * s, y: k.y + (y0 + dy) * s, w: (x1 - x0) * s, h: (y1 - y0) * s }
}

export function measure(marks: Mark[]): Measurement {
  if (!marks.length) return { count: 0, reach: 0, area: 0, maxEm: 0, weight: 0 }
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  let maxEm = 0
  let weight = 0
  for (const k of marks) {
    // a mark drawn through a mask covers only what is kept: the residue of a
    // subtraction, one part of a glyph. Measuring its em square instead would
    // make a huge glyph of which two dots are inked look like a huge mark.
    const box = drawn(k)
    x0 = Math.min(x0, box.x)
    y0 = Math.min(y0, box.y)
    x1 = Math.max(x1, box.x + box.w)
    y1 = Math.max(y1, box.y + box.h)
    maxEm = Math.max(maxEm, Math.max(box.w, box.h) / PAGE)
    weight += (box.w * box.h) / (PAGE * PAGE)
  }
  const w = (x1 - x0) / PAGE
  const h = (y1 - y0) / PAGE
  return { count: marks.length, reach: Math.max(w, h), area: w * h, maxEm, weight }
}

export interface Verdict {
  dead: boolean
  note: string
}

/** 死域: neither large nor reaching, and not the corner poem */
export function verdict(m: Measurement, space: SpatialId): Verdict {
  if (space === 'cluster')
    return { dead: false, note: '片隅：小さいことが内容なので、死域判定の対象外' }
  if (m.count <= 3 && m.reach < 0.4 && m.maxEm < 0.25)
    return {
      dead: true,
      note: `死域：少数（${m.count}）の小さな字（最大 ${m.maxEm.toFixed(2)}）が紙面の狭い範囲（${m.reach.toFixed(2)}）に集まっている`,
    }
  return {
    dead: false,
    note: m.maxEm >= 0.25 ? '字が紙面を持っている' : '図形が紙面を横切っている',
  }
}
