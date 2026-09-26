/**
 * Runtime: character → structure, from structure-1 as published. Pure and
 * deterministic: no parsing of IDS, no network, no state; the shards are
 * handed in (a later stage fetches them the way axes-1 is fetched).
 *
 * Not finding a character is a result, not an error, and never a made-up
 * structure. A character whose IDS the table could not make into a structure
 * says why.
 */
import type { CharStructure } from '../types/structure'
import type { StructureEntry, StructureManifest, StructureShard } from './table'

export type StructureLookup =
  | { status: 'found'; char: string; structure: CharStructure; entry: StructureEntry }
  | { status: 'unparsed'; char: string; reason: 'unsupported-operator' | 'malformed'; entry: StructureEntry }
  | { status: 'not-found'; char: string }

/** the shard a character lives in (the table's own rule: code point mod count) */
export const shardIndex = (char: string, count: number): number => char.codePointAt(0)! % count

export interface StructureIndex {
  readonly manifest: StructureManifest
  lookup(char: string): StructureLookup
}

/**
 * An index over the table. `shards` must be every shard, in shard order; a
 * missing or extra shard is a broken table and is refused here, not later.
 */
export function structureIndex(manifest: StructureManifest, shards: readonly StructureShard[]): StructureIndex {
  if (shards.length !== manifest.shards.count) throw new Error(`structure-1: ${shards.length} shards for ${manifest.shards.count}`)
  return {
    manifest,
    lookup(char: string): StructureLookup {
      // one character: a grapheme cluster of one code point
      if (!char || [...char].length !== 1) return { status: 'not-found', char }
      const shard = shards[shardIndex(char, manifest.shards.count)]
      const entry = Object.prototype.hasOwnProperty.call(shard.entries, char) ? shard.entries[char] : undefined
      if (!entry) return { status: 'not-found', char }
      if (entry.status === 'unsupported-operator' || entry.status === 'malformed') return { status: 'unparsed', char, reason: entry.status, entry }
      if (!entry.structure) return { status: 'not-found', char }
      return { status: 'found', char, structure: entry.structure, entry }
    },
  }
}
