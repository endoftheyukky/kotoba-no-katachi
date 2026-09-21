/**
 * Which face a mark is written in.
 *
 *   linguistic input  what the primary operation reads: a relation between
 *                     letterforms (a form inside another, two alike), the
 *                     parts a character comes apart into, the white its
 *                     strokes close in — or the words themselves.
 *   rule              a mark that is a reading of ink is drawn in the face the
 *                     reading was made in; a mark that is the title written as
 *                     writing is drawn in the thin serif.
 *   visual output     the figure a relation between letterforms makes stands
 *                     in the reading face; everything that is writing — words,
 *                     the rest of a title, the units of a repetition, a line, a
 *                     field — is a thin serif around it.
 *
 * The face says what a mark is, never what the title means. It is not chosen
 * per title and it is not random.
 *
 * Which marks are readings of ink:
 *   - anything cut, cropped or subtracted: a residue, a fragment, a part;
 *   - a term of a relation between letterforms, written whole (川 beside the
 *     residue of 州 is compared with it as ink, and so is 大 with 犬);
 *   - a character whose closed white is what the poem uses.
 * A character that falls into parts is not itself a reading: the parts are.
 * Context — the rest of the title around a figure — is always writing.
 *
 * v2: a mark the title does not itself write (a grain, an echo, a satellite)
 * is writing too — down to the micro band. Below it the writing face's thin
 * strokes (a thirtieth of the em and less) fall under a pixel of the page as
 * it is exported, and a grain in it is no longer a character but a smudge; a
 * derived mark that small is written in the reading face, whose strokes stay
 * whole. The line is the band's, not a title's.
 */
import { covers } from '../glyph/coverage'
import type { Face } from '../glyph/font'
import { PAGE } from '../render/stage'
import { BANDS } from './contract'
import type { Analysis, Mark, Material } from './types'

/** derived marks below this size (page units) are written in the reading face */
export const SMALLEST_WRITING = BANDS.micro[0] * PAGE

export function faceOf(a: Analysis, m: Material, k: Mark): Face {
  if (k.derived) return k.size < SMALLEST_WRITING ? 'sans' : 'serif'
  if (k.minus || k.keep || k.shift) return 'sans'
  if (k.context) return 'serif'
  const f = m.primary.focus
  if (f.kind === 'pair') return k.char === f.relation.inner || k.char === f.relation.outer ? 'sans' : 'serif'
  if (f.kind === 'counter') return k.char === a.graphemes[f.grapheme]?.char ? 'sans' : 'serif'
  return 'serif'
}

/** whether the second face can write this character at all (its own glyph, never a fallback) */
function writable(a: Analysis, char: string): boolean {
  if (!covers('serif', char)) return false
  try {
    return a.glyphs.get(char, 'serif').metrics.density > 0 || a.glyphs.get(char).metrics.density === 0
  } catch {
    return false
  }
}

/** the page, with each mark's face set; sans is left implicit */
export function withFaces(a: Analysis, m: Material, marks: Mark[]): Mark[] {
  return marks.map((k) => {
    // a character the serif does not have is written in the face that does
    const face = faceOf(a, m, k) === 'serif' && writable(a, k.char) ? 'serif' : 'sans'
    return face === 'sans' ? k : { ...k, face }
  })
}
