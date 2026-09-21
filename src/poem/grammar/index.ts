/**
 * Mark grammars (v2): how the marks behave inside a composition.
 *
 * A spatial composition decides the page's structure — where the title is
 * held. A mark grammar decides how its marks appear there: as they are
 * (uniform, which is v1 exactly), fading, spreading into a field of small
 * marks, gathering into a form, turning in sequence. The two are chosen apart,
 * so one composition can be written several ways.
 */
import type { Rng } from '../../core/random'
import type { Analysis, GrammarApplied, GrammarId, Material, Mark, Placed, Realization } from '../types'
import { attenuation } from './attenuation'
import { branch, branchesDiffer } from './branch'
import { silentSeat, type GrammarOffer, type MarkGrammar } from './common'
import { constellation } from './constellation'
import { emanation } from './emanation'
import { field } from './field'
import { lattice, occurrenceGrid } from './lattice'
import { viewOf, type Asked, type PageView } from './page'
import { orbit } from './orbit'
import { phase } from './phase'
import { silhouette } from './silhouette'

export type { Asked } from './page'

export const GRAMMARS: readonly MarkGrammar[] = [attenuation, field, silhouette, phase, orbit, emanation, branch, constellation, lattice]

export const UNIFORM: GrammarApplied = { id: 'uniform', grounds: [], uses: [], derived: {} }

/** grains below which a form drawn in small marks cannot be read as the form: in all, and per mark of it */
const LEGIBLE_GRAINS = 12
const LEGIBLE_PER_MARK = 6

/** seats written as space right after a written one */
function erasedSeats(v: PageView) {
  return v.seats.filter((s, i) => !s.written && v.seats.slice(0, i).some((t) => t.written))
}


/** the longest run of one character written again and again */
function longestRun(v: PageView): number {
  const n = new Map<string, number>()
  for (const k of v.body) if (!k.keep && !k.minus) n.set(k.char, (n.get(k.char) ?? 0) + 1)
  return Math.max(0, ...n.values())
}

/** the nucleus is a reading of ink, or the word another depends on */
function formed(v: PageView): string | null {
  if (!v.nucleus.length) return null
  if (v.nucleus.some((k) => k.keep || k.minus)) return '核はインクの読み（部品・残り）'
  const f = v.m.primary.focus
  const chars = new Set(v.nucleus.map((k) => k.char))
  if (f.kind === 'counter') return '核は閉じた白を抱える字'
  if (f.kind === 'pair' && (chars.has(f.relation.inner) || chars.has(f.relation.outer))) return '核は字形の関係の項'
  if (v.spatial.id === 'centre') return '核は他の語が依存する語'
  return null
}

/**
 * v2: which grammar a page takes. One way per structure, decided by what the
 * page holds; there is no contest between grammars and no fitness:
 *   1. seats the poem writes as space after a written one — a silent beat
 *      (a sokuon) is the next beat's consonant held early, so the next beat
 *      grows toward itself through it (attenuation); any other erasure leaves
 *      its characters as dust where they were (field)
 *   2. a run of eight or more copies of one character — a field turns through
 *      a phase; any other run dwindles (attenuation)
 *   3. a nucleus that is a reading of ink or the word another depends on —
 *      its form is drawn in small marks (silhouette), where enough of them
 *      fall on it for the form to be read; the way it is drawn (fill,
 *      contour, density, residue) is the nucleus's own (silhouette.ts)
 *   4. a grid whose rows are the occurrences of what the title repeats — each
 *      row is read again, smaller cell by cell, and goes on (lattice)
 *   5. groups the title makes (the terms it coordinates, the occurrences it
 *      repeats) that differ in what they are made of — each grows as many
 *      branches as it has members (branch)
 *   6. two terms held apart as poles — each is ringed by the other where the
 *      relation is symmetric, the dependent circles its head where it is not
 *      (orbit)
 *   7. a page with none of these, whose title holds material of two kinds
 *      (its structure, its sound) — each gathers as a cluster in the page's
 *      white, the nearer kind nearer the writing (constellation)
 *   8. otherwise the page stays as the composition wrote it (v1)
 * A form in small marks that cannot be read falls back to 5, then 6.
 * Emanation is not selected: under review it did not yet make an event
 * distinct enough from what the page already does. Meaning (the lexicon)
 * is never selected: it is review only.
 */
