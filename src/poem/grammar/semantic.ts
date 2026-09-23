/**
 * 意味の近傍 — SEMANTIC TOUCH (v2d experiment, review only)
 *
 * Whether nearness in a space of meaning can be one more material for the
 * page's grammar — not a word placed beside the title to explain it.
 *
 *   linguistic input  the heads: the characters of the title that are whole
 *                     words by themselves (a one-character noun). A character
 *                     that is only part of a word (位 of 位置, the 咲 of 咲く)
 *                     has no meaning of its own to be near to.
 *   candidates        from three sources, each giving a band of distance:
 *                       symbolic  seed-lexicon v0: inside (made-of, part,
 *                                 unit) → near; beside (with, organ) →
 *                                 distinct; before/after → mid; opposite →
 *                                 counter
 *                       aozora    characters that keep company in written
 *                                 literature (co-occurrence, PPMI, SVD)
 *                       chive     single-kanji words used alike (word2vec)
 *                     for the two vector sources by rank: 1–2 near, 3–8
 *                     distinct, 9–24 mid; counter: near one head and absent
 *                     from the neighbourhood of every other head. Never a
 *                     character the title writes, nor one read as a part of
 *                     one of its characters (that is form, not meaning).
 *   rule              a candidate enters only a place the page's grammar
 *                     already has: one grain of a texture of grains (the
 *                     grain nearest the texture's centre) is written in a
 *                     near candidate; one mark of the outermost orbit ring
 *                     (where the ring begins) in a mid candidate; where the
 *                     title has two heads, one smallest mark at the centre of
 *                     the page's widest white in a counter candidate. At most
 *                     two marks; a page with no such place takes none.
 *   choice (hybrid)   among the candidates of the band: not a direct
 *                     relation of the lexicon (made-of, part, unit, organ —
 *                     these explain); then one both vector sources agree on;
 *                     then the nearest.
 */
import { seedLexicon } from '../../language/lexicon'
import { neighbours, neighboursLoaded, tableId, type VecSource } from '../../language/semantic'
import { PAGE } from '../../render/stage'
import type { Mark } from '../types'
import { derive, free } from './common'
import { partsRead } from './material'
import { boxOf, type PageView } from './page'
import { GRAIN_MIN } from './roles'

export type SemSource = 'symbolic' | VecSource | 'hybrid'
export type SemBand = 'near' | 'distinct' | 'mid' | 'counter'

export interface SemCandidate {
  char: string
  head: string
  from: number
  source: 'symbolic' | VecSource
  rank: number
  band: SemBand
  /** a direct relation the lexicon states (made-of, part, unit, organ): it explains */
  explicit: boolean
  statement: string
}

const EXPLICIT = new Set(['made-of', 'part', 'unit', 'organ'])
const isKanji = (c: string) => /^[㐀-鿿々]$/u.test(c)

/** the title's characters that are whole words by themselves, in reading order */
export function headsOf(v: PageView): { char: string; grapheme: number }[] {
  const out: { char: string; grapheme: number }[] = []
  for (const t of v.a.tokens) {
    if (t.end - t.start !== 1 || (t.pos !== 'noun' && t.pos !== 'other')) continue
    const g = v.a.graphemes[t.start]
    if (g && isKanji(g.char)) out.push({ char: g.char, grapheme: g.index })
  }
  return out
}

function excluded(v: PageView): Set<string> {
  const out = new Set(v.a.graphemes.map((g) => g.char))
  for (const g of v.a.graphemes) for (const p of partsRead(v, g.index)) if (p.char) out.add(p.char)
  return out
}

function lexLink(head: string, char: string) {
  return (seedLexicon().links.get(head) ?? []).find((l) => l.char === char)
}

/** every candidate of every source, in bands */
export function candidates(v: PageView): SemCandidate[] {
  const heads = headsOf(v)
  const skip = excluded(v)
  const out: SemCandidate[] = []
  const lex = seedLexicon()
  for (const h of heads) {
    // symbolic
    let r = 0
    for (const l of lex.links.get(h.char) ?? []) {
      if (skip.has(l.char) || !isKanji(l.char)) continue
      const band: SemBand | null = l.relation === 'opposite' ? 'counter' : l.rank === 0 ? 'near' : l.rank === 1 ? 'distinct' : l.rank === 2 ? 'mid' : null
      if (!band) continue
      out.push({ char: l.char, head: h.char, from: h.grapheme, source: 'symbolic', rank: ++r, band, explicit: EXPLICIT.has(l.relation), statement: `${lex.version}: ${h.char} —${l.relation}→ ${l.char}` })
    }
    // vectors
    if (!neighboursLoaded()) continue
    for (const source of ['aozora', 'chive'] as const) {
      let rank = 0
      for (const n of neighbours(source, h.char)) {
        if (skip.has(n.char)) continue
        rank++
        const band: SemBand = rank <= 2 ? 'near' : rank <= 8 ? 'distinct' : 'mid'
        const l = lexLink(h.char, n.char)
        out.push({ char: n.char, head: h.char, from: h.grapheme, source, rank, band, explicit: !!l && EXPLICIT.has(l.relation), statement: `${tableId(source)}: ${h.char} ~ ${n.char} (${rank}, cos ${n.cos.toFixed(2)})` })
      }
      // counter: near this head, absent from the neighbourhood of every other head
      const others = heads.filter((o) => o.char !== h.char)
      if (!others.length) continue
      const near = new Set(others.flatMap((o) => neighbours(source, o.char).map((n) => n.char)))
      let crank = 0
      for (const n of neighbours(source, h.char)) {
        if (skip.has(n.char) || near.has(n.char)) continue
        if (neighbours(source, n.char).some((m) => others.some((o) => o.char === m.char))) continue
        const l = lexLink(h.char, n.char)
        out.push({ char: n.char, head: h.char, from: h.grapheme, source, rank: ++crank, band: 'counter', explicit: !!l && EXPLICIT.has(l.relation), statement: `${tableId(source)}: ${h.char} ~ ${n.char}, 他の語の近傍にない (${crank})` })
      }
    }
  }
  return out
}

