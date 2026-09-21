/**
 * What every mark grammar shares (v2).
 *
 * A grammar takes the page a composition made and says how its marks behave:
 * whether they stay as they are (uniform, which is v1), fade, spread into a
 * field of small marks, gather into a form, or turn in sequence. It does not
 * move the page's structure; it acts inside it. Every mark it adds carries
 * its provenance, so what the page shows can be traced back to the title.
 */
import type { Rng } from '../../core/random'
import { BANDS } from '../contract'
import type { GrammarId, Mark, Provenance } from '../types'
import { boxOf, inkAt, type PageView } from './page'

export interface GrammarOffer {
  grounds: string[]
  uses: { property: string; value: string }[]
}

export interface MarkGrammar {
  id: GrammarId
  title: string
  rules: readonly string[]
  /** what in this page the grammar would act on; null where it has nothing to act on */
  offer(v: PageView): GrammarOffer | null
  /** the page's marks, as this grammar writes them */
  apply(v: PageView, rng: Rng): Mark[]
}

/** the smallest a grain is written: below the micro band it stops being a character */
export const GRAIN_MIN = BANDS.micro[0] * 0.8

/** 4 × 4 ordered-dither thresholds: a density drawn without chance */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16)
export const dither = (i: number, j: number) => BAYER[(((j % 4) + 4) % 4) * 4 + (((i % 4) + 4) % 4)]

export const derive = (grammar: GrammarId, kind: Provenance['kind'], note: string, from?: number): Provenance => ({
  grammar,
  kind,
  note,
  ...(from !== undefined ? { from } : {}),
})

/**
 * Whether a small mark of this size can stand at this point without touching
 * what is already on the page: outside every other mark's box, with a margin
 * of a quarter of the larger of the two.
 */
export function clear(v: PageView, others: Mark[], x: number, y: number, size: number): boolean {
  const h = size / 2
  for (const k of others) {
    const b = boxOf(k)
    const m = Math.max(size, Math.min(k.size, size * 4)) * 0.25
    if (x + h > b.x0 - m && x - h < b.x1 + m && y + h > b.y0 - m && y - h < b.y1 + m) return false
  }
  void v
  return true
}

/**
 * Whether a small mark can stand at this point: nowhere on the ink of the
 * page's own marks (their white is free), and not on another small mark.
 * Ink, not boxes: a ring round a character may pass through the corners of
 * its em square, never through a stroke.
 */
export function free(v: PageView, own: Mark[], added: Mark[], x: number, y: number, size: number): boolean {
  const pts = [
    [0, 0], [0.42, 0.42], [-0.42, 0.42], [0.42, -0.42], [-0.42, -0.42], [0, 0.45], [0.45, 0], [0, -0.45], [-0.45, 0],
    [0.22, 0.22], [-0.22, 0.22], [0.22, -0.22], [-0.22, -0.22],
  ].map(
    ([u, w]) => ({ x: x + u * size, y: y + w * size }),
  )
  if (own.some((k) => pts.some((p) => inkAt(v, k, p)))) return false
  return added.every((k) => Math.abs(k.x - x) >= (k.size + size) * 0.5 || Math.abs(k.y - y) >= (k.size + size) * 0.5)
}

/** an erased seat that is a silent beat (a sokuon) rather than a character taken away */
export function silentSeat(v: PageView, grapheme: number): boolean {
  return [v.m.primary, ...v.m.modifiers].some(
    (p) => p.focus.kind === 'absence' && p.focus.silence && p.focus.graphemes.includes(grapheme),
  )
}

/** reading order of a unit of the title: its grapheme, where it has one */
export const orderOf = (k: Mark) => k.grapheme ?? Number.MAX_SAFE_INTEGER

/** a plastic value inside a range, from the page's own seed */
export const within = (rng: Rng, lo: number, hi: number) => lo + (hi - lo) * rng.next()
