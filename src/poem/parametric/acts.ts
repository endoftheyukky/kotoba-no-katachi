/**
 * Acts — what happens to the title's own characters on the page.
 *
 * Everything before this layer *places* the title: along a curve, in rows, at a
 * scale, somewhere on the paper. That was enough where the title does something
 * in its writing (it repeats, it holds two terms, one character sits in another),
 * and not enough where it does not: an ordinary word like 孤独 or 群衆 gave the
 * readings nothing to say, and every such word became the same page — the word,
 * set down small, in a corner. 孤独 and 群衆 were indistinguishable.
 *
 * An act is done *to* the word, and leaves its trace in the word:
 *
 *   gaps       the space between two characters opens or closes. Severance
 *              opens one seam (the word comes apart once); distance and
 *              openness open every gap evenly (the word spreads); multitude
 *              and joining draw the characters together.
 *   withdraw   one character leaves the others: it moves off into the page's
 *              empty side and grows smaller. Solitude, fading, distance.
 *   erosion    the characters lose parts of themselves as the reading goes on —
 *              whole components, at the letterform's own seams (憶 keeps 忄),
 *              so what is left is still a form and never a sliver. Fading,
 *              falling; what the poem erased.
 *   lean       characters tilt the way their own ink leans. Agitation; a held
 *              or whispered beat.
 *   cut        one character comes apart at its own seam — where the letterform
 *              itself divides — and its halves part. Severance.
 *
 * The *strength* of an act comes from meaning and structure together; its
 * *form* — which character withdraws, which seam is cut, which side erodes,
 * which way a character leans — always comes from the letterforms, the sound
 * or the word's own divisions. Two titles that mean nearly the same do not get
 * the same page: the act is the same kind of act, done to different writing.
 *
 * An economy. A page is not every act at once (CLAUDE.md: a small number of
 * operations for each composition): the acts compete, the strongest leads, and
 * every other act keeps only as much of its strength as it has against the
 * leader's, squared — half as strong, a quarter as present. Nothing switches;
 * the leader changes as smoothly as the readings do.
 *
 * None of this adds a mark. Nothing is illustrated: no character the title does
 * not write, no symbol for loneliness or crowds. Every act is an operation of
 * concrete poetry on the word itself — spacing, displacement, partial glyphs,
 * fragmentation, disappearance — and every one says, below, what it reads.
 */
import type { Analysis, Unit } from '../types'
import type { Rect } from '../../render/stage'
import { structuralParts } from '../operations/decomposition'
import type { Meaning } from '../../language/semantic/axes'
import type { Motifs } from './motif'

const clip = (v: number, lo = 0, hi = 1) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo)
/** the upper part of an axis acts: a word must lean clearly to one side before it does anything */
const up = (v: number, from = 0.2) => clip((v - from) / (1 - from))

export interface Acts {
  /** per gap between successive units: how much wider than the reading's own step (in steps; negative closes) */
  gaps: number[]
  /** one character leaves: which, how far (steps), how much smaller (0–1), which way (page angle, radians) */
  withdraw: { unit: number; distance: number; shrink: number; angle: number } | null
  /** per unit, how much of the glyph is taken, and what of it is kept (em space) */
  erosion: { amount: number; keep: Rect[] | null }[]
  /** per unit, how far it leans (degrees) */
  lean: number[]
  /** one character divided at its own seam, the halves parted by this share of its size */
  cut: { unit: number; axis: 'x' | 'y'; at: number; apart: number } | null
  /** how strong the leading act is, before competing (the material competes with it) */
  lead: number
  /** which act leads the page, if any does (review only) */
  leader: string | null
  /** what was read, and what it did (review only) */
  grounds: string[]
}

export const NO_ACTS = (n: number): Acts => ({
  gaps: new Array(Math.max(0, n - 1)).fill(0),
  withdraw: null,
  erosion: new Array(n).fill(0).map(() => ({ amount: 0, keep: null })),
  lean: new Array(n).fill(0),
  cut: null,
  lead: 0,
  leader: null,
  grounds: [],
})