/** the candidate a source gives for a band: its own nearest, or (hybrid) the least explanatory, agreed, nearest */
export function choose(cs: SemCandidate[], band: SemBand, source: SemSource): SemCandidate | null {
  const inBand = cs.filter((c) => c.band === band)
  if (source !== 'hybrid') return inBand.filter((c) => c.source === source).sort((p, q) => p.rank - q.rank)[0] ?? null
  const agreed = (c: SemCandidate) =>
    c.source !== 'symbolic' && cs.some((o) => o.source !== 'symbolic' && o.source !== c.source && o.char === c.char && o.head === c.head)
  return (
    [...inBand].sort(
      (p, q) =>
        Number(p.explicit) - Number(q.explicit) ||
        Number(agreed(q)) - Number(agreed(p)) ||
        p.rank - q.rank ||
        Number(p.source === 'symbolic') - Number(q.source === 'symbolic'),
    )[0] ?? null
  )
}

/** the page's marks, touched by meaning where its grammar has a place for it */
export function touch(v: PageView, marks: Mark[], source: SemSource): { marks: Mark[]; used: SemCandidate[] } {
  const cs = candidates(v)
  const derived = marks.filter((k) => k.derived && k.derived.kind !== 'semantic')
  const out = [...marks]
  const used: SemCandidate[] = []
  const write = (k: Mark, c: SemCandidate, note: string) => {
    const i = out.indexOf(k)
    out[i] = { ...k, char: c.char, derived: derive(k.derived!.grammar, 'semantic', note, c.from, c.statement) }
    used.push(c)
  }
  const rings = derived.filter((k) => k.derived!.grammar === 'orbit')
  if (rings.length) {
    // mid: one mark of the outermost ring, where the ring begins
    const c = choose(cs, 'mid', source)
    if (c) {
      const own = marks.filter((k) => !k.derived)
      const dist = (k: Mark) => Math.min(...own.map((o) => Math.hypot(o.x - k.x, o.y - k.y)))
      const far = Math.max(...rings.map(dist))
      const outer = rings.filter((k) => dist(k) >= far - k.size * 1.5)
      write(outer[0], c, `軌道の一つが、意味の中ほどの距離にある「${c.char}」になる`)
    }
  } else {
    const grains = derived.filter((k) => k.role === 'grain' || k.role === 'trace' || k.role === 'satellite')
    if (grains.length) {
      // near: one grain of the texture, the one at its centre
      const c = choose(cs, 'near', source)
      if (c) {
        const cx = grains.reduce((s, k) => s + k.x, 0) / grains.length
        const cy = grains.reduce((s, k) => s + k.y, 0) / grains.length
        const heart = grains.reduce((p, k) => (Math.hypot(k.x - cx, k.y - cy) < Math.hypot(p.x - cx, p.y - cy) ? k : p))
        write(heart, c, `粒の中心の一つが、意味の最も近くにある「${c.char}」になる`)
      }
    }
  }
  // counter: only where the page already has a grammar's marks and the title two heads
  if (derived.length) {
    // never the character a slot already took
    const c = choose(cs.filter((x) => !used.some((u) => u.char === x.char)), 'counter', source)
    if (c) {
      const s = GRAIN_MIN * PAGE
      const spot = widestWhite(v, out, s)
      if (spot && free(v, out.filter((k) => !k.derived), out.filter((k) => k.derived), spot.x, spot.y, s * 1.2)) {
        out.push({ char: c.char, x: spot.x, y: spot.y, size: s, role: 'auxiliary', derived: derive('uniform', 'semantic', `一つの語の近くにあり、他の語から離れた「${c.char}」が、紙面の最も広い白に一つ`, c.from, c.statement) })
        used.push(c)
      }
    }
  }
  return { marks: out, used }
}

/** the centre of the widest empty circle the page leaves (coarse grid, boxes as ink) */
function widestWhite(v: PageView, marks: Mark[], s: number): { x: number; y: number } | null {
  void v
  const N = 40
  const cell = PAGE / N
  const margin = PAGE * 0.06
  let best: { x: number; y: number; r: number } | null = null
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const x = (i + 0.5) * cell
      const y = (j + 0.5) * cell
      let r = Math.min(x - margin, y - margin, PAGE - margin - x, PAGE - margin - y)
      for (const k of marks) {
        const b = boxOf(k)
        r = Math.min(r, Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.y0 - y, 0, y - b.y1)))
      }
      if (r > s && (!best || r > best.r)) best = { x, y, r }
    }
  return best
}
