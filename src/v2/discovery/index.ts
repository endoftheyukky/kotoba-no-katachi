/**
 * Discovery Candidates (spec-1 §1, §3): every typed relation the title's
 * observation offers, in a canonical order. Pure: the same input gives the same
 * list; nothing is chosen here (select.ts), and no fixture is read (R6).
 */
import type { Discovery } from '../types/discovery'
import { characterDiscoveries } from './character'
import type { DiscoveryInput } from './input'
import { interCharacter, lexical, phonological } from './words'

export type { DiscoveryInput } from './input'
export { gates, select, termsOf } from './select'

const byCodePoint = (a: string, b: string): number => {
  const x = [...a]
  const y = [...b]
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const d = x[i].codePointAt(0)! - y[i].codePointAt(0)!
    if (d) return d
  }
  return x.length - y.length
}

export function discover(input: DiscoveryInput): Discovery[] {
  const out: Discovery[] = []
  for (const g of input.language.graphemes) out.push(...characterDiscoveries(g.index, g.char, input))
  out.push(...interCharacter(input), ...lexical(input), ...phonological(input))
  const seen = new Set<string>()
  return out
    .filter((d) => (seen.has(d.id) ? false : (seen.add(d.id), true)))
    .sort((a, b) => a.graphemes[0] - b.graphemes[0] || byCodePoint(a.id, b.id))
}
