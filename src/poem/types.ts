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
}

// ---------------------------------------------------------------------------
// salience

/**
 * How much a relation belongs to this title — comparable across operations.
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

// ---------------------------------------------------------------------------
// operations

export type OperationId = 'proliferation' | 'decomposition' | 'transformation' | 'absence'

/** What, in the title, an operation acts on. */
export type Focus =
  /** a unit that recurs: each occurrence as grapheme indices */
  | { kind: 'repetition'; value: string; occurrences: number[][]; contiguous: boolean; whole: boolean }
  /** repetition with nothing in the title to ground it */
  | { kind: 'plain' }
  /** a glyph and the parts the computer reads in it */
  | { kind: 'parts'; grapheme: number; parts: GlyphPart[]; arrangement: Arrangement; byReading: boolean }
  /** two glyphs related in form */
  | { kind: 'pair'; relation: GlyphRelation }
  /** graphemes that are written as space */
  | { kind: 'absence'; graphemes: number[]; negation: boolean; silence: boolean }

export interface Proposal {
  op: OperationId
  focus: Focus
  salience: Salience
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
  realize(a: Analysis, m: Material, rng: Rng): Mark[]
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
  /** every proposal, ranked by salience */
  proposals: Proposal[]
  /** every space that could hold the material, ranked */
  fits: Fit[]
  rejected: Rejection[]
  draft: Draft
}
