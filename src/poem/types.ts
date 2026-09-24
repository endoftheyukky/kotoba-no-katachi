/**
 * Title → relations → poetic operations (what is done to the words)
 *       → material (the words as they will be written)
 *       → the page (poem/parametric: how the page holds them) → marks.
 *
 * Operations and the page are separate layers. Both are read from the
 * relations found in the title; the seed is used only for a plastic (造形)
 * decision inside the rules: which way the figure turns.
 */
import type { Face } from '../glyph/font'
import type { PartReading } from '../glyph/legibility'
import type { GlyphMetrics } from '../glyph/metrics'
import type { Arrangement, GlyphPart } from '../glyph/parts'
import type { GlyphRelation } from '../glyph/relation'
import type { Counter, CounterArrangement, Interior } from '../glyph/interior'
import type { GlyphLibrary } from '../glyph/source'
import type { LanguageAnalysis } from '../language/analysis'
import type { Rect } from '../render/stage'
import type { TitleInput } from '../title'

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
 * visualPotential: how far the operations and the page
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
   * the page (from the focus); modifiers act here.
   * Returns null when there is nothing to act on.
   */
  apply(a: Analysis, p: Proposal, tokens: Unit[][]): Unit[][] | null
}

// ---------------------------------------------------------------------------
// the page

/** One glyph (or part of one) on the page. Page units: the page is PAGE × PAGE. */
export interface Mark {
  char: string
  /**
   * The face it is written in: the reading face (sans, the default) for a mark
   * that is a reading of ink, the serif for the title written as writing.
   * Set once for the whole page (poem/face.ts), never by a composition.
   */
  face?: Face
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
  /** the character of the title this mark writes, when it writes one */
  grapheme?: number
  /** what the mark is in the page's hierarchy */
  role?: MarkRole
  /** where a mark the title does not itself write came from */
  derived?: Provenance
  /**
   * A group of derived marks that together write one character of the title
   * (a form drawn in small marks): the grapheme it stands for. The character
   * is present on the page as that form, not as one mark.
   */
  represents?: number
}

/**
 * What a mark is in the page's own hierarchy.
 *   nucleus    the mark the page is organised around
 *   body       the title's own characters, written
 *   context    the rest of the title beside a figure
 *   satellite  a small mark placed in relation to a nucleus: few, and the
 *              largest of the derived marks
 *   grain      one of many small marks that together make a field or a form:
 *              the smallest, and many
 *   trace      what remains of a mark: an echo, a decay
 *   auxiliary  a mark brought from outside the title's own writing (its sound
 *              reduced to vowels, a word the lexicon relates to it): few,
 *              small, and never where the title itself is
 */
export type MarkRole = 'nucleus' | 'body' | 'context' | 'satellite' | 'grain' | 'trace' | 'auxiliary'

/** where a mark the title does not itself write came from */
export interface Provenance {
  /** what added it: the page's material (poem/parametric/material.ts) */
  grammar: 'material'
  /**
   *   repeat    the title's own character again (a repetition carried further)
   *   echo      a mark's own character, fading (a decay, an afterimage)
   *   form      a form the reading found inside a character (an echo form, an inner glyph)
   *   rest      the rest of the title, used as material for a form
   *   sound     the title's reading reduced to its vowels (phonological)
   *   semantic  a character a lexicon relates to one the title writes: never
   *             the title's own, never shown as an explanation
   */
  kind: 'repeat' | 'echo' | 'form' | 'rest' | 'sound' | 'semantic'
  /** the grapheme it derives from, when it derives from one */
  from?: number
  /** for semantic material: the resource, and the relation it was read by */
  source?: string
  note: string
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
  rejected: Rejection[]
  /** how the page was drawn from the title (poem/parametric) */
  parametric: import('./parametric').ParametricApplied
  draft: Draft
}
