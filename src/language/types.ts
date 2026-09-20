export type Script = 'hiragana' | 'katakana' | 'kanji' | 'mark' | 'symbol' | 'other'

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
 * unread : a character whose reading is not known (kanji without a given reading, latin…)
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
  /** graphemes this mora is written with (a kanji token's morae share all its graphemes) */
  graphemes: number[]
  kind: MoraKind
  onset: Onset
  manner: Manner
  vowel: Vowel | null
  palatal: boolean
  /** high vowel between voiceless consonants: whispered in ordinary speech */
  devoiced: boolean
  /** length in beats. An unread kanji counts as two (the most common on-reading length). */
  weight: number
  /** token this mora belongs to (−1 when not tokenised) */
  token?: number
}

export type PartOfSpeech = 'noun' | 'particle' | 'conjunction' | 'verb' | 'adjective' | 'symbol' | 'other'

export interface Token {
  index: number
  surface: string
  /** grapheme range [start, end) */
  start: number
  end: number
  pos: PartOfSpeech
  /** conjugated form, when the segmenter can tell */
  form?: 'imperative' | 'plain'
  /**
   * grapheme index where the kana ending begins, when the word is written
   * with a kanji stem and okurigana (触|る, 美し|い, 走|れ)
   */
  stem?: number
  /** hiragana reading, when known */
  reading?: string
}
