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
import { readPart } from '../../glyph/legibility'
import { structuralParts } from '../operations/decomposition'
import type { Rng } from '../../core/random'
import type { Analysis, Material, Unit } from '../types'
import { allUnits } from '../spatial/common'
import type { MaterialParams, MaterialSources } from './material'
import type { Motifs } from './motif'
import { drawn } from './motif'
import type { PaperParams } from './paper'
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

/** the graphemes the poem's own subject stands on */
function focusGraphemes(a: Analysis, m: Material): Set<number> {
  const f = m.primary.focus
  const out = new Set<number>()
  if (f.kind === 'repetition') for (const g of f.occurrences.flat()) out.add(g)
  else if (f.kind === 'parts' || f.kind === 'counter') out.add(f.grapheme)
  else if (f.kind === 'pair')
    // the character the relation is read in, where the title writes it
    for (const g of a.graphemes) if (g.char === f.relation.outer) out.add(g.index)
  return out
}

export function traceParams(a: Analysis, m: Material, rng: Rng, motifs?: Motifs, rhyme?: number): TraceGrounds {
  // What the title's own structures draw every layer toward at once
  // (parametric/motif.ts). A parameter is moved part of the way from what the
  // title's own readings asked for to the chord's value, as far as the title
  // has that structure — so pages that share a structure come near each other
  // without becoming the same page.
  const lean = (key: string, value: number) => drawn(key, value, motifs, rhyme)
  const units = allUnits(m)
  const grounds: string[] = []
  const chars = a.graphemes.filter((g) => g.char.trim())
  const n = Math.max(1, chars.length)

  // What the reading yields, and what an operation has produced: v2c decides
  // its scale by these two (poem/scale.ts), and so does the page here.
  const potential = clip(m.primary.poeticPotential ?? 0.5)
  const focus = m.primary.focus
  const operation =
    focus.kind === 'pair' && focus.relation.kind === 'containment'
      ? clip(focus.relation.score)
      : focus.kind === 'parts'
        ? clip(0.55 + 0.45 * (focus.echo?.similarity ?? 0))
        : 0

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

  const closure = lean('closure', clip(0.55 * repeatShare * (0.45 + 0.55 * loops) + 0.4 * endEcho + 0.3 * headFinality + 0.25 * turnDensity))
  grounds.push(
    `closure ${closure.toFixed(2)} ＝ 反復の覆い ${repeatShare.toFixed(2)}（${occurrences} 回）／終わりが始まりに echo ${endEcho.toFixed(2)}／係り先の遠さ ${headFinality.toFixed(2)}／語の切れ目の密度 ${turnDensity.toFixed(2)}`,
  )

  // --- where the turning is spent ----------------------------------------------
  // a title with many word boundaries spends its turning there; one word bends smoothly
  const corners = lean('corners', clip(turnDensity / 0.5))
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
  const eccentricity = lean('eccentricity', clip(0.4 * asymmetry))
  if (eccentricity > 0.03) grounds.push(`二項の重さの差（${asymmetry.toFixed(2)}）：重い方へ曲線がふくらむ（eccentricity ${eccentricity.toFixed(2)}）`)

  // a directed relation leaves the curve open toward the side it depends on,
  // the more so the further the curve has closed and the more the terms differ
  const directed = dependency ? 1 : inflection ? 0.6 : 0
  const opening = directed ? lean('opening', clip(directed * clip((closure - 0.35) / 0.5) * (0.12 + 0.3 * asymmetry), 0, 0.4)) : 0
  if (opening) grounds.push(`向きのある関係：環は依存する側へ開く（opening ${opening.toFixed(2)}）`)

  // --- how far the marks turn with the curve ------------------------------------
  const tangency = lean('tangency', clip(1.4 * closure - 0.2))
  if (tangency > 0.03) grounds.push(`曲がる線は字を連れて回る（tangency ${tangency.toFixed(2)}）`)

  // --- each step: its beats, its weight of ink ----------------------------------
  const weights = units.map((u) => beatsOf(a, u))
  const inks = units.map((u) => inkOf(a, u.char))
  const mean = inks.reduce((s, d) => s + d, 0) / Math.max(1, inks.length)
  const contrast = clip(
    Math.sqrt(inks.reduce((s, d) => s + (d - mean) ** 2, 0) / Math.max(1, inks.length)) / (mean || 1) / 0.45,
  )
  const sizes: number[] = units.map((u, i) => {
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

  // --- how many times the title is written ---------------------------------------
  // The title written again is a row of its own, and there is no threshold
  // between one row and two: a lattice of one row is a trace that does not turn.
  // `rows` is not rounded — 2.4 writes the title twice and the first 40 % of it
  // again, which is how a repetition that does not come out even is held.
  const strength = repeatShare * (0.4 + 0.6 * loops)
  const rows = clip(lean('rows', 1 + 7 * strength), 1, 8)
  if (rows > 1.05) grounds.push(`反復が題の ${repeatShare.toFixed(2)} を ${occurrences} 回覆う：題は ${rows.toFixed(1)} 回書かれる`)
  const spacing = 1 + 0.35 * (1 - repeatShare)
  const shear = clip(lean('shear', clip(1 / Math.max(1, units.length) + 0.6 * turnDensity, 0, 1.2)), 0, 1.2)
  const runs = units.map((u, i) => (i > 0 && units[i - 1].char === u.char ? 1 : 0)).reduce((t: number, v) => t + v, 0)
  const erased = units.filter((u) => u.absent).length
  const decay = clip(lean('decay', clip(0.3 * (runs / Math.max(1, units.length)) + 0.2 * (erased / Math.max(1, units.length)), 0, 0.4)), 0, 0.4)
  if (decay > 0.02) grounds.push(`同じ字の連なりと消された席：行ごとに ${(100 * decay).toFixed(0)}% ずつ小さくなる`)

  // --- the page ------------------------------------------------------------------
  const paper = paperParams(a, m, { potential, operation, side, units, sizes, grounds, lean })
  // what the page is about is written larger than the rest of it
  if (paper.hierarchy > 1.02) {
    const subject = focusGraphemes(a, m)
    const up = Math.sqrt(paper.hierarchy)
    for (const [i, u] of units.entries()) sizes[i] = sizes[i] * (subject.has(u.grapheme) ? up : 1 / up)
    grounds.push(`主題は他より ${paper.hierarchy.toFixed(1)} 倍の大きさで書かれる`)
  }

  return { params: { closure, corners, opening, eccentricity, tangency, side, weights, sizes, breaks, branch, rows, spacing, shear, decay, paper }, grounds }
}

/**
 * Where the figure stands on the page and how much of it it takes.
 *
 * v2c decides this once per poem as a scale regime (poem/scale.ts): a title
 * whose relations are weak is written small and aside (micro, 3.5–7 % of the
 * page); what an operation produced — a residue, the parts of a glyph — may be
 * written larger than the page and cut by it (macro, 55–110 %); everything else
 * stands between (normal, 10–30 %). The same two readings are taken here, but
 * as numbers rather than as four regimes, so that a title can stand anywhere
 * between them:
 *
 *   how much the reading yields   → how large the writing is, and so how much
 *                                   of the page it takes
 *   what an operation produced    → whether it may pass the page's edge, and
 *                                   how much larger its subject stands
 *
 * A small figure is also a figure with room around it, and it does not stand in
 * the middle of that room: it stands where the reading begins, so the page it
 * leaves empty is the page the reading walks into.
 */
function paperParams(
  a: Analysis,
  m: Material,
  ctx: { potential: number; operation: number; side: 1 | -1; units: Unit[]; sizes: number[]; grounds: string[]; lean: (key: string, value: number) => number },
): PaperParams {
  const { potential, operation, side, units, grounds, lean } = ctx
  const vertical = a.direction === 'vertical'
  // the size one character asks for, as a share of the page: micro → macro
  const scale = clip(lean('scale', clip(0.04 + 0.22 * potential + 0.9 * operation, 0.035, 1.15)), 0.035, 1.15)
  // how much of the page that is likely to take, for the standing back below
  const occupancy = clip((scale * Math.max(1, units.length)) / 0.86, 0.05, 1.3)
  // the smaller the figure, the further from the middle it may stand; a figure
  // larger than the page cannot be centred at all — the page cuts it where the
  // reading runs out
  const offset = clip(lean('offset', Math.max(clip(1.05 - occupancy), clip((occupancy - 1) * 3))))
  // Which way: against the writing, so that the page opens ahead of the reading,
  // and to the side the curve turns toward.
  const along = vertical ? { x: 0, y: 1 } : { x: 1, y: 0 }
  const across = vertical ? { x: -1, y: 0 } : { x: 0, y: 1 }
  const toward = Math.atan2(-along.y + across.y * side * 0.8, -along.x + across.x * side * 0.8)
  // what the page is about stands larger than the rest of the title
  const hierarchy = clip(lean('hierarchy', clip(1 + 3.2 * operation + 1.4 * clip((potential - 0.5) / 0.5), 1, 5)), 1, 5)
  grounds.push(
    `紙面：字は紙の ${(100 * scale).toFixed(1)}%（読みの実り ${potential.toFixed(2)}／操作の結果 ${operation.toFixed(2)}）、` +
      `図は紙の ${(100 * occupancy).toFixed(0)}% を占め、中心から ${offset.toFixed(2)} 離れて立つ` +
      (occupancy >= 1 ? '（紙に切られる）' : ''),
  )
  void m
  return { scale, offset, toward, hierarchy }
}

export interface MaterialGrounds {
  params: MaterialParams
  /** which character each source is written with, where the title offers one */
  chars: MaterialSources & { chars: Record<keyof MaterialSources, string | null> }
  grounds: string[]
}

/**
 * Where a title stands in the material's space: how much small material the
 * page carries, how fine it is, and where it stands — on the nucleus's own ink
 * (a form drawn in small marks), on a ring around it (satellites), or over the
 * page (dust). None of these is a kind of page: they are three weights, and
 * most titles have some of each.
 */
/**
 * A form read inside the character by the parts it falls into: 森's three 木,
 * 品's three 口. v2c's silhouette takes its material this way, and without it a
 * character that is made of a smaller character offers the poem nothing.
 * The strength is how much of the character those parts are, and how well they
 * read.
 */
function partInside(a: Analysis, grapheme: number | undefined): { char: string; score: number } | null {
  if (grapheme === undefined) return null
  const g = a.graphemes[grapheme]
  if (!g?.char.trim()) return null
  try {
    const metrics = a.glyphs.get(g.char).metrics
    const parts = structuralParts(a, grapheme)
    if (parts.length < 2) return null
    const read = parts.map((part) => ({ part, r: readPart(part, metrics, a.readables, g.char) })).filter((x) => x.r?.kind === 'character')
    if (!read.length) return null
    // the character most of the parts read as
    const counts = new Map<string, { n: number; score: number; share: number }>()
    for (const { part, r } of read) {
      const at = counts.get(r!.char) ?? { n: 0, score: 0, share: 0 }
      counts.set(r!.char, { n: at.n + 1, score: Math.max(at.score, r!.score), share: at.share + part.share })
    }
    const best = [...counts.entries()].sort((x, y) => y[1].n * y[1].share - x[1].n * x[1].share)[0]
    if (!best) return null
    const [char, { n, score, share }] = best
    return { char, score: clip(score * Math.min(1, share * 1.2) * (n > 1 ? 1 : 0.7)) }
  } catch {
    return null
  }
}

export function materialParams(
  a: Analysis,
  m: Material,
  figureNucleus: string | null,
  nucleusGrapheme?: number,
  motifs?: Motifs,
  rhyme?: number,
): MaterialGrounds {
  const lean = (key: string, value: number) => drawn(key, value, motifs, rhyme)
  const grounds: string[] = []
  const units = allUnits(m)
  const chars = a.graphemes.filter((g) => g.char.trim())
  const n = Math.max(1, chars.length)

  // what the title offers as material, and how much of it there is
  const counts = new Map<string, number>()
  for (const g of chars) counts.set(g.char, (counts.get(g.char) ?? 0) + 1)
  const repeated = [...counts.entries()].filter(([, c]) => c > 1).sort((x, y) => y[1] - x[1])[0] ?? null
  const repeatStrength = repeated ? clip((repeated[1] - 1) / 3 + 0.3) : 0
  const nucleus = figureNucleus ?? chars[0]?.char ?? ''
  const relation = a.glyphRelations.filter((r) => r.kind === 'containment' && r.outer === nucleus).sort((x, y) => y.score - x.score)[0] ?? null
  const part = partInside(a, nucleusGrapheme)
  // a form read inside the character: one the title also writes, or one the
  // character's own parts read as
  const innerStrength = Math.max(relation ? clip(relation.score) : 0, part ? part.score : 0)
  const innerChar = (part && (!relation || part.score > relation.score) ? part.char : relation?.inner) ?? null
  if (part) grounds.push(`「${nucleus}」の部品は「${part.char}」と読まれる（${part.score.toFixed(2)}）`)
  const rest = chars.filter((g) => g.char !== nucleus).map((g) => g.char)
  const restStrength = clip(rest.length / Math.max(1, n))
  const erased = units.filter((u) => u.absent).length
  const erasure = clip(erased / Math.max(1, units.length) + (a.relations.some((r) => r.kind === 'negation') ? 0.3 : 0))

  // how much material at all: what the title has to give
  // Where it stands. Each of the three needs its own evidence: with none of
  // them the page is the figure alone (a floor under any of them would put the
  // same halo on every page, which is a family again).
  const coordination = a.relations.some((r) => r.kind === 'coordination') ? 1 : 0
  const dependency = a.relations.some((r) => r.kind === 'dependency') ? 0.6 : 0
  const counters = a.interiors.get(nucleus)?.counters.length ?? 0
  // Where the material stands leans with the title's structures, but a place
  // with no evidence of its own is never opened by a lean alone: the pressure
  // is a share of what is already there.
  const onForm = lean('onForm', clip(innerStrength + 0.25 * clip(counters / 2)))
  const onRing = lean('onRing', clip(Math.max(coordination, dependency) * (0.35 + 0.5 * repeatStrength)))
  const onPage = lean('onPage', clip(0.7 * erasure + 0.25 * clip(repeatStrength - innerStrength)))
  const offeredMaterial = 0.55 * repeatStrength + 0.4 * innerStrength + 0.3 * erasure + 0.15 * restStrength
  const where = onForm + onRing + onPage
  // below what would read as a texture at all, or with nowhere grounded to
  // stand, a page is the figure alone
  const density = offeredMaterial < 0.18 || where < 0.15 ? 0 : lean('density', clip(offeredMaterial))
  grounds.push(
    `material ${density.toFixed(2)} ＝ 反復 ${repeatStrength.toFixed(2)}／字の中に読まれた形 ${innerStrength.toFixed(2)}／消された席 ${erasure.toFixed(2)}／題の残り ${restStrength.toFixed(2)}`,
  )

  grounds.push(`立つ場所：字のインク ${onForm.toFixed(2)}／環 ${onRing.toFixed(2)}／紙面 ${onPage.toFixed(2)}`)

  // How fine: the more the title offers, the finer the grain — and the denser
  // the letterform the material gathers on, the finer it has to be met, or the
  // form drawn in grains is not that form.
  const strokes = clip((inkOf(a, nucleus) - 0.12) / 0.16)
  const fineness = lean('fineness', clip(0.3 + 0.4 * repeatStrength + 0.25 * erasure + 0.3 * strokes))
  const special = a.morae.filter((mo) => mo.kind === 'N' || mo.kind === 'Q' || mo.kind === 'R' || mo.devoiced).length
  const regularity = clip(1 - 0.5 * (a.morae.length ? special / a.morae.length : 0))
  const cut = relation && relation.origin !== 'inventory' ? lean('cut', clip(relation.containment)) : 0
  // How far from the reading the material stands. The ring keeps the distance
  // the title's own material asks for — the more there is of it, the wider it
  // orbits; the dust strays as far as the title is loose from what is written:
  // an erasure scatters it over the page, a repetition keeps it near the words
  // it came from.
  const radius = clip(0.12 + 0.14 * repeatStrength + 0.06 * restStrength, 0.1, 0.32)
  const spread = lean('spread', clip(0.8 * erasure + 0.35 * restStrength - 0.2 * repeatStrength))
  if (onPage > 0.02) grounds.push(`塵は読みから ${spread.toFixed(2)} の幅に散る（消された席 ${erasure.toFixed(2)}／題の残り ${restStrength.toFixed(2)}）`)

  // as in v2c: the title's repetition first, then a form read inside the
  // character, then the rest of the title — its own character only where
  // nothing else is offered
  const offered = repeatStrength + innerStrength + 0.5 * restStrength
  const sources: MaterialSources = {
    repeat: repeatStrength,
    inner: innerStrength,
    rest: 0.5 * restStrength,
    self: offered < 0.2 ? 0.3 : 0,
  }
  return {
    params: { density, fineness, onForm, onRing, onPage, radius, spread, cut, regularity, sources },
    chars: {
      ...sources,
      chars: {
        repeat: repeated?.[0] ?? null,
        inner: innerChar,
        rest: rest[0] ?? null,
        self: nucleus || null,
      },
    },
    grounds,
  }
}
