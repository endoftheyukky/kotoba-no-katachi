/**
 * A lexicon: categories of characters and typed relations between them.
 *
 * Semantic material is the one kind of derived material the title does not
 * already hold, so it is kept apart and kept small: it is read only from a
 * resource bundled with the work (seed.ts), by relations whose kind is named,
 * and in a fixed order. There is no generated text and no model: the same
 * character always has the same relations, and a title always gets the same
 * few of them.
 *
 * Relations, from a head to a related character:
 *   made-of   what the head is made of          雨 → 水
 *   part      a part of the head                木 → 枝
 *   unit      what the head comes in units of   雨 → 滴
 *   source    where the head comes from         雨 → 雲
 *   becomes   what the head turns into next     芽 → 花
 *   organ     the organ an action is done with  見 → 目
 *   with      what is there with the head       夜 → 月
 *   yields    what the head gives off           火 → 煙
 *   opposite  the other of a pair               光 ↔ 闇
 * Each is also read from the other end: 水 is what 雨 is made of, so 雨 is a
 * whole 水 makes (whole); 花 becomes 実, so 実 was 花 (was).
 *
 * How near a relation is (its rank: inside, beside, before or after) decides
 * the order material is taken in; the most remote ones (a whole, a use, an
 * opposite) are recorded but never taken: they explain rather than accompany.
 */
import { SEED_LEXICON, SEED_LEXICON_VERSION } from './seed'

export type LexRelation =
  | 'made-of'
  | 'part'
  | 'unit'
  | 'source'
  | 'becomes'
  | 'organ'
  | 'with'
  | 'yields'
  | 'opposite'
  | 'whole'
  | 'was'
  | 'use'

export interface Category {
  id: string
  title: string
  members: Set<string>
}

export interface LexLink {
  char: string
  relation: LexRelation
  /** 0 nearest … 3 most remote */
  rank: number
}

export interface Lexicon {
  version: string
  categories: Category[]
  links: Map<string, LexLink[]>
}

/**
 * How near: what is inside the thing (what it is made of, its parts, its
 * units), then what is beside it at the same moment (what is there with it,
 * the organ an action is done with), then what is before or after it (where
 * it comes from, what it becomes, what it gives off). A whole, a use and an
 * opposite are further than material can go.
 */
const RANK: Record<LexRelation, number> = {
  'made-of': 0,
  part: 0,
  unit: 0,
  with: 1,
  organ: 1,
  source: 2,
  becomes: 2,
  was: 2,
  yields: 2,
  whole: 3,
  use: 3,
  opposite: 3,
}

const INVERSE: Record<LexRelation, LexRelation> = {
  'made-of': 'whole',
  part: 'whole',
  unit: 'whole',
  source: 'yields',
  yields: 'source',
  becomes: 'was',
  was: 'becomes',
  organ: 'use',
  use: 'organ',
  with: 'with',
  opposite: 'opposite',
  whole: 'part',
}

/** the most remote relation that may give material */
export const MAX_RANK = 2

export function parseLexicon(text: string, version: string): Lexicon {
  const categories: Category[] = []
  const links = new Map<string, LexLink[]>()
  const add = (head: string, char: string, relation: LexRelation) => {
    if (head === char) return
    const list = links.get(head) ?? []
    if (!list.some((l) => l.char === char && l.relation === relation)) list.push({ char, relation, rank: RANK[relation] })
    links.set(head, list)
  }
  const inverse: [string, string, LexRelation][] = []
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim()
    if (!line) continue
    const cat = /^@(\S+)\s+([^:]+):\s*(.+)$/.exec(line)
    if (cat) {
      categories.push({ id: cat[1], title: cat[2].trim(), members: new Set(Array.from(cat[3].replace(/\s/g, ''))) })
      continue
    }
    const [head, ...rest] = line.split(/\s+/)
    for (const r of rest) {
      const [name, chars] = r.split(':')
      if (!(name in RANK) || !chars) throw new Error(`lexicon: cannot read「${r}」in「${line}」`)
      for (const c of Array.from(chars)) {
        add(head, c, name as LexRelation)
        inverse.push([c, head, INVERSE[name as LexRelation]])
      }
    }
  }
  // what is stated from one end is also read from the other, after it
  for (const [head, char, relation] of inverse) add(head, char, relation)
  return { version, categories, links }
}

let seed: Lexicon | null = null
export function seedLexicon(): Lexicon {
  return (seed ??= parseLexicon(SEED_LEXICON, SEED_LEXICON_VERSION))
}

/** the vowels a reading is reduced to */
export const VOWEL_KANA = Array.from('あいうえおん')

/**
 * Every character a derived mark could be written in for a title of these
 * characters, beyond the characters themselves: the vowels, and whatever the
 * lexicon relates to them closely enough to give material. The glyphs are
 * prepared before a page is composed, so composing stays synchronous.
 */
export function derivableChars(chars: readonly string[], lex: Lexicon = seedLexicon()): string[] {
  const out = new Set(VOWEL_KANA)
  for (const c of chars) for (const l of lex.links.get(c) ?? []) if (l.rank <= MAX_RANK) out.add(l.char)
  return [...out]
}
