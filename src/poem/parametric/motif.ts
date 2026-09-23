/**
 * v6 — the motif: what makes two pages rhyme.
 *
 * v5 dissolved the families, and then the pages stood too evenly apart: every
 * title landed in its own place because every parameter was read from the title
 * on its own, and twenty small independent readings leave no two pages near
 * each other. A series with no neighbourhoods is as lifeless as a series of
 * templates.
 *
 * A motif is not a template and not a family. It is a structure a title *has* —
 * that it says something twice, that it holds two terms, that one of its
 * characters is read inside another, that something has been taken away — read
 * as a strength between 0 and 1, and it presses on all three layers at once:
 *
 *      the figure   how the reading is walked
 *      the page     how large it is written and where it stands
 *      the material what the page is made of
 *
 * A title is drawn part of the way toward the chord of every structure it has,
 * as far as it has it (`RHYME`), so two titles with the same structure come
 * nearer each other in the parameters that structure touches while everything
 * else they are read by keeps them apart. They rhyme; they do not repeat.
 *
 * Nothing here is a new reading. Every motif is made of readings the parameters
 * already use — this layer only says which of them belong together.
 */
import type { Analysis, Material } from '../types'
import { RELATION_THRESHOLD } from '../../glyph/relation'
import { allUnits } from '../spatial/common'

const clip = (v: number, lo = 0, hi = 1) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo)

export interface Motifs {
  /** the title says a unit again */
  repetition: number
  /** two terms are held together: a coordination, a dependency */
  pairing: number
  /** one form stands inside another: a containment, the parts a character falls into */
  nesting: number
  /** something is taken away: erased seats, a negation */
  absence: number
  /** the title falls into many words */
  articulation: number
  /** the sound comes back: the same mora or vowel at both ends, a voicing, a held beat */
  echo: number
}

export const MOTIFS = ['repetition', 'pairing', 'nesting', 'absence', 'articulation', 'echo'] as const

export function readMotifs(a: Analysis, m: Material): Motifs {
  const units = allUnits(m)
  const chars = a.graphemes.filter((g) => g.char.trim())
  const n = Math.max(1, chars.length)

  const repeats = a.relations.filter((r) => r.kind === 'reduplication' || (r.kind === 'recurrence' && r.unit === 'grapheme'))
  const covered = new Set(repeats.flatMap((r) => (r.kind === 'reduplication' ? r.occurrences.flat() : r.kind === 'recurrence' ? r.members : [])))
  const occurrences = Math.max(0, ...repeats.map((r) => (r.kind === 'reduplication' ? r.occurrences.length : r.kind === 'recurrence' ? r.members.length : 0)))
  const repetition = clip((covered.size / n) * (0.45 + 0.55 * clip((occurrences - 1) / 2)))

  const coordination = a.relations.find((r) => r.kind === 'coordination')
  const dependency = a.relations.find((r) => r.kind === 'dependency')
  const terms = coordination ? 1 : dependency ? 0.65 : 0
  const tokens = Math.max(1, a.tokens.filter((t) => t.end > t.start).length)
  const pairing = clip(terms * (0.6 + 0.4 * clip((tokens - 1) / 3)))

  // kanji and kana only: one Latin letter inside another is the alphabet's own build
  const cjk = (s: string) => [...s].every((c) => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(c))
  const inside = a.glyphRelations
    .filter((r) => r.kind === 'containment' && r.score >= RELATION_THRESHOLD && r.origin !== 'inventory' && cjk(r.inner) && cjk(r.outer))
    .sort((x, y) => y.score - x.score)[0]
  const counters = [...a.interiors.values()].reduce((s, i) => s + i.counters.length, 0)
  const focus = m.primary.focus
  // a containment the reading actually rests on, not any ink that happens to
  // lie on other ink
  const read = inside ? clip((inside.score - 0.5) / 0.45) : 0
  const nesting = clip(Math.max(read, focus.kind === 'parts' ? 0.75 : 0, focus.kind === 'counter' ? 0.5 : 0) + 0.1 * clip(counters / 3))

  const erased = units.filter((u) => u.absent).length
  const absence = clip(erased / Math.max(1, units.length) + (a.relations.some((r) => r.kind === 'negation') ? 0.45 : 0))

  const articulation = clip((tokens - 1) / Math.max(1, n - 1) / 0.5)

  const first = chars[0]
  const last = chars[chars.length - 1]
  const moraOf = (g: number) => a.morae.find((mo) => mo.graphemes.includes(g))
  const sameMora = !!(first && last && moraOf(first.index)?.key && moraOf(first.index)?.key === moraOf(last.index)?.key)
  const sameVowel = !!(first && last && moraOf(first.index)?.vowel && moraOf(first.index)?.vowel === moraOf(last.index)?.vowel)
  const mirror = a.relations.some((r) => r.kind === 'mirror')
  const special = a.morae.filter((mo) => mo.kind === 'N' || mo.kind === 'Q' || mo.kind === 'R' || mo.devoiced).length
  const ends = chars.length < 2 ? 0 : mirror ? 1 : first.char === last.char ? 0.9 : sameMora ? 0.7 : sameVowel ? 0.45 : first.script === last.script ? 0.15 : 0
  const echo = clip(0.7 * ends + 0.5 * (a.morae.length ? special / a.morae.length : 0))

  return { repetition, pairing, nesting, absence, articulation, echo }
}

