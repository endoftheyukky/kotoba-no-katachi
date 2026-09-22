/**
 * v4 — where a title stands in the trace's parameter space.
 *
 * Each parameter is read from the title, and each says which property it comes
 * from. The families of v1–v2c are places in this space, not separate kinds:
 * a single word with nothing repeated stands at closure 0 (a row); a phrase
 * with word boundaries at a small closure with all its turning at the breaks
 * (a path); a title that repeats itself entirely closes into a ring (an orbit);
 * a directed relation leaves that ring open toward its dependent.
 */
import type { Rng } from '../../core/random'
import type { Analysis, Material, Unit } from '../types'
import { allUnits } from '../spatial/common'
import type { LatticeParams } from './lattice'
import type { TraceParams } from './trace'

const clip = (v: number, lo = 0, hi = 1) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo)

export interface TraceGrounds {
  params: TraceParams
  /** what was read, and what it set */
  grounds: string[]
}

function inkOf(a: Analysis, char: string): number {
  try {
    return a.glyphs.get(char).metrics.density
  } catch {
    return 0.2
  }
}

/** the beats a unit takes to say: a long vowel or a doubled consonant is a longer step */
function beatsOf(a: Analysis, u: Unit): number {
  const morae = a.morae.filter((m) => m.graphemes.includes(u.grapheme))
  if (!morae.length) return 1
  return clip(morae.reduce((s, m) => s + m.weight, 0) / Math.max(1, morae.length), 0.6, 2.2)
}

