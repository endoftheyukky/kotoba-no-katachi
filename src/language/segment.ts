/**
 * Splitting a title into tokens.
 *
 * The Segmenter interface is the seam where a morphological analyser
 * (kuromoji.js, Sudachi…) can be plugged in later. The rule segmenter below
 * uses only what is visible in the writing: runs of one script, a small list
 * of function words, and okurigana endings. It is deliberately modest.
 */
import type { Grapheme, PartOfSpeech, Token } from './types'
import { toHiragana } from './kana'

export interface Segmenter {
  segment(graphemes: readonly Grapheme[]): Token[]
}

/** function words matched at the start of a kana run (longest first) */
const FUNCTION_WORDS: [string, PartOfSpeech][] = [
  ['あるいは', 'conjunction'],
  ['もしくは', 'conjunction'],
  ['ならびに', 'conjunction'],
  ['または', 'conjunction'],
  ['および', 'conjunction'],
  ['から', 'particle'],
  ['まで', 'particle'],
  ['より', 'particle'],
]

/** particles peeled from the start of a longer kana run after a content word */
const LEADING_PARTICLES = new Set(['の', 'を', 'へ', 'が', 'は'])
/** a kana run of one character that is one of these is a particle */
const SINGLE_PARTICLES = new Set(['の', 'を', 'に', 'へ', 'が', 'は', 'で', 'と', 'も', 'や', 'か'])

const E_ROW = new Set(Array.from('えけげせぜてでねへべぺめれ'))
const U_ROW = new Set(Array.from('うくぐすずつづぬふぶぷむゆる'))

type RunKind = 'kanji' | 'kana' | 'katakana' | 'symbol' | 'other'

interface Run {
  kind: RunKind
  start: number
  end: number
}

function runKind(g: Grapheme): RunKind {
  switch (g.script) {
    case 'kanji':
      return 'kanji'
    case 'hiragana':
      return 'kana'
    case 'katakana':
      return 'katakana'
    case 'symbol':
      return 'symbol'
    default:
      return 'other'
  }
}

function runs(graphemes: readonly Grapheme[]): Run[] {
  const out: Run[] = []
  for (const g of graphemes) {
    const last = out[out.length - 1]
    // ー belongs to whatever it lengthens
    const kind = g.script === 'mark' && last ? last.kind : runKind(g)
    if (last && last.kind === kind && kind !== 'symbol') last.end = g.index + 1
    else out.push({ kind, start: g.index, end: g.index + 1 })
  }
  return out
}

function okuriganaPos(kana: string): { pos: PartOfSpeech; form?: Token['form'] } {
  const last = kana[kana.length - 1]
  if (E_ROW.has(last)) return { pos: 'verb', form: 'imperative' }
  if (last === 'い') return { pos: 'adjective' }
  if (U_ROW.has(last)) return { pos: 'verb', form: 'plain' }
  return { pos: 'noun' }
}

export const ruleSegmenter: Segmenter = {
  segment(graphemes) {
    const text = (s: number, e: number) => graphemes.slice(s, e).map((g) => g.char).join('')
    const tokens: Token[] = []
    const push = (start: number, end: number, pos: PartOfSpeech, form?: Token['form']) =>
      tokens.push({ index: tokens.length, surface: text(start, end), start, end, pos, form })

    const rs = runs(graphemes)
    rs.forEach((r, ri) => {
      const prev = rs[ri - 1]
      if (r.kind === 'symbol') return push(r.start, r.end, 'symbol')
      if (r.kind === 'kanji' || r.kind === 'katakana' || r.kind === 'other') return push(r.start, r.end, 'noun')

      // a hiragana run
      let s = r.start
      const kana = toHiragana(text(r.start, r.end))
      const afterContent = prev && prev.kind !== 'symbol'
      const fw = FUNCTION_WORDS.find(([w]) => kana.startsWith(w))
      if (fw && afterContent) {
        push(s, s + fw[0].length, fw[1])
        s += fw[0].length
      } else if (afterContent && r.end - r.start === 1 && SINGLE_PARTICLES.has(kana)) {
        return push(s, r.end, 'particle')
      } else if (afterContent && r.end - r.start > 1 && LEADING_PARTICLES.has(kana[0])) {
        push(s, s + 1, 'particle')
        s += 1
      }
      if (s >= r.end) return

      const rest = toHiragana(text(s, r.end))
      const last = tokens[tokens.length - 1]
      if (s === r.start && prev?.kind === 'kanji' && last) {
        // okurigana: the kana ending belongs to the kanji before it (触る, 美しい)
        const { pos, form } = okuriganaPos(rest)
        last.end = r.end
        last.surface = text(last.start, last.end)
        last.pos = pos
        last.form = form
        return
      }
      const { pos, form } = okuriganaPos(rest)
      push(s, r.end, form === 'imperative' ? pos : 'noun', form === 'imperative' ? form : undefined)
    })
    return tokens
  },
}
