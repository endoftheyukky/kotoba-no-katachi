/**
 * Constraints (spec-1 §6): the Discovery translated into relations the page must
 * keep. No coordinates and no sizes; every constraint names what caused it.
 */
import type { AdditionSide, DiscoveryId, RepetitionArrangement } from './discovery'
import type { EvidenceId } from './provenance'
import type { ResonanceId } from './resonance'
import type { FullEnclosureOperator, IdsOperator, PartialEnclosureOperator } from './structure'

export type ConstraintId = `c:${string}`

export interface Because {
  discovery: DiscoveryId
  evidence?: readonly (EvidenceId | ResonanceId)[]
}

interface Base<K extends string> {
  id: ConstraintId
  kind: K
  because: Because
  why: string
}

export type Constraint =
  | (Base<'major'> & { term: string })
  | (Base<'difference'> & { term: string })
  | (Base<'zone'> & { term: string })
  | (Base<'same-scale'> & { a: string; b: string })
  | (Base<'boundary-side'> & { side: Exclude<AdditionSide, 'interleaved' | 'wrap'> })
  | (Base<'interleave'> & { count: number; arrangement: 'row' | 'column' | 'single' })
  | (Base<'no-emphasis'> & { term: string })
  | (Base<'visibility'> & { target: 'immediate' | 'hidden' })
  | (Base<'rhythm'> & { n: number; op: IdsOperator })
  | (Base<'container'> & { term: string })
  | (Base<'inside'> & { term: string; op: FullEnclosureOperator })
  | (Base<'interface'> & { term: string })
  | (Base<'extent'> & { scale: 'page' | 'glyph' })
  | (Base<'intersection'> & { term: string })
  | (Base<'wrapper-zone'> & { term: string; op: PartialEnclosureOperator })
  | (Base<'regions'> & { parts: readonly string[] })
  | (Base<'axis'> & { op: IdsOperator })
  | (Base<'separation'> & { axis: 'horizontal' | 'vertical' })
  | (Base<'repeated'> & { unit: string; tier: 'character' | 'stroke' })
  | (Base<'count'> & { n: number; arrangement: RepetitionArrangement })
  | (Base<'whole-emerges'> & { whole: string })
  | (Base<'remainder-site'> & { remainder: string })
  | (Base<'demoted'> & { by: 'origin:pictograph' })

export type ConstraintKind = Constraint['kind']
