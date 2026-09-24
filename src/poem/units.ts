/**
 * How a unit of the Material becomes marks: whether it is written at all, the
 * direction a line is written in, and one unit's marks at a point, with its
 * cell adjustment and, when it arrives in parts, its parts opened a little.
 */
import { EM } from '../glyph/font'
import { cellAdjust } from '../glyph/layout'
import { openness, type GlyphPart } from '../glyph/parts'
import type { Analysis, Mark, Material, Unit, Vec } from './types'

export const isWritten = (u: Unit) => !u.absent && !!u.char.trim()

export const allUnits = (m: Material): Unit[] => m.tokens.flat()

/** the direction a line is written in, and the direction the next line goes */
export function directions(a: Analysis): { along: Vec; across: Vec; vertical: boolean } {
  const vertical = a.direction === 'vertical'
  return vertical
    ? { along: { x: 0, y: 1 }, across: { x: -1, y: 0 }, vertical }
    : { along: { x: 1, y: 0 }, across: { x: 0, y: 1 }, vertical }
}

function partShift(p: GlyphPart, index: number, amount: number): Vec {
  const c = p.centroid
  const len = Math.hypot(c.x, c.y)
  const dir = len > 1 ? { x: c.x / len, y: c.y / len } : { x: index % 2 ? 1 : -1, y: 0 }
  const d = EM * (0.04 + 0.2 * openness(p)) * amount
  return { x: dir.x * d, y: dir.y * d }
}

/** One unit at (x, y), em size `size`. Absent units leave nothing. */
export function unitMarks(a: Analysis, u: Unit, at: Vec, size: number, spread = 1): Mark[] {
  if (!isWritten(u)) return []
  // a unit the title never wrote (a glyph read inside another) has no cell of its own
  const g = a.graphemes[u.grapheme]
  const adj = g ? cellAdjust(g, a.direction === 'vertical') : { dx: 0, dy: 0, rotate: 0 }
  const base: Mark = {
    char: u.char,
    ...(u.grapheme >= 0 ? { grapheme: u.grapheme } : {}),
    x: at.x + adj.dx * size,
    y: at.y + adj.dy * size,
    size,
    rotate: adj.rotate || undefined,
    minus: u.minus,
    // what remains of a subtraction is drawn only where it has form
    keep: u.minus?.keep,
  }
  if (!u.parts) return [base]
  // decomposition as a modifier: the parts open a little, as far as their seams were open
  return u.parts.map((p, i) => ({ ...base, keep: p.keep, shift: partShift(p, i, spread) }))
}
