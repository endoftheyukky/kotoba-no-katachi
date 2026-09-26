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
  // the words and their sound (added at Stage 6: §7.2's Sequence rule names lexical and phonological
  // Discoveries as its source without a constraint of theirs; these carry them, and never a structure's)
  /** the title's graphemes keep their reading order along one line */
  | (Base<'sequence'> & { graphemes: readonly number[] })
  /** the same unit returns: these graphemes answer each other on the line (an echo, a reduplication, a mirror) */
  | (Base<'recurrence'> & { members: readonly number[]; unit: 'mora' | 'vowel' | 'onset' | 'grapheme' | 'token'; value: string })
  /** a break the language makes: before this grapheme the line parts (stem | ending, a negation, a relation word, a coordination) */
  | (Base<'split'> & { at: number; by: 'inflection' | 'negation' | 'relation-word' | 'coordination' })

export type ConstraintKind = Constraint['kind']
