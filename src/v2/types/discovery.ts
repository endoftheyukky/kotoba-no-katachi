/**
 * Discovery (spec-1 §3): a relation found in the words, with its terms, roles
 * and evidence. A Discovery never holds a coordinate, a page size, a score, or
 * anything that says whose work a word resembles.
 *
 * One discriminated union: each type carries exactly the terms it needs, so a
 * Discovery without its terms does not type-check.
 */
import type { GlyphRelation } from '../../glyph/relation'
import type { Rect } from '../../render/stage'
import type { EmPoint } from './observation'
import type { Evidence } from './provenance'
import type { FullEnclosureOperator, IdsOperator, PartialEnclosureOperator, Tier } from './structure'

export type Level = 'character' | 'inter-character' | 'lexical' | 'phonological'

export type Role =
  | 'base' | 'derived' | 'delta'
  | 'container' | 'contained'
  | 'wrapper' | 'core'
  | 'unit' | 'whole' | 'remainder'
  | 'part' | 'stroke'
  | 'inner' | 'outer'

/** a term of a relation: a character (or a component) in a role */
export interface Term<R extends Role = Role> {
  char: string
  role: R
  tier: Tier
  /** where it stands in its character, when the ink was read (em space) */
  box?: Rect
}

/** canonical id (§4.3): `${type}:${first grapheme}:${terms}` */
export type DiscoveryId = `${string}:${number}:${string}`

interface Base<T extends string, L extends Level> {
  id: DiscoveryId
  type: T
  level: L
  /** the title's graphemes it lies in */
  graphemes: readonly number[]
  evidence: readonly Evidence[]
  /** observation identity: two Discoveries sharing a basis read the same observation twice */
  basis: readonly string[]
  /** Discoveries found inside this one's terms (淋 → 林 = 木×2) */
  nested?: readonly DiscoveryId[]
}

// ------------------------------------------------------------ within one character

/** how the units of a repetition stand in the whole */
export type RepetitionArrangement = '⿰' | '⿱' | '2x2' | 'row' | 'stack'

export interface InternalRepetition extends Base<'internal_repetition', 'character'> {
  unit: Term<'unit'>
  n: number
  arrangement: RepetitionArrangement
  whole: Term<'whole'>
  remainder: Term<'remainder'> | null
  /** character units are written as themselves; stroke units are cut from the whole */
  unitTier: 'character' | 'stroke'
  /** the local group's geometry in the whole (spec §3; used by later stages, never a score) */
  groupGeometry: {
    /** the white between neighbouring units, along the axis that joins them, in units */
    gapRatio: number
    /** centre-to-centre distance of neighbouring units, em */
    nn: number
    /** how many units stand side by side in a row */
    across: number
    /** how far a character unit is compressed in the whole (1 for strokes) */
    compression: number
    /** unit centroids in the whole, em */
    offsets: readonly EmPoint[]
  }
}

export type AdditionSide = 'left' | 'right' | 'top' | 'bottom' | 'interleaved' | 'wrap'

export interface Addition extends Base<'addition', 'character'> {
  base: Term<'base'>
  derived: Term<'derived'>
  delta: readonly [Term<'delta'>, ...Term<'delta'>[]]
  side: AdditionSide
  /** how many pieces the delta is (州: 3) */
  count: number
  arrangement?: 'row' | 'column' | 'single'
  /** the ink measures the addition gates read (§4.1) */
  ink: {
    deltaShare: number
    deltaPieces: number
    baseScale: number
    baseAspect: number
    residueCentroid: EmPoint
  }
}

export interface Composition extends Base<'composition', 'character'> {
  parts: readonly [Term<'part'>, Term<'part'>, ...Term<'part'>[]]
  operator: Exclude<IdsOperator, FullEnclosureOperator | PartialEnclosureOperator | '⿻'>
  axis: 'horizontal' | 'vertical'
}

export interface Enclosure extends Base<'enclosure', 'character'> {
  container: Term<'container'>
  contained: Term<'contained'>
  operator: FullEnclosureOperator
}

export interface PartialEnclosure extends Base<'partial_enclosure', 'character'> {
  wrapper: Term<'wrapper'>
  core: Term<'core'>
  operator: PartialEnclosureOperator
}

export interface Intersection extends Base<'intersection', 'character'> {
  strokes: readonly [Term<'stroke'>, Term<'stroke'>]
  /** the character whose strokes cross (十, or 十 inside 辻) */
  within: string
  /** where they cross, em */
  point: EmPoint
}

export interface Nested extends Base<'nested', 'character'> {
  /** the term of an outer Discovery that holds the inner one */
  term: string
  holds: DiscoveryId
}

// ------------------------------------------------------------ between the title's characters

export interface InterContainment extends Base<'inter_containment', 'inter-character'> {
  inner: Term<'inner'>
  outer: Term<'outer'>
  relation: GlyphRelation
}

export interface InterSimilarity extends Base<'inter_similarity', 'inter-character'> {
  inner: Term<'inner'>
  outer: Term<'outer'>
  relation: GlyphRelation
}

// ------------------------------------------------------------ the words and their sound

export type LexicalType = 'inflection' | 'coordination' | 'negation' | 'relation_word' | 'reduplication' | 'mirror'

export interface Lexical extends Base<LexicalType, 'lexical'> {
  /** the token indices the relation spans */
  tokens: readonly number[]
}

/** produced in v2.0 */
export type ActivePhonologicalType = 'echo' | 'voicing'
/** shape reserved, never produced until TODO-6 */
export type ReservedPhonologicalType = 'resegmentation' | 'cycle' | 'permutation' | 'homophony'

export interface Phonological extends Base<ActivePhonologicalType | ReservedPhonologicalType, 'phonological'> {
  morae: readonly number[]
  unit?: 'mora' | 'onset' | 'vowel'
}

export type Discovery =
  | InternalRepetition
  | Addition
  | Composition
  | Enclosure
  | PartialEnclosure
  | Intersection
  | Nested
  | InterContainment
  | InterSimilarity
  | Lexical
  | Phonological

export type DiscoveryType = Discovery['type']

/** the types that may become the primary Discovery (§4.1; nested, lexical and phonological may not in v2.0) */
export type PrimaryCapableType =
  | 'addition'
  | 'internal_repetition'
  | 'inter_containment'
  | 'inter_similarity'
  | 'enclosure'
  | 'composition'
  | 'partial_enclosure'
  | 'intersection'