/** the meaning's poles, each 0–1, weighted by how much of the title was read */
export function poles(meaning: Meaning | null | undefined) {
  const m = meaning?.axes
  const k = meaning ? meaning.coverage : 0
  const v = (key: keyof NonNullable<typeof m>) => (m ? m[key] : 0)
  return {
    alone: k * up(-v('multitude')),
    many: k * up(v('multitude')),
    still: k * up(-v('agitation')),
    stirred: k * up(v('agitation')),
    open: k * up(-v('enclosure')),
    closed: k * up(v('enclosure')),
    joined: k * up(-v('severance')),
    severed: k * up(v('severance')),
    lasting: k * up(-v('vanishing')),
    fading: k * up(v('vanishing')),
    near: k * up(-v('distance')),
    far: k * up(v('distance')),
    light: k * up(-v('weight')),
    heavy: k * up(v('weight')),
    rising: k * up(-v('descent')),
    falling: k * up(v('descent')),
    thing: k * up(-v('abstraction')),
    idea: k * up(v('abstraction')),
  }
}
export type Poles = ReturnType<typeof poles>

function metricsOf(a: Analysis, char: string) {
  try {
    return a.glyphs.get(char).metrics
  } catch {
    return null
  }
}

/** how much a glyph leans: its ink's centre of mass left (−1) or right (+1) of the middle */
function inkLean(a: Analysis, char: string): number {
  const m = metricsOf(a, char)
  if (!m || !m.cols.length) return 0
  const total = m.cols.reduce((s, v) => s + v, 0) || 1
  const centre = m.cols.reduce((s, v, i) => s + v * (i / (m.cols.length - 1) - 0.5), 0) / total
  return clip(centre * 6, -1, 1)
}

/** the side of a glyph where its ink is thinnest: where it would give way first */
function thinnest(a: Analysis, char: string, vertical: boolean): 'top' | 'bottom' | 'left' | 'right' {
  const m = metricsOf(a, char)
  if (!m) return vertical ? 'bottom' : 'right'
  const quarter = (xs: number[], from: number) => {
    const n = Math.max(1, Math.floor(xs.length / 4))
    const part = from === 0 ? xs.slice(0, n) : xs.slice(xs.length - n)
    return part.reduce((s, v) => s + v, 0) / n
  }
  const sides = [
    { side: 'top' as const, ink: quarter(m.rows, 0) },
    { side: 'bottom' as const, ink: quarter(m.rows, 1) },
    { side: 'left' as const, ink: quarter(m.cols, 0) },
    { side: 'right' as const, ink: quarter(m.cols, 1) },
  ]
  sides.sort((x, y) => x.ink - y.ink)
  return sides[0].side
}

export interface ActsContext {
  a: Analysis
  units: Unit[]
  meaning: Meaning | null | undefined
  motifs: Motifs
  /** per unit, its beats */
  weights: number[]
  /** the direction the figure stands toward on the page (paper.toward) — the empty page lies opposite */
  toward: number
}

/**
 * The acts' strengths before they compete, and after. `crowd` — the title
 * written more than once for a word of many — is read in the parameters
 * (rows), but it competes here with the rest.
 */
export function economy(p: Poles, motifs: Motifs) {
  const raw = {
    // a coordination is a seam between two terms: it proposes the split too
    split: clip(p.severed + 0.55 * motifs.pairing),
    spread: clip((0.8 * p.far + 0.6 * p.open + 0.35 * p.still) / 1.2 + 0.25 * motifs.articulation),
    gather: clip(0.5 * (p.many + p.joined)),
    withdraw: clip(0.8 * p.alone + 0.35 * p.fading + 0.3 * p.far - 0.5 * p.many),
    erode: clip(0.85 * p.fading + 0.25 * p.falling + 0.3 * motifs.absence),
    lean: clip(p.stirred),
    crowd: clip(0.9 * p.many + 0.3 * p.stirred),
  }
  const lead = Math.max(...Object.values(raw), 1e-6)
  const kept = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v * (v / lead) ** 2])) as typeof raw
  const leader = (Object.keys(raw) as (keyof typeof raw)[]).reduce((b, k) => (raw[k] > raw[b] ? k : b), 'split' as keyof typeof raw)
  return { raw, kept, leader: lead > 0.05 ? leader : null }
}

/**
 * What of a character is left when `amount` of it is worn away, taken from the
 * end the reading moves toward: whole components at the letterform's own
 * seams, the farthest first, never the last one — a component is still a form.
 * A character that does not come apart loses at most a third, from its
 * thinnest side, and only where the wear is strong enough to be seen as wear.
 */
