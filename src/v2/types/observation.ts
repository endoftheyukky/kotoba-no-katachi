/**
 * Observation (spec-1 §2): what the input is, read as facts with their sources.
 * Nothing here chooses, weighs or speaks of the page.
 *
 * The structure guarantees *what exists*; the ink reads *where and how it
 * exists in the reading face* (Noto Sans JP 500). An ink score never decides
 * whether a component is there.
 */
import type { Rect } from '../../render/stage'
import type { GlyphRelation } from '../../glyph/relation'
import type { LanguageAnalysis } from '../../language/analysis'
import type { Meaning } from '../../language/semantic/axes'
import type { TitleInput } from '../../title'
import type { DataVersions, Provenance } from './provenance'
import type { SemanticEvidence } from './resonance'
import type { CharStructure } from './structure'

/** a point in a glyph's em space (ink centre = origin, EM = 100) */
export interface EmPoint {
  x: number
  y: number
}

/** a connected island of ink (v1 glyph/parts islands, ≥ 3% of the ink) */
export interface Island {
  /** the regions of the glyph it keeps (em space) */
  keep: readonly Rect[]
  share: number
  centroid: EmPoint
}

/** where a structural component stands in the reading face: the joint fit of all the character's components */
export interface InkPlacement {
  /** the component, as the structure names it */
  term: string
  box: Rect
  sx: number
  sy: number
  dx: number
  dy: number
  /** how far the placed component lies on the character's ink beyond chance */
  lift: number
  /** how much of the character's ink it accounts for */
  coverage: number
}

export interface CharInk {
  char: string
  half: { w: number; h: number }
  islands: readonly Island[]
  /** groups of alike islands (a unit repeated in the ink: 雨's four dots) */
  alike: readonly { members: readonly number[]; share: number }[]
  /** the white the strokes close in (v1 glyph/interior) */
  counters: readonly { area: number }[]
  /** where a long horizontal and a long vertical run pass straight through each other */
  crossings: readonly EmPoint[]
  /** per structural component of the top level */
  placements: Readonly<Record<string, InkPlacement>>
  /** what is left once the base is removed (additions) */
  residue?: { share: number; pieces: readonly Island[] }
  provenance: Provenance
}

export interface Observation {
  input: TitleInput
  /** v1 analyzeLanguage, unchanged: graphemes, tokens, morae, phonology, relations */
  language: LanguageAnalysis
  /** per distinct character; null where the table has no structure for it */
  structure: ReadonlyMap<string, CharStructure | null>
  ink: ReadonlyMap<string, CharInk>
  /** v1 readRelations between the title's own characters */
  titleRelations: readonly GlyphRelation[]
  /** L0 / L1 evidence per character, from resonance-1 */
  resonance: ReadonlyMap<string, readonly SemanticEvidence[]>
  /** axes-1: auxiliary only (§5.4) */
  axes: Meaning | null
  data: DataVersions
}
