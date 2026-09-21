/**
 * The typefaces of the work.
 *
 * Every glyph reading — ink, seams, parts, and relations between glyphs such
 * as "川 lies inside 州" — is computed from one face, the reading face (Noto
 * Sans JP 500). Those are readings the computer makes of these particular
 * letterforms, not facts about the characters; another font would read
 * differently. So that face is fixed and bundled, never taken from the system.
 *
 * A second face writes the title as writing: the words, the rest of a title
 * beside a figure, the units of a repetition, a line, a field. It is a thin
 * serif (Noto Serif JP 300). Which face a mark takes is decided by what the
 * mark is — a reading of ink, or the title written — never by what the title
 * means (poem/face.ts). Both are SIL Open Font License.
 */

/** Glyphs are drawn in an em square of EM units, then scaled by the figure. */
export const EM = 100

export type Face = 'sans' | 'serif'

export const FACES: Record<Face, { name: string; weight: number }> = {
  sans: { name: 'Noto Sans JP', weight: 500 },
  serif: { name: 'Noto Serif JP', weight: 300 },
}

export const familyOf = (face: Face) => `"${FACES[face].name}"`
/** the CSS / canvas font string for a face at a size in px */
export const fontOf = (face: Face, px: number) => `${FACES[face].weight} ${px}px ${familyOf(face)}`

/** the face every reading is made in */
export const FONT_NAME = FACES.sans.name
export const FONT_FAMILY = familyOf('sans')
export const FONT_WEIGHT = FACES.sans.weight

export const INK = '#000'
export const PAPER = '#fff'