export function traceParams(a: Analysis, m: Material, rng: Rng): TraceGrounds {
  const units = allUnits(m)
  const grounds: string[] = []
  const chars = a.graphemes.filter((g) => g.char.trim())
  const n = Math.max(1, chars.length)

  // --- how far the curve turns ------------------------------------------------
  // Closure is not a switch between a line and a ring: it measures how far the
  // reading comes back to where it began, and every term of it is graded.
  const repeats = a.relations.filter((r) => r.kind === 'reduplication' || (r.kind === 'recurrence' && r.unit === 'grapheme'))
  const covered = new Set(repeats.flatMap((r) => (r.kind === 'reduplication' ? r.occurrences.flat() : r.kind === 'recurrence' ? r.members : [])))
  const repeatShare = clip(covered.size / n)
  const occurrences = Math.max(0, ...repeats.map((r) => (r.kind === 'reduplication' ? r.occurrences.length : r.kind === 'recurrence' ? r.members.length : 0)))
  // a unit said twice closes the curve once; said more often, further
  const loops = clip((occurrences - 1) / 2)

  const first = chars[0]
  const last = chars[chars.length - 1]
  const moraOf = (g: number) => a.morae.find((mo) => mo.graphemes.includes(g))
  const sameMora = first && last && moraOf(first.index)?.key && moraOf(first.index)?.key === moraOf(last.index)?.key
  const sameVowel = first && last && moraOf(first.index)?.vowel && moraOf(first.index)?.vowel === moraOf(last.index)?.vowel
  const mirror = a.relations.some((r) => r.kind === 'mirror') ? 1 : 0
  const endEcho =
    chars.length < 2 ? 0 : mirror ? 1 : first.char === last.char ? 0.9 : sameMora ? 0.75 : sameVowel ? 0.45 : first.script === last.script ? 0.2 : 0

  const dependency = a.relations.find((r) => r.kind === 'dependency')
  const tokens = Math.max(1, a.tokens.filter((t) => t.end > t.start).length)
  // how far toward the end of the title the word everything hangs on stands
  const headFinality = dependency ? clip((dependency.head - dependency.dependent) / Math.max(1, tokens - 1)) : 0
  const inflection = a.relations.some((r) => r.kind === 'inflection')
  const turnDensity = clip((tokens - 1) / Math.max(1, n - 1))

  const closure = clip(0.55 * repeatShare * (0.45 + 0.55 * loops) + 0.4 * endEcho + 0.3 * headFinality + 0.25 * turnDensity)
  grounds.push(
    `closure ${closure.toFixed(2)} ＝ 反復の覆い ${repeatShare.toFixed(2)}（${occurrences} 回）／終わりが始まりに echo ${endEcho.toFixed(2)}／係り先の遠さ ${headFinality.toFixed(2)}／語の切れ目の密度 ${turnDensity.toFixed(2)}`,
  )

  // --- where the turning is spent ----------------------------------------------
  // a title with many word boundaries spends its turning there; one word bends smoothly
  const corners = clip(turnDensity / 0.5)
  if (corners > 0.05) grounds.push(`折れは語の境に置かれる（corners ${corners.toFixed(2)}）`)

  // --- the two terms, and how they differ ---------------------------------------
  const tokenWeight = (t: number) => {
    const k = a.tokens[t]
    if (!k) return 1
    let w = 0
    for (let g = k.start; g < k.end; g++) w += inkOf(a, a.graphemes[g].char)
    return w * (1 + (k.end - k.start) / 4)
  }
  const pair = dependency
    ? [dependency.dependent, dependency.head]
    : (() => {
        const c = a.relations.find((r) => r.kind === 'coordination')
        return c ? [c.left, c.right] : null
      })()
  const asymmetry = pair ? clip(Math.abs(Math.log(tokenWeight(pair[0]) / (tokenWeight(pair[1]) || 1e-6))) / Math.log(4)) : 0
  const eccentricity = 0.4 * asymmetry
  if (eccentricity > 0.03) grounds.push(`二項の重さの差（${asymmetry.toFixed(2)}）：重い方へ曲線がふくらむ（eccentricity ${eccentricity.toFixed(2)}）`)

  // a directed relation leaves the curve open toward the side it depends on,
  // the more so the further the curve has closed and the more the terms differ
  const directed = dependency ? 1 : inflection ? 0.6 : 0
  const opening = clip(directed * clip((closure - 0.35) / 0.5) * (0.12 + 0.3 * asymmetry), 0, 0.4)
  if (opening) grounds.push(`向きのある関係：環は依存する側へ開く（opening ${opening.toFixed(2)}）`)

  // --- how far the marks turn with the curve ------------------------------------
  const tangency = clip(1.4 * closure - 0.2)
  if (tangency > 0.03) grounds.push(`曲がる線は字を連れて回る（tangency ${tangency.toFixed(2)}）`)

  // --- each step: its beats, its weight of ink ----------------------------------
  const weights = units.map((u) => beatsOf(a, u))
  const inks = units.map((u) => inkOf(a, u.char))
  const mean = inks.reduce((s, d) => s + d, 0) / Math.max(1, inks.length)
  const contrast = clip(
    Math.sqrt(inks.reduce((s, d) => s + (d - mean) ** 2, 0) / Math.max(1, inks.length)) / (mean || 1) / 0.45,
  )
  const sizes = units.map((u, i) => {
    const byInk = clip((inks[i] / (mean || 1)) ** (0.5 * contrast), 0.8, 1.25)
    // a character written again and again dwindles along its run (attenuation, continuously)
    const run = units.slice(0, i).filter((v, j) => v.char === u.char && j >= i - 3).length
    return byInk * 0.92 ** run
  })
  if (contrast > 0.1) grounds.push(`字ごとのインクの差（${contrast.toFixed(2)}）：大きさがそれに従う`)

  const breaks = units.map((u, i) => (i > 0 && a.tokenOf[u.grapheme] !== a.tokenOf[units[i - 1].grapheme] ? i : -1)).filter((i) => i > 0)

  // --- a coordination divides the trace -----------------------------------------
  const coordinated = a.relations.filter((r) => r.kind === 'coordination')
  let branch: TraceParams['branch'] = null
  if (coordinated.length) {
    const terms = [...new Set(coordinated.flatMap((r) => (r.kind === 'coordination' ? [r.left, r.right] : [])))].sort((x, y) => x - y)
    const groups = terms.map((t) => units.map((u, i) => (a.tokenOf[u.grapheme] === t ? i : -1)).filter((i) => i >= 0))
    const at = Math.min(...groups.flat())
    // the word that marks the coordination walks with the term before it
    for (let i = at; i < units.length; i++) {
      if (groups.some((g) => g.includes(i))) continue
      const before = groups.filter((g) => g.length && g[g.length - 1] < i).at(-1)
      if (before) before.push(i)
    }
    for (const g of groups) g.sort((x, y) => x - y)
    if (groups.length >= 2 && groups.every((g) => g.length)) {
      branch = { at: Math.max(0, at), groups, spread: clip(0.08 + 0.03 * groups.length, 0, 0.25) }
      grounds.push(`${groups.length} 項の並列：その位置で ${groups.length} 本に分かれる`)
    }
  }

  // plastic, as in v1: which way the curve turns
  const side: 1 | -1 = rng.next() < 0.5 ? 1 : -1

  return { params: { closure, corners, opening, eccentricity, tangency, side, weights, sizes, breaks, branch }, grounds }
}

