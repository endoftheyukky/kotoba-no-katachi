/**
 * What a title means, read as a place on a few semantic axes.
 *
 * The meaning is never drawn. It is not a related word, not a symbol, not an
 * illustration: it is a handful of numbers, each saying how far the title leans
 * toward one pole of an axis or the other, and those numbers press on what the
 * page does to the title's own characters (poem/program).
 *
 *   multitude     one, alone              ↔ many, together
 *   agitation     still                   ↔ stirred
 *   enclosure     open                    ↔ closed in
 *   severance     joined                  ↔ severed
 *   vanishing     present, lasting        ↔ fading, gone
 *   distance      near                    ↔ far
 *   weight        light                   ↔ heavy
 *   descent       rising, bright          ↔ falling, dark
 *   abstraction   a thing                 ↔ an idea
 *
 * The table was distilled once from a fixed word-vector file (chiVe v1.3,
 * tools/semantic/axes.py) and is read here as it is: the same title always
 * reads the same. A title is matched against the table's words longest first;
 * a word the table does not know is read through its kanji, which carry
 * meaning of their own (群衆 through 群 and 衆).
 */

export const AXES = [
  'multitude',
  'agitation',
  'enclosure',
  'severance',
  'vanishing',
  'distance',
  'weight',
  'descent',
  'abstraction',
] as const

export type SemanticAxis = (typeof AXES)[number]

export interface Meaning {
  /** each axis, −1 … +1 (0 where nothing was read) */
  axes: Record<SemanticAxis, number>
  /** how much of the title the table could read, 0 … 1 */
  coverage: number
  /** what was read, and how (review only, never drawn) */
  read: { text: string; how: 'word' | 'kanji' }[]
  /** the table the meaning came from */
  table: string
}

const ALPHA = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_'
const CODE = new Map([...ALPHA].map((c, i) => [c, i]))

export interface MeaningTable {
  id: string
  get(word: string): number[] | undefined
}

/** a table in the export format: `word<TAB>nine 6-bit letters`, one per line */
export function parseTable(id: string, text: string): MeaningTable {
  const rows = new Map<string, string>()
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue
    const tab = line.indexOf('\t')
    if (tab > 0) rows.set(line.slice(0, tab), line.slice(tab + 1))
  }
  return {
    id,
    get(word) {
      const code = rows.get(word)
      if (!code) return undefined
      return [...code].map((c) => ((CODE.get(c) ?? 31.5) / 63) * 2 - 1)
    },
  }
}

const isKanji = (c: string) => {
  const cp = c.codePointAt(0) ?? 0
  return (cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3400 && cp <= 0x4dbf) || c === '々'
}
const isHiragana = (s: string) => [...s].every((c) => c >= 'ぁ' && c <= 'ゖ')

export const NO_MEANING = (table = 'none'): Meaning => ({
  axes: Object.fromEntries(AXES.map((k) => [k, 0])) as Record<SemanticAxis, number>,
  coverage: 0,
  read: [],
  table,
})

/**
 * The title's meaning: its words matched longest first against the table, each
 * weighted by its length; a character no word covers is read as a kanji, at
 * less weight, since a kanji alone is a coarser reading than the word it is in.
 * Kana of two characters or fewer that the table does not hold as a word
 * (particles, endings) carry no meaning here.
 */
export function meaningOf(title: string, table: MeaningTable): Meaning {
  const chars = [...title]
  const sums = new Array(AXES.length).fill(0)
  let weight = 0
  let covered = 0
  let content = 0
  const read: Meaning['read'] = []
  for (let i = 0; i < chars.length; ) {
    const c = chars[i]
    if (!c.trim() || /[\p{P}\p{S}\p{N}]/u.test(c)) {
      i++
      continue
    }
    let taken = 0
    for (let len = Math.min(8, chars.length - i); len >= 2; len--) {
      const word = chars.slice(i, i + len).join('')
      if (isHiragana(word) && len <= 2) continue
      const v = table.get(word)
      if (!v) continue
      for (let j = 0; j < AXES.length; j++) sums[j] += v[j] * len
      weight += len
      covered += len
      read.push({ text: word, how: 'word' })
      taken = len
      break
    }
    if (taken) {
      content += taken
      i += taken
      continue
    }
    content++
    if (isKanji(c)) {
      const v = table.get(c)
      if (v) {
        for (let j = 0; j < AXES.length; j++) sums[j] += v[j] * 0.6
        weight += 0.6
        covered += 0.6
        read.push({ text: c, how: 'kanji' })
      }
    }
    i++
  }
  if (!weight) return NO_MEANING(table.id)
  return {
    axes: Object.fromEntries(AXES.map((k, j) => [k, sums[j] / weight])) as Record<SemanticAxis, number>,
    coverage: Math.min(1, covered / Math.max(1, content)),
    read,
    table: table.id,
  }
}
