/**
 * Morae from a sequence of written or read characters.
 * Each character carries the graphemes it stands for: a kana stands for
 * itself; a kana of a kanji's reading stands for the whole kanji run.
 */
import { KANA, MANNER, SMALL_GLIDE, SMALL_VOWEL, VOICELESS, toHiragana } from './kana'
import { scriptOf } from './script'
import type { Mora, MoraKind } from './types'

export interface SoundChar {
  char: string
  graphemes: number[]
  token: number
}

export function parseMorae(chars: readonly SoundChar[]): Mora[] {
  const morae: Mora[] = []

  const push = (c: SoundChar, kind: MoraKind, fields: Partial<Mora> = {}): void => {
    const onset = fields.onset ?? ''
    morae.push({
      index: morae.length,
      text: c.char,
      key: toHiragana(c.char),
      graphemes: [...c.graphemes],
      kind,
      onset,
      manner: MANNER[onset],
      vowel: null,
      palatal: false,
      devoiced: false,
      weight: 1,
      token: c.token,
      ...fields,
    })
  }

  for (const c of chars) {
    const script = scriptOf(c.char)
    if (script === 'symbol') continue // marks of voice, not morae
    const h = toHiragana(c.char)
    const prev = morae[morae.length - 1]

    // small kana join the preceding mora: き+ゃ is one beat
    if (prev?.kind === 'cv' && prev.token === c.token && (h in SMALL_GLIDE || h in SMALL_VOWEL)) {
      prev.text += c.char
      prev.key += h
      for (const g of c.graphemes) if (!prev.graphemes.includes(g)) prev.graphemes.push(g)
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
      continue
    }

    if (h === 'ー') push(c, 'R', { vowel: prev?.vowel ?? null })
    else if (h === 'っ') push(c, 'Q')
    else if (h === 'ん') push(c, 'N')
    else if (KANA[h]) {
      const [onset, vowel] = KANA[h]
      push(c, 'cv', { onset, manner: MANNER[onset], vowel })
    } else if (h in SMALL_GLIDE || h in SMALL_VOWEL) {
      const vowel = SMALL_GLIDE[h] ?? SMALL_VOWEL[h]
      const onset = h in SMALL_GLIDE ? 'y' : ''
      push(c, 'cv', { onset, manner: MANNER[onset], vowel })
    } else push(c, 'unread', { weight: script === 'kanji' ? 2 : 1 })
  }

  // Devoicing: い/う between voiceless consonants, and word-final す.
  morae.forEach((mo, i) => {
    if (mo.kind !== 'cv' || mo.palatal) return
    if (mo.vowel !== 'i' && mo.vowel !== 'u') return
    if (!VOICELESS.has(mo.onset)) return
    const next = morae[i + 1]
    mo.devoiced = next
      ? next.kind === 'Q' || (next.kind === 'cv' && VOICELESS.has(next.onset))
      : mo.onset === 's' && mo.vowel === 'u'
  })

  return morae
}
