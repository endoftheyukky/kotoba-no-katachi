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
import { silentSeat, type MarkGrammar } from './common'
import { field } from './field'
import { viewOf, type PageView } from './page'
import { phase } from './phase'
import { silhouette } from './silhouette'

export const GRAMMARS: readonly MarkGrammar[] = [attenuation, field, silhouette, phase]

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
 *      fall on it for the form to be read
 *   4. otherwise the page stays as the composition wrote it (v1)
 */
function select(v: PageView): { g: MarkGrammar | null; why: string } {
  const e = erasedSeats(v)
  if (e.length) {
    if (e.every((s) => silentSeat(v, s.grapheme))) return { g: attenuation, why: '黙った拍の席：次の拍の子音がそこで先に鳴っている' }
    return { g: field, why: '消された席：消えた字が粒としてそこに残る' }
  }
  if (longestRun(v) >= 8)
    return v.spatial.id === 'field'
      ? { g: phase, why: '題そのものの場：反復が一周の位相をもつ' }
      : { g: attenuation, why: '一つの字の長い並び：並んだ順に小さくなる' }
  const why = formed(v)
  if (why) return { g: silhouette, why }
  return { g: null, why: '粒・残響・位相の根拠がない：構成が書いたまま' }
}

function applied(g: MarkGrammar, grounds: string[], uses: GrammarApplied['uses'], marks: Mark[]): GrammarApplied {
  const derived: Record<string, number> = {}
  for (const k of marks) if (k.derived) derived[`${k.derived.kind}:${k.char}`] = (derived[`${k.derived.kind}:${k.char}`] ?? 0) + 1
  return { id: g.id, grounds, uses, derived }
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
): { marks: Mark[]; applied: GrammarApplied } {
  if (!id || id === 'uniform') return { marks: placed.marks, applied: UNIFORM }
  const view = viewOf(a, m, spatial, placed)
  let g: MarkGrammar | undefined
  let why: string | undefined
  if (id === 'auto') {
    const s = select(view)
    if (!s.g) return { marks: placed.marks, applied: { ...UNIFORM, grounds: [s.why] } }
    g = s.g
    why = s.why
  } else g = GRAMMARS.find((x) => x.id === id)
  if (!g) return { marks: placed.marks, applied: UNIFORM }
  const offer = g.offer(view)
  if (!offer) return { marks: placed.marks, applied: { ...UNIFORM, grounds: [`${g.title}：この紙面には働く構造がない`] } }
  const marks = g.apply(view, rng)
  // a form drawn in too few grains is not the form: keep the page as it was
  if (g.id === 'silhouette') {
    const grains = marks.filter((k) => k.derived?.grammar === 'silhouette').length
    if (grains < LEGIBLE_GRAINS || grains < LEGIBLE_PER_MARK * view.nucleus.length)
      return { marks: placed.marks, applied: { ...UNIFORM, grounds: [`${g.title}：粒が${grains}しか落ちず、形として読めない`] } }
  }
  return { marks, applied: applied(g, why ? [why, ...offer.grounds] : offer.grounds, offer.uses, marks) }
}
