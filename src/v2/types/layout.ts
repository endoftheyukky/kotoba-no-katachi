/**
 * Layout (spec-1 §9): realises a FieldGeometry as marks, and nothing more. Its
 * input is fully decided upstream; its output is v1's Draft, so v1's renderers
 * (renderCanvas, svg) draw it unchanged.
 */
import type { Face } from '../../glyph/font'
import type { Draft } from '../../poem/types'
import type { TitleInput } from '../../title'
import type { Discovery } from './discovery'
import type { FieldGeometry } from './field'
import type { CharInk } from './observation'
import type { PlanCandidate } from './plan'
import type { Rationale } from './rationale'

export interface LayoutInput {
  input: TitleInput
  /** null on the fallback page (§10) */
  discovery: Discovery | null
  plan: PlanCandidate
  geometry: FieldGeometry
  /** the ink the plan's alignments were read in (reading face) */
  ink: ReadonlyMap<string, CharInk>
}

export type LayoutOutput = Draft

/** what generator v2 returns: the page and its whole record */
export interface V2Composition {
  input: TitleInput
  version: 2
  draft: Draft
  rationale: Rationale
}

/** what a mark is on the page, as Layout writes it */
export type MarkLayer =
  /** a Sequence's flow, the rest of a longer title, an Absent page's words, a context line */
  | 'words'
  /** a character of the title the figure stands on (the whole, the derived character, the interface, the glyph itself) */
  | 'figure'
  /** a unit of a field, of a whole or of a container, a stroke unit, a part apart, a title's character as a unit */
  | 'unit'
  /** the figure's character once more (the interleave, a band, a character of the relation its word writes) */
  | 'repeat'

export type FaceCause =
  /** the title written as words to be read */
  | 'words'
  /** a reading of ink: its place, size or cut were read in the reading face */
  | 'reading'
  /** a word the writing face has no glyph of its own for */
  | 'no-writing-glyph'
  /** a word below SMALLEST_WRITING */
  | 'below-smallest-writing'

export interface FaceRecord {
  layer: MarkLayer
  face: Face
  because: FaceCause
  /** how many marks */
  marks: number
}
