/**
 * structure-1: the fixed table of character structure (spec-1 §2.2, §11.3).
 *
 * One entry per character. The entry holds everything the table read and did,
 * so that a structure can always be followed back to its source line: every
 * regional IDS the source gives, the one selected and why, the tree as parsed,
 * the tree as normalised (Stage 1's canonical CharStructure), what another
 * region's IDS names that the Japanese one leaves unencoded — kept apart from
 * what the Japanese form itself shows — and each step normalisation took.
 */
import type { Provenance } from '../types/provenance'
import type { CharStructure, IdsNode } from '../types/structure'

/** BabelStone's source letters for one IDS (G H T J K P V U S B M X …), as written */
export type Regions = string

export type ParseStatus = 'ok' | 'atomic' | 'unsupported-operator' | 'malformed'

export interface RegionalIds {
  ids: string
  regions: Regions
  parse: ParseStatus
}

/** an unencoded component of the selected (Japanese) IDS, named by another region's IDS of the same shape */
export interface Supplement {
  /** the unknown leaf's path in the parsed tree ('' is the root, '1.0' the first child of the second child) */
  path: string
  unknown: string
  /** what the other region's IDS has in that place */
  named: string
  from: Regions
  provenance: Provenance
}

export type NormalizationStep =
  /** a component with no reading of its own, replaced by its own structure */
  | { kind: 'open-component'; path: string; char: string; ids: string }
  /** a component that would open into itself: kept as it is */
  | { kind: 'cycle-stop'; path: string; char: string }
  /** a component deeper than the limit: kept as it is */
  | { kind: 'depth-stop'; path: string; char: string }

export type EntryStatus =
  /** the character has a structure */
  | 'decomposed'
  /** the source describes the character as itself */
  | 'atomic'
  /** the selected IDS uses an operator outside spec-1's IdsOperator (⿼ ⿽ ⿾ ⿿ ㇯): no structure is made up */
  | 'unsupported-operator'
  /** the selected IDS does not parse */
  | 'malformed'

export interface StructureEntry {
  char: string
  status: EntryStatus
  /** japanese: plain — the Japanese glyph's own IDS (J); virtual — the Japanese form as a component ([J]); none — another region's */
  selected: { ids: string; regions: Regions; japanese: 'plain' | 'virtual' | 'none' }
  /** every IDS the source gives the character, in the source's order */
  candidates: readonly RegionalIds[]
  /** the selected IDS as parsed, tiers assigned, nothing opened; null unless it parsed */
  parsed: IdsNode | null
  /** the canonical structure (normalised tree); null unless decomposed or atomic */
  structure: CharStructure | null
  supplements: readonly Supplement[]
  normalization: readonly NormalizationStep[]
}

/** a form that corresponds to a character without being it (囗 and 口 are different characters) */
export interface FormCorrespondence {
  form: string
  /** written-as: the same shape, another code point (囗 → 口); variant-of: the form a character takes as a radical (氵 → 水) */
  kind: 'written-as' | 'variant-of'
  chars: readonly string[]
}

export interface SourceMeta {
  name: string
  url: string
  /** what the file says of itself */
  version: Readonly<Record<string, string>>
  /** of the file exactly as read (for a .gz, the compressed file) */
  sha256: string
  use: string
}

export interface StructureManifest {
  id: 'structure-1'
  spec: 'spec-1'
  generator: { tool: string; version: string }
  sources: readonly SourceMeta[]
  /** which characters the table holds */
  coverage: string
  selection: string
  normalization: { maxDepth: number; rules: readonly string[] }
  tiers: { character: string; stroke: readonly string[]; variant: string; component: string; unknown: string }
  forms: readonly FormCorrespondence[]
  shards: { count: number; of: string; files: readonly { name: string; entries: number; bytes: number; sha256: string }[] }
  entries: number
  status: Readonly<Record<EntryStatus, number>>
  /** characters of the scope the source has no IDS for: not in the table (a lookup says not-found), by code point */
  absent: readonly string[]
  /** sha256 of the shard hashes, in shard order */
  sha256: string
}

/** a shard as it is published: entries by character */
export interface StructureShard {
  entries: Readonly<Record<string, StructureEntry>>
}