export interface LatticeGrounds {
  params: LatticeParams
  grounds: string[]
}

/**
 * Where a title stands in the lattice's parameter space. The same readings as
 * the trace's, in two dimensions: how much of the title repeats decides how
 * many rows there are, its beats and its ink decide how even the cells are,
 * its word boundaries how far each row steps, its runs how fast the rows
 * dwindle, and how far its reading returns how much the rows bend.
 */
export function latticeParams(a: Analysis, m: Material): LatticeGrounds {
  const units = allUnits(m)
  const grounds: string[] = []
  const chars = a.graphemes.filter((g) => g.char.trim())
  const n = Math.max(1, chars.length)

  const repeats = a.relations.filter((r) => r.kind === 'reduplication' || (r.kind === 'recurrence' && r.unit === 'grapheme'))
  const covered = new Set(repeats.flatMap((r) => (r.kind === 'reduplication' ? r.occurrences.flat() : r.kind === 'recurrence' ? r.members : [])))
  const repeatShare = clip(covered.size / n)
  const occurrences = Math.max(0, ...repeats.map((r) => (r.kind === 'reduplication' ? r.occurrences.length : r.kind === 'recurrence' ? r.members.length : 0)))
  const loops = clip((occurrences - 1) / 2)
  const strength = repeatShare * (0.4 + 0.6 * loops)
  const rows = Math.max(1, Math.round(1 + 7 * strength))
  grounds.push(`反復が題の ${repeatShare.toFixed(2)} を覆い ${occurrences} 回：${rows} 行になる`)

  const special = a.morae.filter((mo) => mo.kind === 'N' || mo.kind === 'Q' || mo.kind === 'R' || mo.devoiced).length
  const prosody = a.morae.length ? clip(special / a.morae.length / 0.4) : 0
  const inks = units.map((u) => inkOf(a, u.char))
  const mean = inks.reduce((s, d) => s + d, 0) / Math.max(1, inks.length)
  const contrast = clip(Math.sqrt(inks.reduce((s, d) => s + (d - mean) ** 2, 0) / Math.max(1, inks.length)) / (mean || 1) / 0.45)
  const regularity = clip(1 - 0.5 * prosody - 0.5 * contrast)
  if (regularity < 0.95) grounds.push(`特殊拍 ${prosody.toFixed(2)}・インクの差 ${contrast.toFixed(2)}：枡は等間隔から外れる（regularity ${regularity.toFixed(2)}）`)

  const tokens = Math.max(1, a.tokens.filter((t) => t.end > t.start).length)
  const turnDensity = clip((tokens - 1) / Math.max(1, n - 1))
  const shear = clip(1 / Math.max(1, units.length) + 0.6 * turnDensity, 0, 1.2)

  const runs = units.map((u, i) => (i > 0 && units[i - 1].char === u.char ? 1 : 0)).reduce((s: number, v) => s + v, 0)
  const erased = units.filter((u) => u.absent).length
  const decay = clip(0.3 * (runs / Math.max(1, units.length)) + 0.2 * (erased / Math.max(1, units.length)), 0, 0.4)

  const first = chars[0]
  const last = chars[chars.length - 1]
  const mirror = a.relations.some((r) => r.kind === 'mirror') ? 1 : 0
  const endEcho = chars.length < 2 ? 0 : mirror ? 1 : first.char === last.char ? 0.9 : first.script === last.script ? 0.2 : 0
  const curl = clip(0.3 * (0.55 * repeatShare * (0.45 + 0.55 * loops) + 0.4 * endEcho), 0, 0.3)
  const spacing = 1 + 0.35 * (1 - repeatShare)
  const weights = units.map((u) => beatsOf(a, u))
  return { params: { rows, regularity, shear, decay, curl, spacing, weights }, grounds }
}
