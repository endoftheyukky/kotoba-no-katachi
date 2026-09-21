/**
 * Title → relations → poetic operations (what is done to the words)
 *       → material (the words as they will be written)
 *       → spatial composition (how the page holds them) → marks.
 *
 * Operations and spatial compositions are separate layers. Each is chosen
 * from the relations found in the title; the seed is used only for plastic
 * (造形) decisions inside the rules: margins, small offsets, how far a form
 * leaves the page, permitted ranges of proportion.
 */
import type { PartReading } from '../glyph/legibility'
import type { GlyphMetrics } from '../glyph/metrics'
import type { Arrangement, GlyphPart } from '../glyph/parts'
import type { GlyphRelation } from '../glyph/relation'
import type { Counter, CounterArrangement, Interior } from '../glyph/interior'
import type { GlyphLibrary } from '../glyph/source'
import type { LanguageAnalysis } from '../language/analysis'
import type { Rect } from '../render/stage'
import type { TitleInput } from '../title'
import type { Rng } from '../core/random'

export interface Vec {
  x: number
  y: number
}

/** Everything the poem may take as material and ground. */
export interface Analysis extends LanguageAnalysis {
  glyphs: GlyphLibrary
  /** the computer's readings of the fixed font's letterforms (not linguistic facts) */
  glyphRelations: GlyphRelation[]
  /** glyphs a part of a glyph may be read as: common components, strokes, and the title's own characters */
  readables: Map<string, GlyphMetrics>
  /**
   * For each kana written with a voicing mark, the reading of the voiced
   * glyph against the unvoiced one it decomposes into: ぜ = せ + ゛.
   * Keyed by the voiced character.
   */
  voicing: Map<string, GlyphRelation>
  /** what the inside of each of the title's letterforms holds (glyph/interior.ts) */
  interiors: Map<string, Interior>
}

/**
 * How far down the title the feature a proposal rests on was found. The poem
 * is built from the highest level that reaches the page; it descends only
 * when nothing above does (poem/compose.ts, DESCENT_FLOOR).
 *
 *   1  語 — between words: dependency, coordination, negation, the joint of a
 *      word, a space written between two of them
 *   2  字 — between characters: a repeated character, a mirrored title, one
 *      letterform read inside another, the parts a character falls into
 *   3  音 — sound: a voicing mark, a special mora, a marked echo
 *   4  画 — the ink itself: white the strokes close in, the same form
 *      returning inside one character. What is read here reads as nothing:
 *      it is structure, not writing. (Level 2 covers what still reads as a
 *      character; this is what is left when nothing does.)
 */
export type FeatureLevel = 1 | 2 | 3 | 4

/**
 * How much of the title a feature acts on.
 *
 *   whole  the feature is the whole title (a palindrome, a title that repeats
 *          entirely, a word that is itself the title)
 *   span   a contiguous part of it (the stem and ending of one word among
 *          several, a compound's second character)
 *   unit   one character, one beat, or a few scattered ones
 *
 * A local feature must not cost the title the rest of itself: what the
 * feature does not act on is context, and context keeps its place in the
 * order of the writing (poem/context.ts).
 */
export interface FeatureScope {
  kind: 'whole' | 'span' | 'unit'
  /** graphemes the feature acts on, in title order */
  target: number[]
  /** graphemes it does not act on, in title order */
  context: number[]
  grounds: string
}

// ---------------------------------------------------------------------------
// three measures of a proposal

/**
 * linguisticSalience: how prominent the relation is for this title, as
 * language — comparable across operations. Nothing about how it would look.
 *   relationStrength  how strong the relation itself is
 *   distinctiveness   how unusual it is (a property most titles have is low)
 *   coverage          how much of the title it accounts for
 */
export interface Salience {
  value: number
  relationStrength: number
  distinctiveness: number
  coverage: number
}

/**
 * visualPotential: how far the present operations and spatial compositions
 * can turn this relation into a strong visual structure that keeps the
 * character of writing. Independent of how prominent the relation is.
 *   legibility  how much of what is drawn stays readable as writing
 *   structure   how clearly the relation shows as structure on the page
 */
export interface VisualPotential {
  value: number
  legibility: number
  structure: number
  notes: string[]
}

// ---------------------------------------------------------------------------
// operations

