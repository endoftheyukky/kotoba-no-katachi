/**
 * (dynamic study) The only "NLP" in this prototype: split a word into graphemes and morae
 * and read off a few properties a Japanese speaker hears without thinking —
 * mora count, っ as silence, ー as duration, vowel devoicing, recurrence.
 * Kanji readings are not guessed; they remain unread.
 */
import { KANA, MANNER, SMALL, SMALL_GLIDE, SMALL_VOWEL, VOICELESS, toHiragana } from '../../language/kana'
import { scriptOf } from '../../language/script'
import type { Grapheme, Mora, MoraKind, Script } from '../../language/types'

export interface Word {
  text: string
  graphemes: Grapheme[]
  morae: Mora[]
  /** grapheme index → mora index */
  moraOf: number[]
  /** how often each mora (by key) occurs in the word */
  count: Map<string, number>
  direction: 'vertical' | 'horizontal'
}

export const MAX_GRAPHEMES = 8

export function normalizeWord(input: string): string {
  return Array.from(input.normalize('NFC').replace(/\s+/g, '')).slice(0, MAX_GRAPHEMES).join('')
}

export function analyze(text: string): Word {
  const graphemes: Grapheme[] = Array.from(text).map((char, index) => ({
    index,
    char,
    script: scriptOf(char),
    small: SMALL.has(char),
  }))

  const morae: Mora[] = []
  const moraOf: number[] = []

  const push = (g: Grapheme, kind: MoraKind, fields: Partial<Mora> = {}): void => {
    const onset = fields.onset ?? ''
    morae.push({
      index: morae.length,
      text: g.char,
      key: toHiragana(g.char),
      graphemes: [g.index],
      kind,
      onset,
      manner: MANNER[onset],
      vowel: null,
      palatal: false,
      devoiced: false,
      weight: 1,
      ...fields,
    })
  }

  for (const g of graphemes) {
    const h = toHiragana(g.char)
    const prev = morae[morae.length - 1]

    // small kana join the preceding mora: き+ゃ is one beat, written in two cells
    if (prev?.kind === 'cv' && (h in SMALL_GLIDE || h in SMALL_VOWEL)) {
      prev.text += g.char
      prev.key += h
      prev.graphemes.push(g.index)
      if (h in SMALL_GLIDE) {
        prev.palatal = true
        prev.vowel = SMALL_GLIDE[h]
      } else {
        if (prev.onset === '' && prev.vowel === 'u') {
          prev.onset = 'w'
          prev.manner = MANNER.w
        }
        prev.vowel = SMALL_VOWEL[h]
      }
      moraOf.push(prev.index)
      continue
    }

    moraOf.push(morae.length)
    if (h === 'ー') push(g, 'R', { vowel: prev?.vowel ?? null })
    else if (h === 'っ') push(g, 'Q')
    else if (h === 'ん') push(g, 'N')
    else if (KANA[h]) {
      const [onset, vowel] = KANA[h]
      push(g, 'cv', { onset, manner: MANNER[onset], vowel })
    } else if (h in SMALL_GLIDE || h in SMALL_VOWEL) {
      // a small kana with nothing to lean on is read as its full-size vowel
      const vowel = SMALL_GLIDE[h] ?? SMALL_VOWEL[h]
      const onset = h in SMALL_GLIDE ? 'y' : ''
      push(g, 'cv', { onset, manner: MANNER[onset], vowel })
    } else push(g, 'unread', { weight: g.script === 'kanji' ? 2 : 1 })
  }

  // Devoicing: い/う between voiceless consonants (き|く, し|て), and word-final す.
  morae.forEach((mo, i) => {
    if (mo.kind !== 'cv' || mo.palatal) return
    if (mo.vowel !== 'i' && mo.vowel !== 'u') return
    if (!VOICELESS.has(mo.onset)) return
    const next = morae[i + 1]
    mo.devoiced = next
      ? next.kind === 'Q' || (next.kind === 'cv' && VOICELESS.has(next.onset))
      : mo.onset === 's' && mo.vowel === 'u'
  })

  const count = new Map<string, number>()
  for (const mo of morae) count.set(mo.key, (count.get(mo.key) ?? 0) + 1)

  // Writing direction follows script: a word mostly in katakana — the script
  // of borrowed words — is written horizontally; everything else vertically.
  const by = (s: Script) => graphemes.filter((g) => g.script === s).length
  const direction = by('katakana') > by('hiragana') + by('kanji') ? 'horizontal' : 'vertical'

  return { text, graphemes, morae, moraOf, count, direction }
}
