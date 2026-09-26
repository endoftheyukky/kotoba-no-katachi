/**
 * The fixed tables a title needs (spec-1 §11.3), read shard by shard.
 *
 * structure-1, align-1 and resonance-1 are made offline and frozen: what exists in a character, where it
 * stands in the reading face, what a resource says of it. At run time nothing in them is computed; a title
 * reads only the shards of the characters it can reach — its own, and every component their structures name,
 * followed down (淋 → 林 → 木) — the way v1 reads axes-1 by the title's characters.
 *
 * A shard a title did not read is not an empty shard: asking it anything is an error, never "not found".
 * So a page composed from the shards it read is the page the whole table would give, or no page at all.
 */
import type { AlignIndex } from '../align/lookup'
import { alignIndex } from '../align/lookup'
import type { AlignManifest, AlignShard } from '../align/table'
import { resonanceIndex, type ResonanceIndex, type ResonanceManifest, type ResonanceShard } from '../resonance'
import { structureIndex, type StructureIndex } from '../structure/lookup'
import type { StructureManifest, StructureShard } from '../structure/table'
import type { IdsNode } from '../types/structure'

export type TableId = 'structure-1' | 'align-1' | 'resonance-1'

/** where the tables are read from: the site (fetch) or, in the tests and tools, the files */
export interface TableSource {
  manifest(id: TableId): Promise<unknown>
  shard(id: TableId, file: string): Promise<unknown>
}

export interface TitleTables {
  structure: StructureIndex
  align: AlignIndex
  resonance: ResonanceIndex
  /** every character the title can reach (its own and their components), in code point order */
  chars: readonly string[]
  /** the shards read, per table */
  read: Readonly<Record<TableId, readonly number[]>>
}

type Sharded = { shards: { count: number; files: readonly { name: string }[] } }

const shardOf = (char: string, count: number) => char.codePointAt(0)! % count

/** a shard not read for this title: any question put to it is a mistake in what was read */
function unread(id: TableId, n: number): { entries: never } {
  return {
    get entries(): never {
      throw new Error(`${id}: shard ${n} was not read for this title`)
    },
  }
}

class Shards<S> {
  private got = new Map<number, S>()
  constructor(
    readonly id: TableId,
    readonly manifest: Sharded,
    private source: TableSource,
  ) {}
  async need(chars: Iterable<string>) {
    const want = [...new Set([...chars].map((c) => shardOf(c, this.manifest.shards.count)))].filter((n) => !this.got.has(n)).sort((a, b) => a - b)
    const read = await Promise.all(want.map((n) => this.source.shard(this.id, this.manifest.shards.files[n].name) as Promise<S>))
    want.forEach((n, i) => this.got.set(n, read[i]))
  }
  all(): S[] {
    return Array.from({ length: this.manifest.shards.count }, (_, n) => this.got.get(n) ?? (unread(this.id, n) as unknown as S))
  }
  read(): number[] {
    return [...this.got.keys()].sort((a, b) => a - b)
  }
}

function leaves(n: IdsNode, out: Set<string>) {
  if (n.kind === 'leaf') out.add(n.char)
  else for (const c of n.children) leaves(c, out)
}

/** the tables for a title's characters: every shard they can reach, and no other */
export async function tablesFor(own: readonly string[], source: TableSource): Promise<TitleTables> {
  const [sm, am, rm] = (await Promise.all((['structure-1', 'align-1', 'resonance-1'] as const).map((id) => source.manifest(id)))) as [StructureManifest, AlignManifest, ResonanceManifest]
  const S = new Shards<StructureShard>('structure-1', sm, source)
  // what the title can reach: its characters and their components, followed down until nothing new appears
  const reach = new Set<string>()
  let frontier = [...new Set(own.filter((c) => [...c].length === 1))]
  while (frontier.length) {
    for (const c of frontier) reach.add(c)
    await S.need(frontier)
    const index = structureIndex(sm, S.all())
    const next = new Set<string>()
    for (const c of frontier) {
      const r = index.lookup(c)
      if (r.status !== 'found') continue
      const found = new Set<string>()
      leaves(r.structure.tree, found)
      // an unencoded component another region's IDS names (州: ⿲丶丶丶): the characters of that name
      for (const s of r.entry.supplements) for (const ch of s.named) if (ch.codePointAt(0)! < 0x2ff0 || ch.codePointAt(0)! > 0x2fff) found.add(ch)
      for (const l of found) if (!reach.has(l) && [...l].length === 1) next.add(l)
    }
    frontier = [...next]
  }
  const chars = [...reach].sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!)
  const A = new Shards<AlignShard>('align-1', am, source)
  const R = new Shards<ResonanceShard>('resonance-1', rm, source)
  await Promise.all([A.need(chars), R.need(chars)])
  return {
    structure: structureIndex(sm, S.all()),
    align: alignIndex(am, A.all()),
    resonance: resonanceIndex(rm, R.all()),
    chars,
    read: { 'structure-1': S.read(), 'align-1': A.read(), 'resonance-1': R.read() },
  }
}

/** the site's tables: fetched once per visit, from the site itself (no outside service) */
export function fetchSource(base: string): TableSource {
  const cache = new Map<string, Promise<unknown>>()
  const get = (url: string) => {
    let p = cache.get(url)
    if (!p) {
      p = fetch(url).then((r) => {
        if (!r.ok) throw new Error(`${url}: ${r.status}`)
        return r.json() as Promise<unknown>
      })
      // a failed read is not kept: the next page asks again
      p.catch(() => cache.delete(url))
      cache.set(url, p)
    }
    return p
  }
  return {
    manifest: (id) => get(`${base}v2/${id}/manifest.json`),
    shard: (id, file) => get(`${base}v2/${id}/${file}`),
  }
}