export type OperationId = 'proliferation' | 'decomposition' | 'transformation' | 'absence'

/**
 * Where a feature comes from — how far the reader has to go to meet it.
 *   endogenous  a relation between things the title itself writes
 *               (川 ⊂ 州 in 川または州, the repetition of ころ)
 *   intrinsic   structure taken from one character alone
 *               (森 coming apart into 木)
 *   exogenous   found only by holding the title's character against a
 *               component the title never writes (間 ⊃ 門, 白 ⊃ 口).
 *               The reader cannot see what was compared, so on its own it
 *               does not give a poem its subject.
 */
export type FeatureOrigin = 'endogenous' | 'intrinsic' | 'exogenous'

/** What, in the title, an operation acts on. */
export type Focus =
  /** a unit that recurs: each occurrence as grapheme indices */
  | {
      kind: 'repetition'
      value: string
      occurrences: number[][]
      contiguous: boolean
      whole: boolean
      /** the repetition is one of sound; what is drawn stays the title's own characters */
      sound?: { unit: 'mora' | 'vowel' | 'onset'; value: string }
    }
  /** repetition with nothing in the title to ground it */
  | { kind: 'plain' }
  /** a glyph and the parts the computer reads in it */
  | {
      kind: 'parts'
      grapheme: number
      parts: GlyphPart[]
      /** what each part reads as, if anything */
      readings: (PartReading | null)[]
      arrangement: Arrangement
      byReading: boolean
      /**
       * The parts are not what the character comes apart into but the same
       * form returning inside it (品 three 口, 羽 two halves): a repetition,
       * read in the ink and not in the writing.
       */
      echo?: { similarity: number }
    }
  /** white the strokes of one character close in */
  | {
      kind: 'counter'
      grapheme: number
      holes: Counter[]
      arrangement: CounterArrangement
      /** how alike the counters are in area */
      even: number
    }
  /** two glyphs related in form */
  | {
      kind: 'pair'
      relation: GlyphRelation
      /** the pair is a kana and the unvoiced character it decomposes into */
      voicing?: { mark: string; base: string; alsoWritten: boolean }
    }
  /** graphemes that are written as space */
  | {
      kind: 'absence'
      graphemes: number[]
      negation: boolean
      silence: boolean
      /** beats of the whole title, and which of them are silent */
      beats: number
      silentMorae: number[]
    }
  /** a joint inside a word: the kanji stem and the kana ending it carries */
  | { kind: 'joint'; token: number; at: number }

export interface Proposal {
  /** the level of language the feature was found at */
  level: FeatureLevel
  /** how much of the title it acts on — filled in by the composer (poem/scope.ts) */
  scope?: FeatureScope
  /** the observations it rests on — filled in by the composer (poem/scope.ts) */
  basis?: string[]
  op: OperationId
  origin: FeatureOrigin
  focus: Focus
  linguisticSalience: Salience
  /** filled in by the composer (poem/potential.ts), not by the operation */
  visualPotential?: VisualPotential
  /** √(linguisticSalience × visualPotential): what the primary operation is chosen by */
  poeticPotential?: number
  /** whether it may give the poem its subject, act only as a modifier, or both */
  roles: { primary: boolean; modifier: boolean; note?: string }
  /** the relations it stands on, as compact labels */
  relations: string[]
  /** the ground, in words */
  evidence: string[]
}

/** subtraction of another glyph, in the em space of the unit's glyph */
export interface Minus {
  char: string
  dx: number
  dy: number
  scale: number
  /** only these regions of what remains are drawn: the pieces with form, not the slivers */
  keep?: Rect[]
}

/** One grapheme of the title as it will be written. */
export interface Unit {
  grapheme: number
  token: number
  char: string
  /** written as the space it occupies */
  absent?: boolean
  /** written as its parts, slightly apart (decomposition as a modifier) */
  parts?: GlyphPart[]
  /** written with another glyph removed from it (transformation as a modifier) */
  minus?: Minus
}

export interface Material {
  /** the title, token by token */
  tokens: Unit[][]
  /** the operation that gives the poem its subject */
  primary: Proposal
  /** operations that act on the material without changing the subject */
  modifiers: Proposal[]
}

