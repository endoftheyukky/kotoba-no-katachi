/**
 * Runtime: placements seen through a character (spec-1 §2.2 rule 2, §3
 * groupGeometry). align-1 places 林 in 森 and, in its own entry, 木 in 林; a
 * 木 of 森 is the second placement carried through the first. Pure
 * arithmetic on table rows: no ink is read again.
 *
 *   T(p) = (p.x · sx + dx, p.y · sy + dy)      component em space → whole em space
 *   (outer ∘ inner)(p) = outer(inner(p))
 */
import type { Rect } from '../../render/stage'
import type { AlignRow } from './table'

export interface Transform {
  sx: number
  sy: number
  dx: number
  dy: number
}

export const IDENTITY: Transform = { sx: 1, sy: 1, dx: 0, dy: 0 }

/** the transform that applies inner first, then outer */
export function compose(outer: Transform, inner: Transform): Transform {
  return { sx: outer.sx * inner.sx, sy: outer.sy * inner.sy, dx: outer.sx * inner.dx + outer.dx, dy: outer.sy * inner.dy + outer.dy }
}

export function applyToRect(t: Transform, r: Rect): Rect {
  return { x: r.x * t.sx + t.dx, y: r.y * t.sy + t.dy, w: r.w * t.sx, h: r.h * t.sy }
}

/** a row's box carried into an outer character by the outer's placement of the row's own character */
export function boxThrough(outer: Transform, row: AlignRow): Rect | null {
  return row.box ? applyToRect(outer, row.box) : null
}
