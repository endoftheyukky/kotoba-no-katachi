/**
 * Layout (spec-1 §9): realises a FieldGeometry as marks, and nothing more. Its
 * input is fully decided upstream; its output is v1's Draft, so v1's renderers
 * (renderCanvas, svg) draw it unchanged.
 */
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