export interface PoeticOperation {
  id: OperationId
  title: string
  /** explicit poetic mappings, in words */
  rules: readonly string[]
  propose(a: Analysis): Proposal[]
  /**
   * Change the units. For the primary operation most of the work is done by
   * the spatial composition (from the focus); modifiers act here.
   * Returns null when there is nothing to act on.
   */
  apply(a: Analysis, p: Proposal, tokens: Unit[][]): Unit[][] | null
}

// ---------------------------------------------------------------------------
// space

export type SpatialId = 'field' | 'band' | 'radial' | 'axis' | 'centre' | 'void' | 'scattered' | 'cluster' | 'nest' | 'grid' | 'path'

export interface Fit {
  id: SpatialId
  /** 0–1: how strongly the title's relations call for this space */
  score: number
  grounds: string[]
  /**
   * Which of its own ways this composition will draw, when it has more than
   * one but only one fitness: the choice is between two ways of holding the
   * same relation, not between two relations, so it is settled here and does
   * not compete. Compositions with a single way leave it out.
   */
  mode?: string
}

/**
 * One way a composition could hold this material. A composition offers as
 * many as it has: a feature and a page are not in one-to-one correspondence,
 * and a repetition may become a band, a field, a grid or a path.
 *
 *   uses        which measured properties of the feature this way takes hold
 *               of — named, so that two offers can be compared by what they
 *               actually read rather than by an opinion of the composition
 *   fitness     how far those properties meet what this way needs
 *   realisable  whether the page can hold it at a readable size: a hard gate,
 *               decided by the composition, which is the only thing that
 *               knows its own geometry
 *   demand      what it will ask of the page, before anything is drawn
 *
 * The worth of the feature itself (poeticPotential) is settled in the
 * descent and is never re-judged here.
 */
export interface Realization {
  id: SpatialId
  /** which way of this composition: 'line' | 'nested' | '1xN' | … */
  mode: string
  /** only what this way keeps and uses on the page */
  uses: { property: string; value: string }[]
  /**
   * Measured structure this way cannot keep. Recorded so that the page can be
   * judged against what was read, and kept out of `uses` so that discarding
   * something can never count in a composition's favour.
   */
  losses?: { property: string; value: string }[]
  grounds: string[]
  fitness: number
  realisable: boolean
  demand: { reach: number; spread: Spread; minSize: number; cells?: number; depth?: number }
}

/**
 * A parameter of a composition, with where its value came from.
 *   linguistic  derived from a relation in the title
 *   plastic     a decision of form, derived from measurement but not from language
 * Parameters that are not among the strongest few are returned to neutral, so
 * that one page shows one or two differences, not all of them at once.
 */
export interface Parameter {
  name: string
  ground: 'linguistic' | 'plastic'
  value: string
  neutral: string
  applied: boolean
  /** 0–1: how far this feature pushes the parameter from neutral */
  deviation: number
  note: string
}

export interface Placed {
  marks: Mark[]
  /** what the composition decided, and why (for study; never drawn) */
  parameters?: Parameter[]
  /** the contract this composition worked under, where it works under one */
  contract?: Contract
}

export interface SpatialComposition {
  id: SpatialId
  title: string
  rules: readonly string[]
  /**
   * Whether this composition may let its marks run off the page rather than
   * shrink them when the page cannot hold the relation. A property of the
   * composition, not a global rule: a page whose three terms must all be
   * traceable cannot afford to lose one over the edge.
   */
  bleed?: boolean
  /** which foci it can hold at all (for study; the offers decide the rest) */
  accepts?: readonly Focus['kind'][]
  /** every way it could hold this material. Compositions that have only one way keep `fit`. */
  offer?(a: Analysis, m: Material): Realization[]
  /** null when this space cannot hold this material */
  fit(a: Analysis, m: Material): Fit | null
  /** `r` is the way that was chosen, for compositions that offer more than one */
  realize(a: Analysis, m: Material, rng: Rng, scale: Scale, r?: Realization): Placed
}

// ---------------------------------------------------------------------------
// occupancy and the scale contract
//
// Two separate measures. Scale is how large a mark is; occupancy is how much
// of the page the figure claims. They are independent: small marks at the two
// edges occupy the whole page, and two large marks touching in the middle
// occupy little of it.

/**
 * micro  texture, or a mark set beside another as a witness
 * small  the unit of a line or a field: read as writing, not as a form
 * normal a word held at a distance
 * large  the letterform itself is the subject, and fills much of the page
 * macro  larger than the page can hold; only for what an operation produced
 */
