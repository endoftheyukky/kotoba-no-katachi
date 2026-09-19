import { Rng, hash } from '../core/random'
import { GlyphLibrary } from '../glyph/source'
import { analyze } from '../language/analyze'
import type { Word } from '../language/types'
import { Stage } from '../render/stage'
import { chooseRule } from './select'
import type { Composition, PoeticRule } from './types'

export interface Prepared {
  word: Word
  rule: PoeticRule
  composition: Composition
}

/** Word → rule → composition, fully determined by the word. */
export async function prepare(text: string, host: HTMLElement, ruleOverride?: string | null): Promise<Prepared> {
  const word = analyze(text)
  const rng = new Rng(hash(text))
  const rule = chooseRule(word, rng.fork('rule'), ruleOverride)
  const glyphs = new GlyphLibrary()
  await glyphs.prepare(word.graphemes.map((g) => g.char))
  const stage = new Stage(host)
  const composition = rule.compose(word, { stage, rng: rng.fork(rule.id), glyphs })
  composition.render(0)
  return { word, rule, composition }
}

/** The rule stays out of the artwork; it is written to the console for study. */
export function describe({ word, rule, composition }: Prepared): void {
  const { states, duration } = composition
  console.groupCollapsed(
    `${word.text} — ${rule.title} (${rule.id}) ${duration.toFixed(1)}s · ` +
      `start ${states.start.toFixed(1)} / middle ${states.middle.toFixed(1)} / final ${states.final.toFixed(1)}`,
  )
  console.table(rule.statement)
  console.table(composition.cues.map((c) => ({ ...c, t: +c.t.toFixed(2), amount: +c.amount.toFixed(3) })))
  console.groupEnd()
}
