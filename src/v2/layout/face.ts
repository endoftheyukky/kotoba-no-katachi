/**
 * Which face a v2 mark is written in (after Stage 11: the Safe Hybrid, SwoN's decision of 2026-09-26 on the
 * visual study; spec-1 §9.4 and TODO-8's face contrast, see docs/v2-decisions.md). v1's principle
 * (poem/face.ts), read by the layer a mark belongs to in the page, never by the title:
 *
 *   linguistic input  what the mark is on the page: the title written as words to be read (a Sequence's flow,
 *                     the rest of a longer title, the words of an Absent page, a context line) or a reading of
 *                     ink (a figure's character, a unit of a field or of a whole, a container, a part, a
 *                     repeat, anything cut)
 *   rule              a line of words is written in the writing face (Noto Serif JP 300); everything the plan's
 *                     geometry stands on — every position, size and cut read in the reading face (align-1,
 *                     structure-1) — stays in the reading face (Noto Sans JP 500). A word stays in the reading
 *                     face where the writing face has no glyph of its own for it, or where it is smaller than
 *                     SMALLEST_WRITING (the thin strokes fall under a pixel of the exported page)
 *   visual output     the figure and its field in the heavy sans; the words around and through it in the thin
 *                     serif, as a printed poem sets its text
 *   sound output      none
 *
 * The face changes no position, size, count or cut: those were decided upstream in the reading face, and the
 * writing face only draws the words that were placed as words.
 */
import type { Face } from '../../glyph/font'
import { CONSTANTS } from '../spec'
import type { FaceCause, FaceRecord, MarkLayer } from '../types/layout'

export function faceOf(layer: MarkLayer, char: string, size: number, writingLacks: ReadonlySet<string>): { face: Face; because: FaceCause } {
  if (layer !== 'words') return { face: 'sans', because: 'reading' }
  if (writingLacks.has(char)) return { face: 'sans', because: 'no-writing-glyph' }
  if (size < CONSTANTS.SMALLEST_WRITING.value) return { face: 'sans', because: 'below-smallest-writing' }
  return { face: 'serif', because: 'words' }
}

/** the page's faces, counted by layer, face and cause, in a fixed order */
export function tally(entries: readonly { layer: MarkLayer; face: Face; because: FaceCause }[]): FaceRecord[] {
  const order: MarkLayer[] = ['words', 'figure', 'unit', 'repeat']
  const out: FaceRecord[] = []
  for (const e of entries) {
    const had = out.find((r) => r.layer === e.layer && r.face === e.face && r.because === e.because)
    if (had) had.marks++
    else out.push({ ...e, marks: 1 })
  }
  return out.sort((p, q) => order.indexOf(p.layer) - order.indexOf(q.layer) || (p.face < q.face ? -1 : p.face > q.face ? 1 : 0) || (p.because < q.because ? -1 : p.because > q.because ? 1 : 0))
}
