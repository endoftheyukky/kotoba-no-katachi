/**
 * What every spatial composition shares: how a unit becomes marks, how a
 * word is written along a line, and a few plastic (造形) helpers. The helpers
 * only choose within ranges; the decision to place something at the edge, in
 * the centre, apart or together belongs to each composition's rules.
 */
import type { Rng } from '../../core/random'
import { EM } from '../../glyph/font'
import { cellAdjust } from '../../glyph/layout'
import { openness, type GlyphPart } from '../../glyph/parts'
import { PAGE } from '../../render/stage'
import type { Analysis, Mark, Material, Unit, Vec } from '../types'

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
  const adj = cellAdjust(a.graphemes[u.grapheme], a.direction === 'vertical')
  const base: Mark = {
    char: u.char,
    x: at.x + adj.dx * size,
    y: at.y + adj.dy * size,
    size,
    rotate: adj.rotate || undefined,
    minus: u.minus,
  }
  if (!u.parts) return [base]
  // decomposition as a modifier: the parts open a little, as far as their seams were open
  return u.parts.map((p, i) => ({ ...base, keep: p.keep, shift: partShift(p, i, spread) }))
}

/** Units written one after another from `start` (centre of the first cell). */
export function lineMarks(a: Analysis, units: Unit[], start: Vec, size: number, pitch = size): Mark[] {
  const { along } = directions(a)
  return units.flatMap((u, i) => unitMarks(a, u, { x: start.x + along.x * i * pitch, y: start.y + along.y * i * pitch }, size))
}

/** Units written so that the whole line is centred on `centre`. */
export function centredLine(a: Analysis, units: Unit[], centre: Vec, size: number, pitch = size): Mark[] {
  const { along } = directions(a)
  const half = ((units.length - 1) * pitch) / 2
  return lineMarks(a, units, { x: centre.x - along.x * half, y: centre.y - along.y * half }, size, pitch)
}

/** 造形: a coordinate in one of the outer thirds of the page — never the middle. */
export function offCentre(rng: Rng, low = 0.18, high = 0.36): number {
  return (rng.next() < 0.5 ? rng.range(low, high) : rng.range(1 - high, 1 - low)) * PAGE
}

export function glyphCount(units: Unit[]): number {
  return Math.max(1, units.length)
}
