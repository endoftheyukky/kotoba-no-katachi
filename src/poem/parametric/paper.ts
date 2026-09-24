/**
 * The page itself, as parameters.
 *
 * A figure is not always centred and fitted to the page: a word may stand small
 * in a corner, a character larger than the page and cut by its edge, a page of
 * dust with one character in it. The sizes a character may take:
 *
 *   0.035–0.07 of the page   a title whose relations are weak: small, aside
 *   0.1–0.3                  the ordinary page: relations between equals
 *   0.55–1.1                 only what an operation produced — a residue, the
 *                            parts of a glyph. Above 1 the page cuts it.
 *   the two together         the part large, the title small
 *
 * These are four continuous numbers, and every one of those states is a place
 * in them rather than a kind of page:
 *
 *   occupancy  how much of the page the figure spans. 0.2 is a word in a
 *              corner; 1 fills it; above 1 the page cuts the figure.
 *   offset     how far from the middle it stands, as a share of the room the
 *              page leaves it. At 1 the figure's edge touches the page's.
 *   toward     which way it stands — so the empty page is left on the other side.
 *   hierarchy  how much larger the figure's subject is than the rest of it.
 *
 * What keeps this honest is the invariant, not a margin: a character may be cut
 * by the page but never more than half of it (poem/invariants.ts).
 */
import { PAGE } from '../../render/stage'
import type { Vec } from '../types'

export interface PaperParams {
  /**
   * The size of one character as a share of the page: 0.035–0.07 small and
   * aside, 0.1–0.3 ordinary, 0.55–1.1 what an operation produced. How much
   * of the page the figure takes follows from it and from how long the title
   * is; above a whole page, the edge cuts the character.
   */
  scale: number
  /** how far it stands from the middle: 0 centred, 1 against the page's edge */
  offset: number
  /** the direction it stands in, in radians of page space */
  toward: number
  /** the size of what the page is about, against the rest of the title */
  hierarchy: number
}

export const CENTRED: PaperParams = { scale: 0.2, offset: 0, toward: 0, hierarchy: 1 }

export interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

/**
 * Where a figure of this shape stands on the page, and how large. `box` and
 * `nearest` are in the figure's own units: its bounding box, and the closest
 * two of its marks (so that a mark still has room to be a character).
 */
/** a mark's own middle never leaves the page, so the edge crops a figure, never loses it */
export const INSET = 0.04

export function fit(p: PaperParams, box: Box, nearest: number): { k: number; centre: Vec; span: Vec; occupancy: number } {
  // the scale a character asks for, in the figure's own units (a step of
  // `nearest` carries a character of 0.86 of it)
  const want = (p.scale * PAGE) / (0.86 * Math.max(1e-6, nearest))
  // The page holds what it holds: a figure may be larger than the page — a
  // character cut by its edge — but the places its characters
  // stand must all be on it.
  const reach = Math.max(box.x1 - box.x0, box.y1 - box.y0)
  const most = reach > 0 ? ((1 - 2 * INSET) * PAGE) / reach : Infinity
  const k = Math.min(want, most)
  const span = { x: (box.x1 - box.x0 + nearest) * k, y: (box.y1 - box.y0 + nearest) * k }
  const occupancy = Math.max(span.x, span.y) / PAGE
  // how far the middle of the figure may move: the room the page leaves it, or,
  // where the figure is larger than the page, how far it may be cut on one side
  const room = {
    x: Math.abs(PAGE - span.x) / 2,
    y: Math.abs(PAGE - span.y) / 2,
  }
  const centre = {
    x: PAGE / 2 + Math.cos(p.toward) * p.offset * room.x,
    y: PAGE / 2 + Math.sin(p.toward) * p.offset * room.y,
  }
  return { k, centre, span, occupancy }
}
