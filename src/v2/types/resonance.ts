/**
 * Semantic Resonance (spec-1 §5): typed evidence that a structural Discovery
 * and a meaning answer each other — never a score.
 *
 * At run time only L0 (a resource states the relation directly) and L1 (a fixed
 * schema agrees with the structure's type) exist. L2 (association) and L3
 * (metaphor) are a different type altogether: they can be *named* — to record
 * what a page does not claim — but can never be SemanticEvidence.
 */
import type { Provenance } from './provenance'

/** the distances admitted at run time */
export type RuntimeDistance = 'L0' | 'L1'
/** never produced automatically; only ever recorded as excluded */
export type AssociativeDistance = 'L2' | 'L3'
export type ResonanceDistance = RuntimeDistance | AssociativeDistance

export type ResonanceType =
  | 'part-referent'
  | 'component-whole'
  | 'radical-meaning'
  | 'origin'
  | 'schema'
  | 'lexical-candidate'

/** where resonance-1 took a row from (the table records the resource and its version) */
export type ResonanceOrigin = 'wordnet-jpn' | 'char-origin' | 'chive-schema'

/** the image schemas of the fixed anchor set; only ACTIVE_L1_PAIRS may give L1 evidence in v2.0 */
export type SchemaName =
  | 'UNIT' | 'MULTITUDE' | 'CONTAINER' | 'CENTER' | 'PATH' | 'SURFACE'
  | 'DOWN' | 'BOUNDARY' | 'LIQUID' | 'VOICE' | 'SORROW'

/** the formation of a character (六書 as the origin data name it) */
export type Formation = 'pictograph' | 'indicative' | 'ideograph' | 'phono-semantic'

export type ResonanceId = `res:${string}`

interface Base<T extends ResonanceType, D extends RuntimeDistance> {
  id: ResonanceId
  type: T
  distance: D
  origin: ResonanceOrigin
  provenance: Provenance
  detail: string
}

/** A: a part is one unit of what the whole names (雨 has-part raindrop, 林 has-member tree) */
export interface PartReferent extends Base<'part-referent', 'L0'> {
  whole: string
  unit: string
  relation: 'has-part' | 'has-member' | 'described'
}

/** B: the parts' meanings make the whole's (囚: a person in an enclosure) */
export interface ComponentWhole extends Base<'component-whole', 'L0'> {
  whole: string
  components: readonly string[]
  relation: 'described' | 'is-a'
}

/** the semantic radical's meaning is a typed relation of the whole word (海 made-of 水) */
export interface RadicalMeaning extends Base<'radical-meaning', 'L0'> {
  whole: string
  radical: string
  meaning: string
  relation: 'made-of' | 'is-a' | 'has-part'
}

/** F: how the character was formed */
export interface Origin extends Base<'origin', 'L0'> {
  char: string
  formation: Formation
}

/** E at L0: a typed lexical path to a schema concept (的 → bull's eye → center) */
export interface SchemaDirect extends Base<'schema', 'L0'> {
  char: string
  concept: string
  path: readonly string[]
}

/** E at L1: a fixed schema's percentile, admitted only paired with the structure type it agrees with */
export interface SchemaPaired extends Base<'schema', 'L1'> {
  char: string
  schema: SchemaName
  percentile: number
  structure: 'enclosure' | 'internal_repetition'
}

/** C?: a phonetic component that is a word by itself — recorded, never acting on the page */
export interface LexicalCandidate extends Base<'lexical-candidate', 'L0'> {
  char: string
  component: string
}

export type SemanticEvidence =
  | PartReferent
  | ComponentWhole
  | RadicalMeaning
  | Origin
  | SchemaDirect
  | SchemaPaired
  | LexicalCandidate

/**
 * An association a page does *not* claim (L2 / L3), named so that the record
 * can say what was left out. It is not SemanticEvidence and cannot stand where
 * SemanticEvidence stands.
 */
export interface ExcludedAssociation {
  distance: AssociativeDistance
  from: string
  to: string
  note: string
}
