/**
 * Build time only: which of a character's regional IDS the table takes.
 *
 * BabelStone's source letters (IDS.TXT header, note 1 and note 2):
 *   J    the IDS of the Japanese source glyph of the character itself;
 *   [J]  a virtual Japanese form: the form the character takes as a component in other Japanese
 *        characters, or the Japanese form where the Japanese source has no reference of its own.
 *
 * Canonical rule (independent of the source's line order and of any map's order):
 *   for a character's own structure — plain J, else [J], else all;
 *   for a component opened inside another character — [J], else plain J, else all;
 *   within that pool: one that parses before one that does not; the fewest unencoded components;
 *   the fewest tokens; the IDS by code point; the source letters.
 * An unencoded component of the selected IDS is never overwritten: when another region's IDS has
 * the same shape everywhere else, what it has there is recorded beside it as a supplement.
 */
import type { RegionalIds } from '../table'
import { isUnknown, tokens } from './ids'

/** regions nearest the Japanese forms first; used only to order supplements */
export const REGION_ORDER = 'JTHKGVPUSBMX'

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)
const unknowns = (ids: string) => tokens(ids).filter(isUnknown).length
const parseRank = (p: RegionalIds['parse']) => (p === 'ok' || p === 'atomic' ? 0 : 1)

/** the plain and the bracketed (virtual) source letters of a field: 'GH[M]TJV[U][B]' → {GHTJV, MUB} */
export function regionsOf(regions: string): { plain: string; virtual: string } {
  const virtual = [...regions.matchAll(/\[([A-Z]+)\]/g)].map((m) => m[1]).join('')
  const plain = regions.replace(/\[[A-Z]+\]/g, '')
  return { plain, virtual }
}

/** one `^IDS$(REGIONS)` field of a BabelStone line; null for the other kinds of field */
export function readField(field: string): { ids: string; regions: string } | null {
  const m = /^\^(.+)\$\(([A-Z[\]]+)\)$/u.exec(field)
  return m ? { ids: m[1], regions: m[2] } : null
}

export function canonicalOrder(a: RegionalIds, b: RegionalIds): number {
  return (
    parseRank(a.parse) - parseRank(b.parse) ||
    unknowns(a.ids) - unknowns(b.ids) ||
    tokens(a.ids).length - tokens(b.ids).length ||
    cmp(a.ids, b.ids) ||
    cmp(a.regions, b.regions)
  )
}

export type Japanese = 'plain' | 'virtual' | 'none'

export function select(candidates: readonly RegionalIds[], use: 'self' | 'component' = 'self'): { chosen: RegionalIds; japanese: Japanese } | null {
  if (candidates.length === 0) return null
  const plain = candidates.filter((c) => regionsOf(c.regions).plain.includes('J'))
  const virtual = candidates.filter((c) => regionsOf(c.regions).virtual.includes('J'))
  const tiers: [RegionalIds[], Japanese][] = use === 'self'
    ? [[plain, 'plain'], [virtual, 'virtual'], [[...candidates], 'none']]
    : [[virtual, 'virtual'], [plain, 'plain'], [[...candidates], 'none']]
  for (const [pool, japanese] of tiers) {
    if (pool.length) return { chosen: [...pool].sort(canonicalOrder)[0], japanese }
  }
  return null
}

/** the rank of a set of source letters by REGION_ORDER (its nearest letter, plain or virtual) */
export function regionRank(regions: string): number {
  let best = REGION_ORDER.length
  for (const r of regions.replace(/[[\]]/g, '')) {
    const i = REGION_ORDER.indexOf(r)
    if (i >= 0 && i < best) best = i
  }
  return best
}
