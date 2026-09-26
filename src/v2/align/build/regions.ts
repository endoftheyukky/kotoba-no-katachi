/**
 * Build time only: the structure operator as a limit on where a component may
 * be looked for (spec-1 §2.1: the structure says what exists; the ink is
 * searched only where the structure puts it).
 *
 *   linguistic input   the IDS operator of a node and a child's position under it
 *   transformation     a region of the parent's box, anchors to its edges, a minimum span for a wrapper
 *   visual output      the rectangle the child's box must lie in (recorded in each row as `region`)
 */
import type { IdsOperator } from '../../types/structure'
import { A } from '../constants'
import type { RegionName } from '../table'

export interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

export type { RegionName }

export type Edge = 'x0' | 'x1' | 'y0' | 'y1'

/** a child's place under its operator */
export interface Region {
  name: RegionName
  /** the child's box must lie within this */
  within: Box
  /** edges of the parent the child's box must reach (within ANCHOR of the parent's side) */
  anchors: readonly Edge[]
  /** a wrapper that is one glyph spans at least this share of the parent, per axis */
  minSpan?: { w: number; h: number }
}

const NAMES: Record<IdsOperator, readonly RegionName[]> = {
  '⿰': ['left', 'right'],
  '⿲': ['left', 'middle', 'right'],
  '⿱': ['top', 'bottom'],
  '⿳': ['top', 'middle', 'bottom'],
  '⿴': ['surround', 'inside'],
  '⿵': ['surround-open-below', 'inside-below'],
  '⿶': ['surround-open-above', 'inside-above'],
  '⿷': ['surround-open-right', 'inside-right'],
  '⿸': ['wrap-upper-left', 'inside-lower-right'],
  '⿹': ['wrap-upper-right', 'inside-lower-left'],
  '⿺': ['wrap-lower-left', 'inside-upper-right'],
  '⿻': ['overlay', 'overlay'],
}

export const regionName = (op: IdsOperator, i: number): RegionName => NAMES[op][i]

/** what the operator asks of its children beside their regions */
export type SiblingRule = { kind: 'order'; axis: 'x' | 'y' } | { kind: 'inside' } | { kind: 'overlay' }

export function siblingRule(op: IdsOperator): SiblingRule {
  if (op === '⿰' || op === '⿲') return { kind: 'order', axis: 'x' }
  if (op === '⿱' || op === '⿳') return { kind: 'order', axis: 'y' }
  if (op === '⿻') return { kind: 'overlay' }
  return { kind: 'inside' }
}

/** the operators whose children share the parent between them along one axis */
export const splitAxis = (op: IdsOperator): 'x' | 'y' | null => (op === '⿰' || op === '⿲' ? 'x' : op === '⿱' || op === '⿳' ? 'y' : null)

/**
 * where a split may fall, as shares of the parent along its axis (one list per child boundary).
 * The character's own split is tried finely; a split inside a component, whose region is already
 * cut to it, more coarsely (every level multiplies the fits to try).
 */
export function splits(n: number, depth: number): number[][] {
  const at = depth === 0 ? A('SPLITS') : depth === 1 ? A('SPLITS_NESTED') : A('SPLITS_DEEP')
  if (n === 2) return at.map((t) => [t])
  const out: number[][] = []
  for (const a of at) for (const b of at) if (b - a >= A('SPLIT_MIN_PART')) out.push([a, b])
  return out
}

/**
 * The regions of an operator's children inside the parent's region p. A split operator
 * (⿰ ⿲ ⿱ ⿳) cuts p at the given shares: each child's region is its part, widened by
 * SPLIT_MARGIN across each cut (neighbours may overhang a little) and by SLACK outside p.
 * A stroke may cross the cut further (SPLIT_MARGIN_STROKE): strokes split by an IDS meet
 * where they join (厂 = ⿱一丿: the 丿 starts at the end of the 一).
 */
export function regions(op: IdsOperator, n: number, p: Box, cuts: readonly number[] = [], strokes: readonly boolean[] = [], atRoot = true): Region[] {
  const rs = layout(op, n, p, cuts, strokes)
  // anchors hold against the whole's own ink box; a component's region is only a loose slot for it
  return atRoot ? rs : rs.map((r) => ({ ...r, anchors: [] }))
}

