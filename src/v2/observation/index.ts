/**
 * Observation at run time (spec-1 §2): the title read as facts with their sources, before anything is found
 * in it. Two kinds of fact, and who is responsible for each:
 *
 *   offline, fixed (§11.3)         structure-1  what exists in a character (the IDS, normalised)
 *                                  align-1      where it stands in the reading face (made once, in the face)
 *                                  resonance-1  what a resource says of a character (WordNet, chiVe rows)
 *                                  axes-1       v1's nine axes, auxiliary only
 *   at run time, per title         language     v1 analyzeLanguage: graphemes, tokens, morae, phonology,
 *                                               the lexical relations (unchanged)
 *                                  relations    v1 readRelations between the title's own glyphs, measured in
 *                                               the face the page is drawn in (the only ink read at run time)
 *                                  lookups      the rows of the fixed tables for the characters the title
 *                                               reaches (observation/tables.ts): read, never computed
 *
 * Nothing here chooses, weighs or speaks of the page. `observe` is pure: the caller measures and fetches.
 *
 * §2.3 names per-character SemanticEvidence among the observations; since Stage 5 evidence answers a
 * selected Discovery (it is Semantic Resonance's output), so the observation holds resonance-1's rows — the
 * facts — and the evidence is made from them after Selection.
 */
import type { GlyphRelation } from '../../glyph/relation'
import type { LanguageAnalysis } from '../../language/analysis'
import type { Meaning } from '../../language/semantic/axes'
import type { TitleInput } from '../../title'
import type { AlignEntry } from '../align/table'
import type { ResonanceRow } from '../resonance'
import type { DataVersions } from '../types/provenance'
import type { CharStructure } from '../types/structure'
import type { TitleTables } from './tables'

export interface RuntimeObservation {
  input: TitleInput
  /** v1 analyzeLanguage, unchanged */
  language: LanguageAnalysis
  /** v1 readRelations between the title's own characters, in the reading face */
  titleRelations: readonly GlyphRelation[]
  /** axes-1 for the whole title: auxiliary only (§5.4); null where it was not read */
  axes: Meaning | null
  /** the fixed tables, as far as the title reaches into them */
  tables: TitleTables
  /** per character the title reaches: its structure, its ink (align-1), its resonance-1 row */
  structure: ReadonlyMap<string, CharStructure | null>
  ink: ReadonlyMap<string, AlignEntry | null>
  resonance: ReadonlyMap<string, ResonanceRow | null>
  data: DataVersions
}

export interface ObserveArgs {
  input: TitleInput
  language: LanguageAnalysis
  titleRelations: readonly GlyphRelation[]
  axes: Meaning | null
  tables: TitleTables
  /** the id and sha256 of axes-1 as published */
  axesVersion?: string
}

export function observe(a: ObserveArgs): RuntimeObservation {
  const t = a.tables
  const structure = new Map<string, CharStructure | null>()
  const ink = new Map<string, AlignEntry | null>()
  const resonance = new Map<string, ResonanceRow | null>()
  for (const c of t.chars) {
    const s = t.structure.lookup(c)
    structure.set(c, s.status === 'found' ? s.structure : null)
    ink.set(c, t.align.entry(c))
    resonance.set(c, t.resonance.row(c))
  }
  return {
    input: a.input,
    language: a.language,
    titleRelations: a.titleRelations,
    axes: a.axes,
    tables: t,
    structure,
    ink,
    resonance,
    data: {
      'structure-1': { id: 'structure-1', sha256: t.structure.manifest.sha256 },
      'align-1': { id: 'align-1', sha256: t.align.manifest.sha256 },
      'resonance-1': { id: 'resonance-1', sha256: t.resonance.manifest.sha256 },
      'axes-1': { id: 'axes-1', sha256: a.axesVersion ?? 'v1' },
    },
  }
}
