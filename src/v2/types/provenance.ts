/**
 * Where every fact of a v2 page comes from (spec-1 §0 R2, §11.3).
 *
 * A v2 generator version is pinned to fixed data tables; every piece of
 * evidence names the table row, the unchanged v1 module, the named rule, the
 * named constant or the auxiliary axis it was read from. Nothing on a page may
 * rest on a fact that cannot be traced back to one of these.
 */
import type { SemanticAxis } from '../../language/semantic/axes'
import type { ConstName } from '../spec'

/** the fixed data tables a v2 generator version is pinned to (§11.3) */
export type DataTableId = 'structure-1' | 'align-1' | 'resonance-1' | 'axes-1'

export interface DataVersion<K extends DataTableId = DataTableId> {
  id: K
  /** sha256 of the published table, recorded when the table is frozen */
  sha256: string
}

export type DataVersions = { readonly [K in DataTableId]: DataVersion<K> }

/** the v1 modules v2 observes through, unchanged (§2.1) */
export type V1Module =
  | 'title'
  | 'language/analysis'
  | 'language/segment'
  | 'language/morae'
  | 'language/phonology'
  | 'glyph/metrics'
  | 'glyph/parts'
  | 'glyph/interior'
  | 'glyph/relation'

/** a named v2 rule: a selection gate, a constraint rule, a plan rule or a geometry rule */
export type RuleRef = `gate:${string}` | `constraint:${string}` | `plan:${string}` | `geometry:${string}` | `resonance:${string}`

export type Provenance =
  /** a row of a fixed data table */
  | { kind: 'table'; table: DataTableId; key: string }
  /** a reading made by an unchanged v1 module */
  | { kind: 'v1'; module: V1Module; detail?: string }
  /** derived by a named v2 rule from other facts */
  | { kind: 'rule'; rule: RuleRef }
  /** a named constant of the spec (appendix A) */
  | { kind: 'const'; name: ConstName }
  /** an auxiliary continuous quantity (§5.4): never a reason for a Discovery */
  | { kind: 'aux'; table: 'axes-1'; axis: SemanticAxis }

/** what kind of observation a piece of evidence is */
export type EvidenceKind = 'structure' | 'ink' | 'lexicon' | 'sound'

export type EvidenceId = `ev:${string}`

/**
 * One observed fact a Discovery rests on. spec-1 §3 writes `source: string`;
 * it is a Provenance here, so that the source can be followed, not only read.
 */
export interface Evidence {
  id: EvidenceId
  kind: EvidenceKind
  provenance: Provenance
  detail: string
  value?: number
}
