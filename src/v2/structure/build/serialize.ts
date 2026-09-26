/**
 * Build time only: canonical serialisation. Object keys sorted by UTF-16 code
 * unit, no whitespace inside an entry, one entry per line, entries by code
 * point — so the same table is always the same bytes.
 */

export function canonical(v: unknown): string {
  if (v === null || typeof v !== 'object') {
    if (typeof v === 'number' && !Number.isFinite(v)) throw new Error('not a finite number')
    if (v === undefined) throw new Error('undefined in a table')
    return JSON.stringify(v)
  }
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']'
  const keys = Object.keys(v as object).filter((k) => (v as Record<string, unknown>)[k] !== undefined).sort()
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonical((v as Record<string, unknown>)[k])).join(',') + '}'
}

/** order characters by code point (not by UTF-16 unit: 𤣩 after 龜) */
export const byCodePoint = (a: string, b: string): number => a.codePointAt(0)! - b.codePointAt(0)!

/** a shard: {"entries":{ … }} with one entry per line, by code point */
export function shardText(entries: ReadonlyMap<string, unknown>): string {
  const keys = [...entries.keys()].sort(byCodePoint)
  const lines = keys.map((k) => JSON.stringify(k) + ':' + canonical(entries.get(k)))
  return '{"entries":{\n' + lines.join(',\n') + '\n}}\n'
}

export const shardOf = (char: string, count: number): number => char.codePointAt(0)! % count
