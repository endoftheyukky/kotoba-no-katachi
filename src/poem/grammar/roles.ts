/**
 * The page's hierarchy of marks (v2), as sizes and numbers.
 *
 * A grammar that adds marks says what each one is, and its role — not the
 * grammar — decides how large it may be and how many of it there may be:
 *
 *   nucleus    the composition's own size: few, and the strongest mark
 *   body       the composition's own size
 *   satellite  the top of the micro band: few, placed one by one
 *   grain      the bottom of the micro band, down to where a character stops
 *              being one: many, placed by a lattice or a line
 *   trace      from the size of what it follows down to the smallest grain:
 *              it decays
 *   auxiliary  a little under a satellite, and at most a few on a page: what
 *              comes from outside the writing stays quieter than what the
 *              writing itself gives
 *
 * Share of the page. The derived marks never reach the small band: they are
 * never read as the title.
 */
import { BANDS } from '../contract'
import type { MarkRole } from '../types'

/** the smallest a derived mark is written: below the micro band it stops being a character */
export const GRAIN_MIN = BANDS.micro[0] * 0.8

export interface RoleScale {
  /** size range, share of the page */
  size: [number, number]
  /** how many a page may hold (∞ where a lattice or a line decides) */
  most: number
}

export const ROLE: Record<Exclude<MarkRole, 'nucleus' | 'body' | 'context'>, RoleScale> = {
  satellite: { size: [BANDS.micro[0] * 1.15, BANDS.micro[1]], most: 24 },
  grain: { size: [GRAIN_MIN, BANDS.micro[0]], most: Infinity },
  trace: { size: [GRAIN_MIN, BANDS.micro[1]], most: Infinity },
  auxiliary: { size: [BANDS.micro[0], BANDS.micro[0] * 1.25], most: 9 },
}

/** the size of a mark of this role at a place 0–1 in its range (plastic), in page units of `page` */
export function roleSize(role: keyof typeof ROLE, at: number, page: number): number {
  const [lo, hi] = ROLE[role].size
  return (lo + (hi - lo) * Math.min(1, Math.max(0, at))) * page
}
