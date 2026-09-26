/**
 * What Discovery reads (spec-1 §2 Observation, the part the Discovery stage
 * needs): the title as v1 analyses it, the fixed tables, and v1's readings of
 * the title's glyphs against each other. All handed in; nothing is fetched,
 * measured or guessed here, so the stage is pure and deterministic.
 *
 * structure-1 is the truth of what exists. align-1 is a geometry observation:
 *   aligned      its geometry may support a geometry-sensitive reading
 *   approximate  never a reason to deny a component; not used where a reading depends strongly on position
 *   unavailable  no geometry; the component still exists
 */
import type { GlyphRelation } from '../../glyph/relation'
import type { LanguageAnalysis } from '../../language/analysis'
import type { AlignIndex } from '../align/lookup'
import type { StructureIndex } from '../structure/lookup'

export interface DiscoveryInput {
  /** v1 analyzeLanguage, unchanged */
  language: LanguageAnalysis
  structure: StructureIndex
  align: AlignIndex
  /** v1 readRelations between the title's own characters (containment, similarity) */
  relations: readonly GlyphRelation[]
}
