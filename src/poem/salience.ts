/**
 * Salience: how much a relation belongs to this title rather than to titles
 * in general. The three components are combined as a weighted geometric mean,
 * so a relation must be at least somewhat strong, unusual AND extensive:
 *
 *   salience = relationStrength^0.4 · distinctiveness^0.4 · coverage^0.2
 */
import { clamp } from '../core/math'
import type { Grapheme, Script } from '../language/types'
import type { Analysis, Salience } from './types'

export function salience(relationStrength: number, distinctiveness: number, coverage: number): Salience {
  const rs = clamp(relationStrength)
  const d = clamp(distinctiveness)
  const c = clamp(coverage)
  const value = rs && d && c ? Math.exp(0.4 * Math.log(rs) + 0.4 * Math.log(d) + 0.2 * Math.log(c)) : 0
  return { value, relationStrength: rs, distinctiveness: d, coverage: c }
}

const RELATION_POS = new Set(['particle', 'conjunction'])

export function isRelationWord(a: Analysis, grapheme: number): boolean {
  return RELATION_POS.has(a.tokens[a.tokenOf[grapheme]]?.pos)
}

/** Graphemes that carry the content of the title: not marks, spaces, or relation words. */
export function contentGraphemes(a: Analysis): Grapheme[] {
  return a.graphemes.filter((g) => g.script !== 'symbol' && !isRelationWord(a, g.index))
}

/** how many distinct units a script offers, roughly — the rarer a repeat by chance */
const ALPHABET: Record<Script, number> = { kanji: 1500, hiragana: 46, katakana: 46, mark: 46, symbol: 20, other: 40 }

/** probability that a title of n units shows some repeat by chance alone */
export function chanceOfRepeat(n: number, script: Script): number {
  return 1 - Math.exp(-(n * (n - 1)) / (2 * ALPHABET[script]))
}

/**
 * Relation words, from most to least ordinary. の is everywhere; または is
 * rarer and more marked. (Poetic estimates, not corpus frequencies.)
 */
export const RELATION_WORD_DISTINCTIVENESS: Record<string, number> = {
  の: 0.3, は: 0.3, が: 0.4, を: 0.45, に: 0.4, へ: 0.5, で: 0.35, と: 0.4, も: 0.4, や: 0.45, か: 0.45,
  から: 0.45, まで: 0.5, より: 0.5, または: 0.6, あるいは: 0.6, および: 0.55, もしくは: 0.6, ならびに: 0.6,
}