function wornKeep(a: Analysis, unit: Unit, amount: number, along: { x: number; y: number }, vertical: boolean, alone: boolean): Rect[] | null {
  if (amount < 0.08) return null
  let parts: ReturnType<typeof structuralParts> = []
  try {
    parts = unit.grapheme !== undefined ? structuralParts(a, unit.grapheme) : []
  } catch {
    parts = []
  }
  // Only a kanji loses whole components: its components are forms of their own
  // (記 keeps 言, 憶 keeps 忄). A kana that loses a stroke becomes another kana
  // (け into something like ナ) — a misspelling, not what is left of a word — so
  // kana are only worn at an edge.
  // A title of one character is that character: losing a component it would
  // become another word (愛 would read as 受), so it is only worn at an edge.
  const kanji = [...unit.char].every((c) => /\p{Script=Han}/u.test(c))
  if (kanji && !alone && parts.length >= 2) {
    const ordered = [...parts].sort((p, q) => q.centroid.x * along.x + q.centroid.y * along.y - (p.centroid.x * along.x + p.centroid.y * along.y))
    let gone = 0
    const kept = [...ordered]
    while (kept.length > 1 && gone + kept[0].share <= amount + 0.12 && 1 - gone - kept[0].share >= 0.35) {
      gone += kept[0].share
      kept.shift()
    }
    if (kept.length === ordered.length) return null
    return kept.flatMap((p) => p.keep)
  }
  if (amount < 0.3) return null
  const m = metricsOf(a, unit.char)
  const side = thinnest(a, unit.char, vertical)
  const cut = Math.min(0.34, amount * 0.5)
  const hw = m?.half.w || 50
  const hh = m?.half.h || 50
  const far = 80
  if (side === 'bottom') return [{ x: -far, y: -far, w: 2 * far, h: far + hh - 2 * hh * cut }]
  if (side === 'top') return [{ x: -far, y: -hh + 2 * hh * cut, w: 2 * far, h: far + hh - 2 * hh * cut }]
  if (side === 'right') return [{ x: -far, y: -far, w: far + hw - 2 * hw * cut, h: 2 * far }]
  return [{ x: -hw + 2 * hw * cut, y: -far, w: far + hw - 2 * hw * cut, h: 2 * far }]
}

