/**
 * The sound of the title, as far as the writing lets us read it.
 *
 * Three kinds of feature only, and each is taken because the sound already
 * has a structure that can be seen — never because a sound is mapped to a
 * shape. There is no table here that says /a/ is large or k is to the right.
 *
 *   voicing  a kana carries a voicing mark: ぜ is せ with two dots. The
 *            phonological relation (voiced / unvoiced) and the written one
 *            (the mark) are the same relation. This is read from the
 *            character's own canonical decomposition, not looked up in a
 *            table of pairs and not imported from outside the title.
 *   special  っ ん ー: morae that hold a beat without an ordinary vowel.
 *   echo     the same mora, vowel or consonant returning — but only when it
 *            is marked enough not to be an accident of a short title.
 *
 * Thresholds here are heuristics, chosen to keep coincidences out, not
 * measured facts about Japanese.
 */
import { toHiragana } from './kana'
import type { Grapheme, Mora } from './types'

const DAKUTEN = '゙'
const HANDAKUTEN = '゚'

export type PhonologicalFeature =
  /**
   * A kana written with a voicing mark. `base` is the unvoiced character the
   * kana itself decomposes into, so the pair is intrinsic to the grapheme:
   * nothing is fetched from an inventory. When the title also writes the
   * base, the pair is endogenous as well, and the evidence is stronger.
   */
  | {
      kind: 'voicing'
      grapheme: number
      mora: number
      base: string
      voiced: string
      mark: string
      /** graphemes in the title that write the unvoiced partner */
      alsoWritten: number[]
    }
  /** a mora that holds a beat without an ordinary vowel */
  | { kind: 'special'; sub: 'Q' | 'N' | 'R'; mora: number; graphemes: number[] }
  /** the same sound returning, in morae that the title itself writes */
  | {
      kind: 'echo'
      unit: 'mora' | 'vowel' | 'onset'
      value: string
      morae: number[]
      graphemes: number[]
      /** share of all the title's beats that carry it (unread beats included) */
      share: number
      /** how likely a repeat like this is by chance alone in a title this long */
      chance: number
    }

/** roughly how many distinct units each level offers — five vowels repeat by themselves */
const ALPHABET = { mora: 100, onset: 15, vowel: 5 }

/** how marked a repetition must be to count, per level */
const ECHO = {
  /** a repeated mora is already unusual */
  mora: { members: 2, share: 0 },
  /** a consonant must hold most of the word */
  onset: { members: 2, share: 0.6 },
  /** a vowel must hold nearly all of it */
  vowel: { members: 3, share: 0.75 },
}

function chanceOfRepeat(n: number, alphabet: number): number {
  return 1 - Math.exp(-(n * (n - 1)) / (2 * alphabet))
}

const KANA = new Set(['hiragana', 'katakana'])

export function readPhonology(graphemes: readonly Grapheme[], morae: readonly Mora[]): PhonologicalFeature[] {
  const out: PhonologicalFeature[] = []
  const moraOf = (g: number) => morae.find((m) => m.kind !== 'unread' && m.graphemes.includes(g))

  // voicing — from the character's own decomposition. Only a kana the title
  // actually writes can show it: a voiced sound inside a kanji's reading has
  // no character on the page to take the mark off.
  for (const g of graphemes) {
    if (!KANA.has(g.script)) continue
    const d = g.char.normalize('NFD')
    if (d.length !== 2 || (d[1] !== DAKUTEN && d[1] !== HANDAKUTEN)) continue
    const base = d[0].normalize('NFC')
    const alsoWritten = graphemes
      .filter((o) => o.index !== g.index && toHiragana(o.char) === toHiragana(base))
      .map((o) => o.index)
    out.push({
      kind: 'voicing',
      grapheme: g.index,
      mora: moraOf(g.index)?.index ?? -1,
      base,
      voiced: g.char,
      mark: (d[1] === DAKUTEN ? '゛' : '゜'),
      alsoWritten,
    })
  }

  // special morae — already parsed; here only named
  for (const m of morae)
    if (m.kind === 'Q' || m.kind === 'N' || m.kind === 'R')
      out.push({ kind: 'special', sub: m.kind, mora: m.index, graphemes: m.graphemes })

  // echo — grouped over the morae the title lets us read, but measured
  // against all of its beats
  const read = morae.filter((m) => m.kind !== 'unread')
  const group = (unit: 'mora' | 'vowel' | 'onset', key: (m: Mora) => string | null): void => {
    const by = new Map<string, Mora[]>()
    for (const m of read) {
      const k = key(m)
      if (k) by.set(k, [...(by.get(k) ?? []), m])
    }
    const rule = ECHO[unit]
    for (const [value, members] of by) {
      // against every beat of the title, not only the ones we can read: a
      // title written mostly in kanji without a reading must not look like a
      // perfect echo of the two kana it happens to show
      const share = members.length / Math.max(1, morae.length)
      if (members.length < rule.members || share < rule.share) continue
      out.push({
        kind: 'echo',
        unit,
        value,
        morae: members.map((m) => m.index),
        graphemes: [...new Set(members.flatMap((m) => m.graphemes))].sort((x, y) => x - y),
        share,
        chance: chanceOfRepeat(read.length, ALPHABET[unit]),
      })
    }
  }
  group('mora', (m) => m.key || null)
  group('vowel', (m) => m.vowel)
  group('onset', (m) => m.onset || null)
  return out
}
