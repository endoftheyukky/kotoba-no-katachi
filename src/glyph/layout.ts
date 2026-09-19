/**
 * Glyphs are centred on their ink. Writing still needs a few positional
 * conventions: small kana sit in a corner of their cell, and the long-vowel
 * mark turns with the direction of writing.
 * (With opentype.js these become the font's own 'vert' substitutions.)
 */
import type { Grapheme } from '../language/types'

const TURNS_IN_VERTICAL = new Set(['ー', '〜', '～', '…', '‥', '-', '—'])

export interface CellAdjust {
  /** offsets as a fraction of the glyph size */
  dx: number
  dy: number
  rotate: number
}

export function cellAdjust(g: Grapheme, vertical: boolean): CellAdjust {
  if (vertical && TURNS_IN_VERTICAL.has(g.char)) return { dx: 0, dy: 0, rotate: 90 }
  if (g.small) return vertical ? { dx: 0.14, dy: -0.12, rotate: 0 } : { dx: -0.1, dy: 0.14, rotate: 0 }
  return { dx: 0, dy: 0, rotate: 0 }
}
