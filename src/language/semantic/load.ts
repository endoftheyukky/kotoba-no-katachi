/**
 * Reading a title's meaning on the published site.
 *
 * The table (tools/semantic/shard.py) is split by the first character of each
 * word; a title needs only the files of its own characters — every word it can
 * be read as begins at one of them. They are fetched from the site itself (no
 * outside service, nothing computed per request) and kept for the visit.
 *
 * The table is part of what a published generator is: `axes-1` belongs to the
 * generator published as v=3 and is never changed. If it cannot be read, the
 * page is not written — a page without its meaning would be a different poem
 * at the same address.
 */
import { meaningOf, parseTable, type Meaning, type MeaningTable } from './axes'

export const MEANING_TABLE = 'axes-1'
const SHARDS = 64

const shards = new Map<number, Promise<string>>()

function shardOf(char: string): number {
  return (char.codePointAt(0) ?? 0) % SHARDS
}

function fetchShard(n: number, base: string): Promise<string> {
  let p = shards.get(n)
  if (!p) {
    p = fetch(`${base}${String(n).padStart(2, '0')}.tsv`).then((r) => {
      if (!r.ok) throw new Error(`meaning table ${MEANING_TABLE}/${n}: ${r.status}`)
      return r.text()
    })
    // a failed read is not kept: the next poem asks again
    p.catch(() => shards.delete(n))
    shards.set(n, p)
  }
  return p
}

/** the meaning of the title, read from the published table */
export async function readMeaning(title: string, base = `${import.meta.env.BASE_URL}semantic/${MEANING_TABLE}/`): Promise<Meaning> {
  const needed = [...new Set([...title].filter((c) => c.trim()).map(shardOf))].sort((a, b) => a - b)
  const texts = await Promise.all(needed.map((n) => fetchShard(n, base)))
  const table: MeaningTable = parseTable(MEANING_TABLE, texts.join('\n'))
  return meaningOf(title, table)
}
