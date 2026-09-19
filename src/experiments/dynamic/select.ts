/**
 * One rule per composition. The word's own properties weight the choice
 * (a word with recurring morae invites wear, a word crossing scripts invites
 * dispersion…); the seed decides among them, so a word always gets the same poem.
 */
import type { Rng } from '../core/random'
import type { Word } from '../language/types'
import { aperture } from './rules/aperture'
import { disperse } from './rules/disperse'
import { wear } from './rules/wear'
import type { PoeticRule } from './types'

export const RULES: readonly PoeticRule[] = [wear, aperture, disperse]

export function chooseRule(word: Word, rng: Rng, override?: string | null): PoeticRule {
  const forced = RULES.find((r) => r.id === override)
  if (forced) return forced
  const weights = RULES.map((r) => Math.max(0, r.affinity(word)))
  if (weights.every((w) => w === 0)) return aperture
  return RULES[rng.weighted(weights)]
}
