/**
 * Runtime: (whole character, structure path) → where that component lies in
 * the reading face, from align-1 as published. Pure and deterministic: no
 * browser, no canvas, no template matching, no network; the shards are handed
 * in (a later stage fetches them the way axes-1 is fetched).
 *
 * Every answer says which of four it is. `not-found` means align-1 has no row
 * for it (the character is not in the table, or the path is not in its
 * structure). `unavailable`, `approximate` and `aligned` are rows: the
 * component exists (structure-1 says so) and the row says how much of its
 * geometry can be used — none, with care, or as it is.
 */
import type { InkPlacement, Island } from '../types/observation'
import type { AlignEntry, AlignManifest, AlignRow, AlignShard, ApproximateReason, UnavailableReason } from './table'

export type AlignLookup =
  | { status: 'not-found'; char: string; path: string; reason: 'not-in-table' | 'no-such-path' | 'atomic' | 'no-structure' }
  | { status: 'unavailable'; char: string; path: string; reason: UnavailableReason; row: AlignRow; entry: AlignEntry }
  | { status: 'approximate'; char: string; path: string; because: readonly ApproximateReason[]; row: AlignRow; entry: AlignEntry }
  | { status: 'aligned'; char: string; path: string; row: AlignRow; entry: AlignEntry }

/** the shard a character lives in (the table's own rule: code point mod count) */
export const shardIndex = (char: string, count: number): number => char.codePointAt(0)! % count

export interface AlignIndex {
  readonly manifest: AlignManifest
  /** the character's entry, or null when align-1 has none */
  entry(char: string): AlignEntry | null
  /** one component of a character, by its path in structure-1's tree ('0', '1', '1.0' …) */
  at(char: string, path: string): AlignLookup
  /** every row of a character, in path order (none when it is not in the table) */
  all(char: string): readonly AlignLookup[]
}

/**
 * An index over the table. `shards` must be every shard, in shard order; a
 * missing or extra shard is a broken table and is refused here, not later.
 */
export function alignIndex(manifest: AlignManifest, shards: readonly AlignShard[]): AlignIndex {
  if (shards.length !== manifest.shards.count) throw new Error(`align-1: ${shards.length} shards for ${manifest.shards.count}`)
  const entry = (char: string): AlignEntry | null => {
    if (!char || [...char].length !== 1) return null
    const shard = shards[shardIndex(char, manifest.shards.count)]
    return Object.prototype.hasOwnProperty.call(shard.entries, char) ? shard.entries[char] : null
  }
  const answer = (char: string, e: AlignEntry, row: AlignRow): AlignLookup => {
    const path = row.path
    if (row.status === 'unavailable') return { status: 'unavailable', char, path, reason: row.because[0] as UnavailableReason, row, entry: e }
    if (row.status === 'approximate') return { status: 'approximate', char, path, because: row.because as readonly ApproximateReason[], row, entry: e }
    return { status: 'aligned', char, path, row, entry: e }
  }
  return {
    manifest,
    entry,
    at(char: string, path: string): AlignLookup {
      const e = entry(char)
      if (!e) return { status: 'not-found', char, path, reason: 'not-in-table' }
      if (e.status === 'atomic' || e.status === 'no-structure') return { status: 'not-found', char, path, reason: e.status }
      const row = e.rows.find((r) => r.path === path)
      if (!row) return { status: 'not-found', char, path, reason: 'no-such-path' }
      return answer(char, e, row)
    },
    all(char: string): readonly AlignLookup[] {
      const e = entry(char)
      return e ? e.rows.map((r) => answer(char, e, r)) : []
    },
  }
}

/** a placed leaf row as Stage 1's InkPlacement (null for a subtree or an unplaced component) */
export function placementOf(row: AlignRow): InkPlacement | null {
  if (!row.transform || !row.box || !row.ink || row.node.kind !== 'leaf') return null
  return {
    term: row.node.char,
    box: row.box,
    sx: row.transform.sx,
    sy: row.transform.sy,
    dx: row.transform.dx,
    dy: row.transform.dy,
    lift: row.ink.lift ?? 0,
    coverage: row.ink.explained,
  }
}

/** what is left of the whole without this component, as Stage 1's CharInk.residue (null when not recorded) */
export function residueOf(row: AlignRow): { share: number; pieces: readonly Island[] } | null {
  if (!row.residual) return null
  return { share: row.residual.share, pieces: row.residual.pieces.map((p) => ({ keep: p.keep, share: p.share, centroid: p.centroid })) }
}
