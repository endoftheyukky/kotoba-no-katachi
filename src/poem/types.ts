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
  | { kind: 'repetition'; value: string; occurrences: number[][]; contiguous: boolean; whole: boolean }
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
    }
  /** two glyphs related in form */
  | { kind: 'pair'; relation: GlyphRelation }
  /** graphemes that are written as space */
  | { kind: 'absence'; graphemes: number[]; negation: boolean; silence: boolean }
  /** a joint inside a word: the kanji stem and the kana ending it carries */
  | { kind: 'joint'; token: number; at: number }

export interface Proposal {
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

export type SpatialId = 'field' | 'band' | 'radial' | 'axis' | 'centre' | 'void' | 'scattered' | 'cluster'

export interface Fit {
  id: SpatialId
  /** 0–1: how strongly the title's relations call for this space */
  score: number
  grounds: string[]
}

export interface SpatialComposition {
  id: SpatialId
  title: string
  rules: readonly string[]
  /** null when this space cannot hold this material */
  fit(a: Analysis, m: Material): Fit | null
  realize(a: Analysis, m: Material, rng: Rng, scale: Scale): Mark[]
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
  spatial: Fit
  scale: Scale
  /** every proposal, ranked by salience */
  proposals: Proposal[]
  /** every space that could hold the material, ranked */
  fits: Fit[]
  rejected: Rejection[]
  draft: Draft
}
