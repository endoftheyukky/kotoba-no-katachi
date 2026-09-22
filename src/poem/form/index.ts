/**
 * v3 — composition space (experiment, review only; never reached by the public page).
 *
 *   anchor       the page the v2c selection draws: a grammar in a composition
 *   target       what the title's own properties push the form toward (target.ts)
 *   deformation  each operator (deform.ts) moves the page along its axes by
 *                the amount the pressures ask, and only as far as the page stays
 *                sound (invariants.ts): not one character lost, the reading
 *                order kept, no mark on another — and coherent: no step may
 *                move neighbouring marks against each other (strain), which
 *                is what separates a figure that bends from one that jitters. Where a constraint stops an
 *                operator, the page rests there — the title's equilibrium
 *                between what it pushes toward and what its structure holds.
 *
 * Deterministic: the anchor is deterministic, the pressures are read from the
 * analysis, the operators are pure; the one plastic choice (the orientation
 * of rays) draws from the title's seed.
 */
import type { Rng } from '../../core/random'
import type { Analysis, Mark } from '../types'
import { frameOf, OPERATORS } from './deform'
import { MAX_STRAIN, noWorse, soundness, strain, type Soundness } from './invariants'
import { measureForm } from './measure'
import { morph, morphWeight, neighbours } from './morph'
import type { FormProfile } from './profile'
import { formTarget, type FormTarget } from './target'

/** each operator tries the amount the title asks for, then less, until the page holds */
const STEPS = [1, 0.75, 0.5, 0.3, 0.15]

export interface FormStep {
  op: string
  /** the amount the pressures asked for (signed) */
  wanted: number
  /** the share of it the page could take: 1 = all, 0 = none */
  achieved: number
  why: string
  /** what stopped it, where something did */
  stopped?: string
}

export interface FormApplied {
  target: FormTarget
  before: FormProfile
  after: FormProfile
  steps: FormStep[]
  soundness: { before: Soundness; after: Soundness }
}

function worst(s: Soundness, base: Soundness): string {
  const keys = ['lost', 'disordered', 'overlaps', 'inkHits', 'crowded', 'infinite'] as const
  return keys.filter((k) => s[k] > base[k]).map((k) => `${k} ${base[k]}→${s[k]}`).join(', ')
}

export function formSpace(
  a: Analysis,
  marks: Mark[],
  o: { repetition: boolean; absent: number[] },
  rng: Rng,
  gain = 1,
  alternative: { marks: Mark[]; label: string; ratio: number } | null = null,
): { marks: Mark[]; applied: FormApplied } {
  const target = formTarget(a)
  const before = measureForm(marks).profile
  const base = soundness(a, marks, o)
  const delta = Object.fromEntries(Object.entries(target.delta).map(([k, v]) => [k, v * gain])) as FormProfile
  const steps: FormStep[] = []
  // what counts as texture for coherence: derived marks, and a repetition page's own copies
  const texture = (k: Mark) => !!k.derived || (o.repetition && !k.context)
  let current = marks
  // first, between two compositions, where the title is held almost as well by a second one
  const apart = alternative && morphWeight(alternative.ratio) > 0 ? neighbours(marks, alternative.marks) : null
  if (alternative && apart)
    steps.push({ op: 'morph', wanted: morphWeight(alternative.ratio), achieved: 0, why: `not toward ${alternative.label}`, stopped: apart })
  if (alternative && !apart) {
    const w = morphWeight(alternative.ratio)
    if (w > 0) {
      let taken = 0
      let stopped = ''
      for (const f of STEPS) {
        const next = morph(a, current, alternative.marks, w * f)
        const s = soundness(a, next, o)
        const k = strain(current, next, texture)
        if (noWorse(s, base) && k <= MAX_STRAIN) {
          current = next
          taken = f
          break
        }
        if (!stopped) stopped = worst(s, base) || `strain ${k.toFixed(2)} > ${MAX_STRAIN}`
      }
      steps.push({
        op: 'morph',
        wanted: w,
        achieved: taken,
        why: `turning, from where the reading turns, toward ${alternative.label}, which holds the title almost as well (fitness ratio ${alternative.ratio.toFixed(2)})`,
        ...(taken < 1 && stopped ? { stopped } : {}),
      })
    }
  }
  for (const op of OPERATORS) {
    const frame = frameOf(a, current, o.repetition)
    const want = op.wanted(frame, delta, before)
    if (!want) continue
    let taken = 0
    let stopped = ''
    for (const f of STEPS) {
      const next = op.apply(frame, want.amount * f, rng.fork(op.id))
      const s = soundness(a, next, o)
      const k = strain(current, next, texture)
      if (noWorse(s, base) && k <= MAX_STRAIN) {
        current = next
        taken = f
        break
      }
      if (!stopped) stopped = worst(s, base) || `strain ${k.toFixed(2)} > ${MAX_STRAIN}`
    }
    steps.push({ op: op.id, wanted: want.amount, achieved: taken, why: want.why, ...(taken < 1 && stopped ? { stopped } : {}) })
  }
  return {
    marks: current,
    applied: { target, before, after: measureForm(current).profile, steps, soundness: { before: base, after: soundness(a, current, o) } },
  }
}
