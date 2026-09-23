/**
 * Distributional neighbours of single kanji (v2d experiment, review only).
 *
 * Two fixed tables, distilled once from fixed resources (data/NOTICE.md):
 *   aozora  characters that keep company in the modern Aozora Bunko texts
 *           (co-occurrence → PPMI → SVD): the company a character keeps in
 *           written literature
 *   chive   single-kanji words of chiVe (word2vec on web text): what a word
 *           is used like
 * Nothing is fetched when a page is composed and nothing is drawn at random:
 * the same head always has the same neighbours, in the same order. The
 * tables are loaded only when asked for, so a page that does not use them
 * never carries them.
 */
export type VecSource = 'aozora' | 'chive'

export interface Neighbour {
  char: string
  /** cosine, two decimals */
  cos: number
}

interface Table {
  meta: { id: string; source: string; license: string; method: string }
  n: Record<string, string>
}

const tables: Partial<Record<VecSource, Table>> = {}
const parsed = new Map<string, Neighbour[]>()

/** load both tables (once); until then there are no neighbours */
export async function loadNeighbours(): Promise<void> {
  if (!tables.aozora) tables.aozora = (await import('./data/aozora-v0.json')).default as Table
  if (!tables.chive) tables.chive = (await import('./data/chive-v0.json')).default as Table
}

export const neighboursLoaded = () => !!tables.aozora && !!tables.chive

export function tableId(source: VecSource): string {
  return tables[source]?.meta.id ?? source
}

/** the nearest kanji to a head, nearest first (at most 24), or none */
export function neighbours(source: VecSource, head: string): Neighbour[] {
  const key = `${source}:${head}`
  const hit = parsed.get(key)
  if (hit) return hit
  const run = tables[source]?.n[head]
  const out: Neighbour[] = []
  if (run) {
    const cs = Array.from(run)
    for (let i = 0; i + 2 < cs.length; i += 3) out.push({ char: cs[i], cos: Number(cs[i + 1] + cs[i + 2]) / 100 })
  }
  parsed.set(key, out)
  return out
}
