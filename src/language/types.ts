export type Script = 'hiragana' | 'katakana' | 'kanji' | 'mark' | 'other'

export type Vowel = 'a' | 'i' | 'u' | 'e' | 'o'

export type Onset =
  | ''
  | 'k' | 'g'
  | 's' | 'sh' | 'z' | 'j'
  | 't' | 'ch' | 'ts' | 'd'
  | 'n'
  | 'h' | 'f' | 'b' | 'p'
  | 'm' | 'y' | 'r' | 'w' | 'v'

/** How the onset closes or narrows the mouth before the vowel opens it. */
export type Manner =
  | 'none'
  | 'plosive'
  | 'voicedPlosive'
  | 'fricative'
  | 'voicedFricative'
  | 'affricate'
  | 'nasal'
  | 'tap'
  | 'glide'

/**
 * cv     : an ordinary mora (onset may be empty)
 * N      : moraic nasal ん
 * Q      : sokuon っ — a mora made of silence
 * R      : long vowel ー — a mora that prolongs the previous one
 * unread : a character whose reading this prototype does not know (kanji, latin…)
 */
export type MoraKind = 'cv' | 'N' | 'Q' | 'R' | 'unread'

export interface Grapheme {
  index: number
  char: string
  script: Script
  /** small kana: cannot stand alone */
  small: boolean
}

export interface Mora {
  index: number
  text: string
  /** hiragana-normalised text, used to detect recurrence */
  key: string
  graphemes: number[]
  kind: MoraKind
  onset: Onset
  manner: Manner
  vowel: Vowel | null
  palatal: boolean
  /** high vowel between voiceless consonants: whispered in ordinary speech */
  devoiced: boolean
  /** duration in beats. Unread kanji count as two (the most common on-reading length). */
  weight: number
}

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