export type ScaleBand = 'micro' | 'small' | 'normal' | 'large' | 'macro'

/** how the figure fills what it reaches */
export type Spread = 'mass' | 'pair' | 'line' | 'field' | 'edge'

/** a decision with the kind of ground it rests on (for study; never drawn) */
export interface Decision {
  name: string
  ground: 'linguistic' | 'plastic'
  value: string
  note: string
}

export interface Occupancy {
  /** 0–1.3: the longer side of the figure, as a share of the page */
  reach: number
  /** 0–1: how much of the reach is ink rather than the white inside the figure */
  fill: number
  spread: Spread
  /** whether the figure may leave the page instead of shrinking */
  bleed: boolean
  decisions: Decision[]
}

/** a request to size several groups of marks that share one reach */
export interface FitRequest {
  /** how many glyph widths each group lays along the reach */
  extents: number[]
  /** the desired size of each group, relative to each other (from the language) */
  ratios: number[]
  /** the band the grounds ask for */
  band: ScaleBand
  note: string
}

export interface Fitted {
  /** em size for each group, in page units */
  sizes: number[]
  /** what the grounds asked for */
  desired: ScaleBand
  /** what the page could hold */
  achieved: ScaleBand
  /** the figure leaves the page */
  bled: boolean
  decisions: Decision[]
}

export interface Contract {
  occupancy: Occupancy
  fitted: Fitted
  /** how the rest of the title was kept, where the feature is a local one */
  context?: Decision[]
}

// ---------------------------------------------------------------------------
// scale

/**
 * micro  text size or smaller: the units are read as texture or as asides
 * normal the size of a word held at a distance: 10–30% of the page per glyph
 * macro  larger than a hand can hold: over half the page, may leave it
 * mixed  macro and micro at once, nothing in between
 */
export type ScaleRegime = 'micro' | 'normal' | 'macro' | 'mixed'

/**
 * result  what the operation produced (a residue, parts of a glyph)
 * body    the words the composition is built from
 * aside   what stands beside them (a relation word, the title as a witness)
 */
export type ScaleRole = 'result' | 'body' | 'aside'

export interface Scale {
  regime: ScaleRegime
  grounds: string
  /** the permitted em sizes for a role, in page units */
  range(role: ScaleRole): [number, number]
  /** 造形: a size within the role's range; `within` narrows it to a part of the range (0–1) */
  pick(role: ScaleRole, rng: Rng, within?: [number, number]): number
}

// ---------------------------------------------------------------------------
// the page

/** One glyph (or part of one) on the page. Page units: the page is PAGE × PAGE. */
export interface Mark {
  char: string
  x: number
  y: number
  /** em size in page units */
  size: number
  rotate?: number
  /** keep only these regions of the glyph (em space, ink centre = origin) */
  keep?: Rect[]
  /** displacement in the glyph's em space */
  shift?: Vec
  /** another glyph's ink removed from this one */
  minus?: Minus
  /**
   * The mark is not part of the figure but of the title around it: it is
   * measured separately and never leaves the page. Renderers ignore this.
   */
  context?: boolean
}

export interface Draft {
  marks: Mark[]
}

export interface Rejection {
  proposal: Proposal
  reason: string
}

export interface Composition {
  input: TitleInput
  seed: number
  primary: Proposal
  modifiers: Proposal[]
  spatial: Realization
  scale: Scale
  parameters: Parameter[]
  /** null where the composition does not yet work under the new contract */
  contract: Contract | null
  /** graphemes the poem writes as space, so a missing character can be explained */
  absent: number[]
  /**
   * Which layer of the descent the poem was built from, and why.
   *   adopted   the best of the layer the poem was taken from
   *   upper     the best a layer above it offered, where one reached the page
   *   deepest   the best anywhere below
   *   held      the observation a deeper reading shared, where that kept it
   *             from displacing what was already read
   */
  descent: { layer: number; reason: string; adopted: number; upper: number; deepest: number; held: string[] }
  /** every proposal, ranked by salience */
  proposals: Proposal[]
  /** every way a space could hold the material, ranked */
  fits: Realization[]
  rejected: Rejection[]
  draft: Draft
}