function select(v: PageView): { g: MarkGrammar | null; why: string; fallback?: MarkGrammar | null } {
  // a title the composition found weak gathers small in a corner: it is left quiet
  if (v.spatial.id === 'cluster') return { g: null, why: '片隅：弱い題は小さく静かなまま' }
  const e = erasedSeats(v)
  if (e.length) {
    if (e.every((s) => silentSeat(v, s.grapheme))) return { g: attenuation, why: '黙った拍の席：次の拍の子音がそこで先に鳴っている' }
    return { g: field, why: '消された席：消えた字が粒としてそこに残る' }
  }
  if (longestRun(v) >= 8)
    return v.spatial.id === 'field'
      ? { g: phase, why: '題そのものの場：反復が一周の位相をもつ' }
      : { g: attenuation, why: '一つの字の長い並び：並んだ順に小さくなる' }
  const tree = branchesDiffer(v) && branch.offer(v) ? branch : null
  const why = formed(v)
  if (why) return { g: silhouette, why, fallback: tree ?? (orbit.offer(v) ? orbit : null) }
  if (occurrenceGrid(v)) return { g: lattice, why: '格子の行が反復の出現：行ごとに縮みながら続く' }
  if (tree) return { g: branch, why: '題のまとまりが、それぞれ異なる数の構成要素でできている' }
  if (orbit.offer(v)) return { g: orbit, why: '二つの項が極として引き離されている' }
  // the lexicon never takes part in the selection: constellation is chosen from what the title itself holds
  if (!v.semantic && constellation.offer(v)) return { g: constellation, why: '他の振る舞いの根拠がなく、題が構造と音の二種類の材料を持つ：それぞれが紙面の白に群をなす' }
  return { g: null, why: '粒・残響・位相・格子・分岐・軌道・星座の根拠がない：構成が書いたまま' }
}

function applied(g: MarkGrammar, grounds: string[], offer: GrammarOffer, marks: Mark[]): GrammarApplied {
  const derived: Record<string, number> = {}
  for (const k of marks) if (k.derived) derived[`${k.derived.kind}:${k.char}`] = (derived[`${k.derived.kind}:${k.char}`] ?? 0) + 1
  return { id: g.id, ...(offer.variant ? { variant: offer.variant } : {}), grounds, uses: offer.uses, derived }
}

/**
 * The page's marks under a grammar. With none named the marks are the
 * composition's own, untouched: that is v1. 'auto' is the v2 selection.
 * Where the grammar finds nothing on this page to act on — or, for a form in
 * small marks, too little to read — the page again stays as it was.
 */
export function writeWith(
  id: GrammarId | 'auto' | undefined,
  a: Analysis,
  m: Material,
  spatial: Realization,
  placed: Placed,
  rng: Rng,
  asked: Asked = {},
): { marks: Mark[]; applied: GrammarApplied } {
  if (!id || id === 'uniform') return { marks: placed.marks, applied: UNIFORM }
  const view = viewOf(a, m, spatial, placed, asked)
  let g: MarkGrammar | undefined
  let why: string | undefined
  let fallback: MarkGrammar | null | undefined
  if (id === 'auto') {
    const s = select(view)
    if (!s.g) return { marks: placed.marks, applied: { ...UNIFORM, grounds: [s.why] } }
    g = s.g
    why = s.why
    fallback = s.fallback
  } else g = GRAMMARS.find((x) => x.id === id)
  if (!g) return { marks: placed.marks, applied: UNIFORM }
  const offer = g.offer(view)
  if (!offer) return { marks: placed.marks, applied: { ...UNIFORM, grounds: [`${g.title}：この紙面には働く構造がない`] } }
  const marks = g.apply(view, rng)
  // a grammar that found room for nothing leaves the page as the composition wrote it
  if (marks.length === view.marks.length && marks.every((k, i) => k === view.marks[i]))
    return { marks: placed.marks, applied: { ...UNIFORM, grounds: [`${g.title}：紙面に置く余地がない`] } }
  // a form drawn in too few grains is not the form: keep the page as it was
  if (g.id === 'silhouette') {
    // the grains of the form itself: a trace of what was taken out is not the form
    const grains = marks.filter((k) => k.derived?.grammar === 'silhouette' && k.role === 'grain').length
    if (grains < LEGIBLE_GRAINS || grains < LEGIBLE_PER_MARK * view.nucleus.length) {
      const note = `${g.title}：粒が${grains}しか落ちず、形として読めない`
      const f = fallback?.offer(view)
      if (fallback && f) {
        const alt = fallback.apply(view, rng)
        return { marks: alt, applied: applied(fallback, [note, ...f.grounds], f, alt) }
      }
      return { marks: placed.marks, applied: { ...UNIFORM, grounds: [note] } }
    }
  }
  return { marks, applied: applied(g, why ? [why, ...offer.grounds] : offer.grounds, offer, marks) }
}
