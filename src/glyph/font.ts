/**
 * The one typeface of the work.
 *
 * Every glyph reading — ink, seams, parts, and relations between glyphs such
 * as "川 lies inside 州" — is computed from this font. Those are readings the
 * computer makes of these particular letterforms, not facts about the
 * characters; another font would read differently. So the font is fixed and
 * bundled (Noto Sans JP, SIL Open Font License), never taken from the system.
 */

/** Glyphs are drawn in an em square of EM units, then scaled by the figure. */
export const EM = 100

export const FONT_NAME = 'Noto Sans JP'
export const FONT_FAMILY = `"${FONT_NAME}"`
export const FONT_WEIGHT = 500

export const INK = '#000'
export const PAPER = '#fff'
