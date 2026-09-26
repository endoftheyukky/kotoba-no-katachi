/**
 * resonance-1: typed semantic evidence per character (spec-1 §5, §11.3),
 * written by tools/v2/resonance.py from fixed resources (Japanese WordNet,
 * chiVe). Rows are facts a resource states (L0) or a fixed schema's percentile
 * (L1, used only paired with the structure type it agrees with). Nothing here
 * is a score of a word, and nothing is L2 or L3.
 */
import type { SchemaName } from '../types/resonance'

export type WordNetRelation = 'is-a' | 'part-of' | 'has-part' | 'has-member' | 'member-of' | 'made-of' | 'substance-of'

/** a WordNet path: [from synset, relation, to synset] per link */
export type WordNetPath = readonly (readonly [string, WordNetRelation, string])[]

export interface ResonanceRow {
  char: string
  /** L0 A: the character's word has-part / has-member (one link) */
  partReferent?: readonly { relation: 'has-part' | 'has-member'; unit: string; lemmas: readonly string[]; path: WordNetPath }[]
  /** L0: a variant component (氵) and the character it is a form of (水), reached by one or two typed links */
  radicalMeaning?: readonly { radical: string; meaning: string; relation: 'is-a' | 'made-of' | 'has-part'; path: WordNetPath }[]
  /** L0 E: one or two typed links to a schema's concept word */
  schemaDirect?: readonly { schema: SchemaName; concept: string; path: WordNetPath }[]
  /** L1 E: percentiles on the active schemas (absent: the character is not in chiVe) */
  schema?: Readonly<Partial<Record<SchemaName, number>>>
}

export interface ResonanceShard {
  entries: Readonly<Record<string, ResonanceRow>>
}

export interface ResonanceManifest {
  id: 'resonance-1'
  spec: 'spec-1'
  generator: { tool: string; version: string }
  sources: readonly { name: string; url: string; version: Readonly<Record<string, string>>; sha256: string; use: string; license?: string }[]
  distances: { L0: string; L1: string }
  excluded: string
  pending: { todo: string; types: readonly string[]; why: string }
  schemas: Readonly<Record<SchemaName, { anchors: readonly string[]; concepts: readonly string[] }>>
  active: readonly SchemaName[]
  l1: { min: number; population: string; vectors: string; percentile: string }
  rules: Readonly<Record<string, string>>
  shards: { count: number; of: string; files: readonly { name: string; entries: number; bytes: number; sha256: string }[] }
  counts: Readonly<Record<string, number>>
  sha256: string
}
