import type { Rng } from '../core/random'
import type { GlyphLibrary } from '../glyph/source'
import type { Word } from '../language/types'
import type { Stage } from '../render/stage'

/**
 * A structural event in the poem: something happens to the language material.
 *
 * Cues are the single source of the generative parameters. The image is drawn
 * from them now; sound, when it is added, must be derived from the same cues
 * (the same loss, the same distance, the same repetition) — never from the
 * rendered picture and never from parameters of its own.
 */
export interface Cue {
  /** seconds from the start */
  t: number
  kind: 'present' | 'erode' | 'vanish' | 'open' | 'close' | 'expand' | 'rupture' | 'return' | 'hold'
  /** indices into word.morae affected by the event */
  morae: number[]
  /**
   * 0–1, the size of the event in the material itself:
   *   erode / vanish  – share of the material removed
   *   open / expand   – degree of opening relative to the word's widest
   *   rupture         – displacement relative to the page
   *   return          – share of the material that remains
   */
  amount: number
}

export type StateName = 'start' | 'middle' | 'final'

export interface Composition {
  /** total length; the final state is held until the end */
  readonly duration: number
  /** the moment each of the three still compositions is fully reached */
  readonly states: Readonly<Record<StateName, number>>
  readonly cues: readonly Cue[]
  /** Draw the page as it is at time t. Pure: any t, any order. */
  render(t: number): void
}

export interface ComposeContext {
  stage: Stage
  rng: Rng
  glyphs: GlyphLibrary
}

/** The statements CLAUDE.md asks every behaviour to make explicit. */
export interface RuleStatement {
  input: string
  transformation: string
  start: string
  middle: string
  final: string
}

export interface PoeticRule {
  id: string
  title: string
  statement: RuleStatement
  /** How strongly this word invites the rule (0 = not applicable). */
  affinity(word: Word): number
  compose(word: Word, ctx: ComposeContext): Composition
}
