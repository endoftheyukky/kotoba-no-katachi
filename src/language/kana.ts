import type { Manner, Onset, Vowel } from './types'

/** hiragana → [onset, vowel] */
export const KANA: Record<string, [Onset, Vowel]> = {}

function row(chars: string, onsets: Onset | Onset[], vowels = 'aiueo'): void {
  Array.from(chars).forEach((c, i) => {
    KANA[c] = [Array.isArray(onsets) ? onsets[i] : onsets, vowels[i] as Vowel]
  })
}

row('あいうえお', '')
row('かきくけこ', 'k')
row('がぎぐげご', 'g')
row('さしすせそ', ['s', 'sh', 's', 's', 's'])
row('ざじずぜぞ', ['z', 'j', 'z', 'z', 'z'])
row('たちつてと', ['t', 'ch', 'ts', 't', 't'])
row('だぢづでど', ['d', 'j', 'z', 'd', 'd'])
row('なにぬねの', 'n')
row('はひふへほ', ['h', 'h', 'f', 'h', 'h'])
row('ばびぶべぼ', 'b')
row('ぱぴぷぺぽ', 'p')
row('まみむめも', 'm')
row('やゆよ', 'y', 'auo')
row('らりるれろ', 'r')
row('わを', ['w', ''], 'ao')
row('ゐゑ', '', 'ie')
row('ゔ', 'v', 'u')

/** small kana that palatalise the previous mora (きゃ) */
export const SMALL_GLIDE: Record<string, Vowel> = { ゃ: 'a', ゅ: 'u', ょ: 'o', ゎ: 'a' }
/** small vowels that replace the previous vowel (ファ, ティ) */
export const SMALL_VOWEL: Record<string, Vowel> = { ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o' }

export const SMALL = new Set(Array.from('ぁぃぅぇぉゃゅょゎっァィゥェォャュョヮッヵヶ'))

export const MANNER: Record<Onset, Manner> = {
  '': 'none',
  k: 'plosive', t: 'plosive', p: 'plosive',
  g: 'voicedPlosive', d: 'voicedPlosive', b: 'voicedPlosive',
  s: 'fricative', sh: 'fricative', h: 'fricative', f: 'fricative',
  z: 'voicedFricative', j: 'voicedFricative', v: 'voicedFricative',
  ch: 'affricate', ts: 'affricate',
  n: 'nasal', m: 'nasal',
  r: 'tap',
  y: 'glide', w: 'glide',
}

export const VOICELESS = new Set<Onset>(['k', 's', 'sh', 't', 'ch', 'ts', 'h', 'f', 'p'])

export function toHiragana(c: string): string {
  const cp = c.codePointAt(0)!
  return cp >= 0x30a1 && cp <= 0x30f6 ? String.fromCodePoint(cp - 0x60) : c
}