/**
 * The chord each motif strikes: not a direction to lean in but a place to lean
 * toward. A page is drawn a share of the way from what its own readings asked
 * for to the chord's own value, and that share is how much of the structure the
 * title has. Two titles with the same structure therefore come *nearer each
 * other* in the parameters that structure touches, while everything else they
 * are read by keeps them apart. A shared push would only have moved them
 * together without bringing them closer: it is the drawing-toward that rhymes.
 *
 *   repetition   the reading comes back and is written again; the page holds
 *                more, so the characters are smaller and stand nearer the
 *                middle, and the title has material to give
 *   pairing      two terms pull apart: the curve swells and opens, the subject
 *                stands larger, the material goes round the reading
 *   nesting      a form inside a form: the character is written large, and its
 *                own ink becomes the material of the page
 *   absence      what is gone leaves the writing small and aside, and scatters
 *                its material over the page
 *   articulation a title in many words turns at its breaks and steps as it goes
 *   echo         the sound returns: the curve closes, its characters turn with
 *                it, and the material is fine
 */
export const CHORDS: Record<keyof Motifs, Record<string, number>> = {
  repetition: { rows: 3.2, closure: 0.45, corners: 0.25, scale: 0.12, offset: 0.25, density: 0.8, onPage: 0.5, fineness: 0.75 },
  // Pairing no longer draws the satellites or the hierarchy: drawn toward the
  // same small copies round the same large character, every "A と B" title became
  // one page (大と太, 木と本, 土と土, 王と玉…). The pair now rhymes in how its
  // curve swells and opens and where it stands; the seam between its terms is an
  // act (acts.ts, split), and whether it carries satellites is the title's own.
  pairing: { eccentricity: 0.35, opening: 0.18, corners: 0.45, offset: 0.55, scale: 0.2 },
  nesting: { scale: 0.5, hierarchy: 3.2, closure: 0.25, tangency: 0.25, onForm: 0.7, cut: 0.4, density: 0.75, fineness: 0.6 },
  absence: { offset: 0.75, scale: 0.09, decay: 0.15, corners: 0.35, onPage: 0.6, spread: 0.7, density: 0.6 },
  articulation: { corners: 0.8, shear: 0.6, closure: 0.3, offset: 0.45, spread: 0.4 },
  echo: { closure: 0.7, corners: 0.15, tangency: 0.6, fineness: 0.8, density: 0.5, onForm: 0.35 },
}

/**
 * How far a page is drawn toward the chords it belongs to. One number, so that
 * the whole rhyme can be turned off (0 is v5) and measured.
 */
export const RHYME = 0.6

/**
 * A parameter, drawn toward every chord the title strikes. `value` is what the
 * title's own readings asked for; what comes back is what the page writes.
 */
export function drawn(key: string, value: number, motifs: Motifs | undefined, gain = RHYME): number {
  if (!motifs || gain <= 0) return value
  let v = value
  for (const motif of MOTIFS) {
    const target = CHORDS[motif][key]
    if (target === undefined) continue
    v += gain * motifs[motif] * (target - v)
  }
  return v
}

/** the structure a title has most of, for the review sheets (never drawn) */
export function dominant(motifs: Motifs): keyof Motifs | 'plain' {
  let best: keyof Motifs | 'plain' = 'plain'
  let most = 0.3
  for (const motif of MOTIFS)
    if (motifs[motif] > most) {
      most = motifs[motif]
      best = motif
    }
  return best
}