export function readActs(ctx: ActsContext): Acts {
  const { a, units, meaning, motifs, weights, toward } = ctx
  const n = units.length
  const acts = NO_ACTS(n)
  if (!n) return acts
  const p = poles(meaning)
  const vertical = a.direction === 'vertical'
  const along = vertical ? { x: 0, y: 1 } : { x: 1, y: 0 }
  const written = units.map((u) => !u.absent && !!u.char.trim())
  const { kept: e, raw, leader } = economy(p, motifs)
  acts.lead = Math.max(...Object.values(raw))
  acts.leader = leader
  if (leader) acts.grounds.push(`主な行為：${leader}（${Object.entries(e).map(([k, v]) => k + ' ' + v.toFixed(2)).join('／')}）`)

  // --- gaps -----------------------------------------------------------------
  // RULE: severance opens one seam — the strongest division the word has (a
  // word boundary, else the middle) — so the word comes apart once; distance,
  // openness and stillness open every gap evenly, so the word spreads; many
  // and joined draw the characters together.
  if (n > 1) {
    const boundary = units.slice(1).map((u, i) => (a.tokenOf[u.grapheme] !== a.tokenOf[units[i].grapheme] ? 1 : 0))
    const seam = boundary.indexOf(1) >= 0 ? boundary.indexOf(1) : Math.floor((n - 2) / 2)
    for (let i = 0; i < n - 1; i++)
      acts.gaps[i] = 1.6 * e.spread * (0.6 + 0.4 * boundary[i]) - 0.35 * e.gather + (i === seam ? 2.6 * e.split : 0)
    if (e.split > 0.08) acts.grounds.push(`裂け（${e.split.toFixed(2)}）：${seam + 1} 字目の後で語が離れる`)
    if (e.spread > 0.08) acts.grounds.push(`遠さ・開け・静けさ（${e.spread.toFixed(2)}）：字と字の間が広がる`)
    if (e.gather > 0.08) acts.grounds.push(`多さ・結び（${e.gather.toFixed(2)}）：字が寄り合う`)
  }

  // --- withdraw -------------------------------------------------------------
  // RULE: solitude, fading and distance send one character away into the empty
  // side of the page, smaller. Which one: the character with the least presence
  // — the least ink over the fewest beats — the one that would leave first.
  let away = -1
  if (n > 1 && e.withdraw > 0.03) {
    const presence = units.map((u, i) => (written[i] ? (metricsOf(a, u.char)?.density ?? 0.2) * (weights[i] ?? 1) : Infinity))
    away = n - 1
    for (let i = 0; i < n; i++) if (presence[i] < presence[away] - 1e-6) away = i
    acts.withdraw = { unit: away, distance: 1.2 + 5 * e.withdraw, shrink: 0.3 * e.withdraw, angle: toward + Math.PI }
    acts.grounds.push(`独り・薄れ・遠さ（${e.withdraw.toFixed(2)}）：「${units[away].char}」が余白の側へ離れ、小さくなる`)
  }

  // --- erosion --------------------------------------------------------------
  // RULE: fading and falling wear the characters as the reading goes on — its
  // first character whole, its last the most worn — by whole components (see
  // wornKeep). What the poem itself erased (absence) does the same.
  // A title of one character is that character: any of it worn away and it
  // may read as another word (愛 as 受). It is not worn at all.
  if (e.erode > 0.03 && written.filter(Boolean).length > 1) {
    units.forEach((u, i) => {
      if (!written[i]) return
      const t = n > 1 ? i / (n - 1) : 1
      const amount = clip(e.erode * t ** 1.3 * 0.75, 0, 0.6)
      acts.erosion[i] = { amount, keep: wornKeep(a, u, amount, along, vertical, written.filter(Boolean).length === 1) }
    })
    if (acts.erosion.some((x) => x.keep)) acts.grounds.push(`薄れ・落ち（${e.erode.toFixed(2)}）：読みの終わりほど、字は自分の部品を失う`)
  }

  // --- lean -----------------------------------------------------------------
  // RULE: agitation tilts each character the way its own ink leans; a held or
  // whispered beat (ん っ ー, a devoiced vowel) tilts its character a little.
  // A glyph whose ink is centred does not lean at all.
  const stir = 26 * e.lean
  units.forEach((u, i) => {
    if (!written[i]) return
    const beat = a.morae.find((mo) => mo.graphemes.includes(u.grapheme))
    const held = beat && (beat.kind === 'N' || beat.kind === 'Q' || beat.kind === 'R' || beat.devoiced) ? 7 : 0
    acts.lean[i] = (stir + held) * inkLean(a, u.char)
  })
  if (stir > 2) acts.grounds.push(`ざわめき（${e.lean.toFixed(2)}）：字はそれぞれ自分の墨の傾きへ傾く`)

  // --- cut ------------------------------------------------------------------
  // RULE: severance divides one character where the letterform itself divides
  // (its seam): the character whose seam is cleanest — the most even split —
  // and never the one that withdrew or wore away (one act to a character).
  if (e.split > 0.12) {
    let best = -1
    let evenness = 0
    units.forEach((u, i) => {
      if (i === away || acts.erosion[i].keep) return
      // a kanji divided at its seam shows two components; a kana divided
      // would only read as a broken kana
      if (![...u.char].every((c) => /\p{Script=Han}/u.test(c))) return
      // and only a kanji whose components really stand apart — separate islands
      // or a clean gap between them (断, 絶, 離). Cut through solid strokes (土,
      // 大, 本) a character does not come apart, it only looks broken.
      let parts: ReturnType<typeof structuralParts> = []
      try {
        parts = structuralParts(a, u.grapheme)
      } catch {
        parts = []
      }
      if (parts.length < 2 || parts.some((q) => q.cut && q.cut.closure > 0.35)) return
      const m = written[i] ? metricsOf(a, u.char) : null
      if (!m?.seam) return
      const even = 1 - Math.abs(m.seam.share[0] - m.seam.share[1])
      if (even > evenness + 1e-6) {
        evenness = even
        best = i
      }
    })
    if (best >= 0 && evenness > 0.35) {
      const seam = metricsOf(a, units[best].char)!.seam
      acts.cut = { unit: best, axis: seam.axis, at: seam.at, apart: 0.12 + 0.45 * e.split }
      acts.grounds.push(`裂け（${e.split.toFixed(2)}）：「${units[best].char}」が字そのものの継ぎ目で割れる`)
    }
  }
  return acts
}