function layout(op: IdsOperator, n: number, p: Box, cuts: readonly number[], strokes: readonly boolean[]): Region[] {
  const W = p.x1 - p.x0
  const H = p.y1 - p.y0
  const s = A('SLACK')
  const all: Box = { x0: p.x0 - s * W, y0: p.y0 - s * H, x1: p.x1 + s * W, y1: p.y1 + s * H }
  const names = NAMES[op]
  const axis = splitAxis(op)
  if (axis) {
    if (cuts.length !== n - 1) throw new Error(`${op}: ${n - 1} cuts wanted`)
    const margin = (i: number) => (strokes[i] ? A('SPLIT_MARGIN_STROKE') : A('SPLIT_MARGIN'))
    const bounds = [-s, ...cuts, 1 + s]
    return Array.from({ length: n }, (_, i) => {
      const lo = i === 0 ? bounds[0] : bounds[i] - margin(i)
      const hi = i === n - 1 ? bounds[n] : bounds[i + 1] + margin(i)
      const within = axis === 'x' ? { ...all, x0: p.x0 + lo * W, x1: p.x0 + hi * W } : { ...all, y0: p.y0 + lo * H, y1: p.y0 + hi * H }
      const anchors: Edge[] = []
      if (i === 0) anchors.push(axis === 'x' ? 'x0' : 'y0')
      if (i === n - 1) anchors.push(axis === 'x' ? 'x1' : 'y1')
      return { name: names[i], within, anchors }
    })
  }
  if (op === '⿻') return [0, 1].map(() => ({ name: 'overlay' as const, within: all, anchors: [] }))
  const inset = A('INSET')
  const from = A('INNER_FROM')
  const span = A('WRAPPER_MIN')
  const inner: Box = { x0: p.x0 + inset * W, y0: p.y0 + inset * H, x1: p.x1 - inset * W, y1: p.y1 - inset * H }
  const wrap = (anchors: Edge[]): Region => ({ name: names[0], within: all, anchors, minSpan: { w: span, h: span } })
  const inside = (b: Box): Region => ({ name: names[1], within: b, anchors: [] })
  switch (op) {
    case '⿴':
      return [wrap(['x0', 'x1', 'y0', 'y1']), inside(inner)]
    case '⿵':
      return [wrap(['x0', 'x1', 'y0']), inside({ ...inner, y0: p.y0 + from * H, y1: all.y1 })]
    case '⿶':
      return [wrap(['x0', 'x1', 'y1']), inside({ ...inner, y0: all.y0, y1: p.y1 - from * H })]
    case '⿷':
      return [wrap(['x0', 'y0', 'y1']), inside({ ...inner, x0: p.x0 + from * W, x1: all.x1 })]
    case '⿸':
      return [wrap(['x0', 'y0']), inside({ x0: p.x0 + from * W, y0: p.y0 + from * H, x1: all.x1, y1: all.y1 })]
    case '⿹':
      return [wrap(['x1', 'y0']), inside({ x0: all.x0, y0: p.y0 + from * H, x1: p.x1 - from * W, y1: all.y1 })]
    case '⿺':
      return [wrap(['x0', 'y1']), inside({ x0: p.x0 + from * W, y0: all.y0, x1: all.x1, y1: p.y1 - from * H })]
  }
  throw new Error(`no regions for ${op}`)
}

/** does a box keep its region: inside it, its anchors, its span (p: the parent's region; a subtree: its anchors only) */
export function keeps(r: Region, b: Box, p: Box, leaf: boolean): boolean {
  const W = p.x1 - p.x0
  const H = p.y1 - p.y0
  const a = A('ANCHOR')
  for (const e of r.anchors) {
    if (e === 'x0' && b.x0 > p.x0 + a * W) return false
    if (e === 'x1' && b.x1 < p.x1 - a * W) return false
    if (e === 'y0' && b.y0 > p.y0 + a * H) return false
    if (e === 'y1' && b.y1 < p.y1 - a * H) return false
  }
  if (leaf && r.minSpan && (b.x1 - b.x0 < r.minSpan.w * W || b.y1 - b.y0 < r.minSpan.h * H)) return false
  // a subtree's box is the union of its parts, each already held to its own region (which may
  // overhang this one by SLACK): only its anchors are asked of it here
  if (!leaf) return true
  return b.x0 >= r.within.x0 - 1e-9 && b.x1 <= r.within.x1 + 1e-9 && b.y0 >= r.within.y0 - 1e-9 && b.y1 <= r.within.y1 + 1e-9
}
