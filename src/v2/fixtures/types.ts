/**
 * The shape of the Niikuni benchmark and its controls (spec-1 §15).
 *
 * A case holds *expected values fixed by a person*, never values a generator
 * produced. It names Discoveries by pattern (type and terms), without ids,
 * evidence or basis — those belong to what a later stage will generate and
 * compare against this. Nothing here may carry a weight, a score or a mark of
 * "this is a Niikuni word": the set a case belongs to is for reporting only,
 * and no generator code may import a fixture (R6).
 */
import type { AdditionSide, RepetitionArrangement } from '../types/discovery'
import type { ExcludedAssociation, ResonanceOrigin, ResonanceType, RuntimeDistance } from '../types/resonance'
import type { FullEnclosureOperator, IdsOperator, PartialEnclosureOperator } from '../types/structure'
import type { TodoId } from '../spec'

/** reporting only: never read by a rule */
export type CaseSet = 'benchmark' | 'control' | 'generalization'

/** a person fixed this, against spec-1; a generated value never has this provenance */
export interface FixtureProvenance {
  kind: 'human-benchmark'
  spec: 'spec-1'
  section: string
  basis: string
}

/** an expectation that holds only once the named TODOs are settled (otherwise a later stage reports it as pending) */
export interface Expect<T> {
  value: T
  when?: readonly TodoId[]
  note?: string
}

export type InternalRepetitionPattern = {
  type: 'internal_repetition'
  unit: string
  unitTier: 'character' | 'stroke'
  n: number
  arrangement: RepetitionArrangement
  remainder: string | null
}
export type AdditionPattern = {
  type: 'addition'
  base: string
  delta: readonly [string, ...string[]]
  side: AdditionSide
  /** delta units, as the structure counts them (州: 3 dots); ink pieces are the ink's matter */
  count: number
  arrangement?: 'row' | 'column' | 'single'
}
export type EnclosurePattern = { type: 'enclosure'; container: string; contained: string; operator: FullEnclosureOperator }
export type PartialEnclosurePattern = { type: 'partial_enclosure'; wrapper: string; core: string; operator: PartialEnclosureOperator }
export type CompositionPattern = { type: 'composition'; parts: readonly [string, string, ...string[]]; operator: IdsOperator }
export type IntersectionPattern = { type: 'intersection'; within: string; strokes: readonly [string, string] }
export type NestedPattern = { type: 'nested'; term: string; holds: InternalRepetitionPattern }

export type DiscoveryPattern =
  | InternalRepetitionPattern
  | AdditionPattern
  | EnclosurePattern
  | PartialEnclosurePattern
  | CompositionPattern
  | IntersectionPattern
  | NestedPattern

export interface ResonancePattern {
  type: ResonanceType
  distance: RuntimeDistance
  origin: ResonanceOrigin
  /** the characters or words the evidence joins */
  terms: readonly [string, ...string[]]
}

export interface BenchmarkCase {
  title: string
  reading?: string
  set: CaseSet
  provenance: FixtureProvenance
  expect: {
    /** the primary Discovery, or null: nothing passes its gates (the fallback) */
    primary: Expect<DiscoveryPattern | null>
    /** Discoveries expected beside the primary (sharing its terms) */
    secondary?: readonly Expect<DiscoveryPattern>[]
    /** candidates expected to be found and not chosen */
    candidates?: readonly Expect<DiscoveryPattern>[]
    /** types that must not be the primary */
    notPrimary?: readonly Expect<DiscoveryPattern['type']>[]
    resonance?: readonly Expect<ResonancePattern>[]
    /** resonance types that must be absent */
    noResonance?: readonly Expect<ResonanceType>[]
    /** what the page must not claim (L2 / L3) */
    excluded?: readonly ExcludedAssociation[]
  }
}
