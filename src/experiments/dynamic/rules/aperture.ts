/**
 * 開口 — APERTURE
 *
 * linguistic input
 *   the morae in order; for each, a relative degree of opening taken from its
 *   vowel class (open あ / middle え お / close い う), and the way its onset
 *   closes the mouth (stop, friction, nasal, glide, none). ん, っ, ー.
 *   These are poetic classes, not measurements: only their order matters,
 *   and each word is measured against its own widest mora.
 *
 * transformation rule
 *   The page is divided into one slot per mora, in writing order (vertical
 *   strips right→left, or horizontal bands top→bottom for a horizontal word).
 *   Behind each slot stands that mora's glyph, far larger than the page; the
 *   slot is a mouth that reveals it only through an opening.
 *   ー widens the previous slot into its own; っ is a slot that never opens.
 *
 * start   every mouth at its closure: a line whose weight is set by the onset
 *         (a stop is the finest line, friction wider, a vowel already ajar).
 *         A white page crossed by broken hairlines.
 * middle  every mouth at its vowel: the opening is the mora's degree relative
 *         to the widest in the word. The word becomes a row of cut-out
 *         fragments whose widths are its vowel pattern.
 * final   the widest mora (the last one, if several tie) opens across the
 *         whole page; the others close. One glyph, too large to be read.
 */
import { Track, inOut } from '../../core/time'
import { EM } from '../../glyph/font'
import { GlyphFigure } from '../../glyph/figure'
import { GRID } from '../../glyph/metrics'
import type { GlyphSource } from '../../glyph/source'
import type { Manner, Mora, Vowel } from '../../language/types'
import type { Rng } from '../../core/random'
import { CENTRE, PAGE } from '../../render/stage'
import type { Composition, Cue, PoeticRule } from '../types'

/** relative degree of opening — an ordinal, poetic class */
const OPEN: Record<Vowel, number> = { a: 3, e: 2, o: 2, u: 1, i: 1 }

function degree(mo: Mora): number {
  switch (mo.kind) {
    case 'cv':
      return OPEN[mo.vowel!] * (mo.devoiced ? 0.5 : 1)
    case 'N':
      return 0.4 // ん: the mouth hums shut
    case 'unread':
      return 1.5 // unread kanji: half open, neither vowel nor consonant
    case 'R':
      return 1
    case 'Q':
      return 0
  }
}

type Closure = Manner | 'moraicNasal' | 'unread'

/** width of the closed mouth, page units — the finer, the more complete the closure */
const CLOSURE: Record<Closure, number> = {
  plosive: 3,
  affricate: 4,
  voicedPlosive: 5,
  tap: 6,
  nasal: 7,
  moraicNasal: 7,
  fricative: 12,
  voicedFricative: 14,
  unread: 12,
  glide: 20,
  none: 28,
}

/** how the mouth goes from closure to vowel: [delay, duration] in seconds */
const RELEASE: Record<Closure, [number, number]> = {
  plosive: [0.04, 0.05], // held, then released at once
  affricate: [0.06, 0.08],
  voicedPlosive: [0.05, 0.06],
  tap: [0.02, 0.18],
  fricative: [0.25, 0.3], // held narrow, then opening
  voicedFricative: [0.22, 0.3],
  nasal: [0.1, 0.5], // slowly
  moraicNasal: [0.1, 0.5],
  unread: [0, 0.7],
  glide: [0, 0.3],
  none: [0, 0.25],
}

interface Slot {
  first: number
  count: number
  mora: Mora
}

export const aperture: PoeticRule = {
  id: 'aperture',
  title: '開口',
  statement: {
    input: 'mora order; relative opening class of each vowel; onset closure; ん / っ / ー',
    transformation: 'one slot per mora; each slot is a mouth revealing a glyph larger than the page',
    start: 'every mouth at its closure: hairlines weighted by the onset',
    middle: 'every mouth at its vowel, relative to the widest in the word',
    final: 'the widest mora opens across the whole page',
  },

  affinity(word) {
    const spoken = word.morae.filter((mo) => mo.kind === 'cv' || mo.kind === 'N').length
    if (spoken === 0) return 0.4
    const degrees = new Set(word.morae.map(degree))
    return 1 + (word.morae.length <= 4 ? 0.8 : 0) + (degrees.size > 1 ? 0.6 : 0)
  },

  compose(word, { stage, rng, glyphs }): Composition {
    const m = word.morae.length
    const vertical = word.direction === 'vertical'
    // a slot is at most half the page, so that the final opening is always an opening
    const unit = PAGE / Math.max(m, 2)
    const margin = (PAGE - m * unit) / 2

    // slots: ー extends the previous mouth; っ keeps its slot but never opens
    const slots: Slot[] = []
    for (const mo of word.morae) {
      const prev = slots[slots.length - 1]
      if (mo.kind === 'R' && prev && prev.mora.kind !== 'Q') prev.count++
      else slots.push({ first: mo.index, count: 1, mora: mo })
    }
    const open = slots.filter((s) => s.mora.kind !== 'Q')
    if (!open.length) open.push(slots[0]) // a word of silence still has one closed mouth
    const widest = Math.max(0.4, ...open.map((s) => degree(s.mora)))
    let peak = open[0]
    for (const s of open) if (degree(s.mora) >= degree(peak.mora)) peak = s

    const S = PAGE * rng.range(2.2, 2.9) // glyph em size: always larger than the page
    const k = S / EM
    const cues: Cue[] = [{ t: 0, kind: 'present', morae: [], amount: 0 }]
    const firstOpen = 1.4

    const mouths = open.map((slot) => {
      const mo = slot.mora
      const indices = Array.from({ length: slot.count }, (_, i) => slot.first + i)
      // slot centre across the writing progression
      const along = margin + (slot.first + slot.count / 2) * unit
      const c = vertical ? PAGE - along : along
      const closure: Closure = mo.kind === 'N' ? 'moraicNasal' : mo.kind === 'unread' ? 'unread' : mo.manner
      const w0 = CLOSURE[closure]
      const rel = degree(mo) / widest
      const wm = Math.max(w0, slot.count * unit * rel)

      // the glyph behind the slot, placed so that the slot crosses its ink
      const src = glyphs.get(word.graphemes[mo.graphemes[0]].char)
      const a = anchor(src, k, vertical, rng)
      const clip = stage.clip([{ x: 0, y: 0, w: 0, h: 0 }])
      const group = stage.el('g', { 'clip-path': clip.url }, stage.layer)
      new GlyphFigure(stage, src, group).place({
        x: vertical ? c - a.x * k : CENTRE - a.x * k,
        y: vertical ? CENTRE - a.y * k : c - a.y * k,
        size: S,
      })

      const lo = new Track(c - w0 / 2)
      const hi = new Track(c + w0 / 2)
      const at = firstOpen + slot.first * 0.14 // mouths open in reading order
      const [delay, dur] = RELEASE[closure]
      lo.hold(at + delay).to(at + delay + dur, c - wm / 2, inOut)
      hi.hold(at + delay).to(at + delay + dur, c + wm / 2, inOut)
      cues.push({ t: at, kind: 'open', morae: indices, amount: rel })
      return { slot, indices, c, lo, hi, rect: clip.rects[0], opened: at + delay + dur, rel }
    })

    const middle = Math.max(...mouths.map((mo) => mo.opened)) + 0.1
    const turn = middle + 2.0
    const final = turn + 1.2
    for (const mo of mouths) {
      if (mo.slot === peak) {
        mo.lo.hold(turn).to(final, 0, inOut)
        mo.hi.hold(turn).to(final, PAGE, inOut)
        cues.push({ t: turn, kind: 'expand', morae: mo.indices, amount: 1 })
      } else {
        mo.lo.hold(turn).to(final, mo.c, inOut)
        mo.hi.hold(turn).to(final, mo.c, inOut)
        cues.push({ t: turn, kind: 'close', morae: mo.indices, amount: mo.rel })
      }
    }
    cues.push({ t: final + 0.05, kind: 'hold', morae: mouths.find((mo) => mo.slot === peak)!.indices, amount: 1 })

    return {
      duration: final + 0.05 + 2.6,
      states: { start: 0, middle, final: final + 0.05 },
      cues,
      render(t) {
        for (const mo of mouths) {
          const lo = Math.max(0, mo.lo.at(t))
          const hi = Math.min(PAGE, mo.hi.at(t))
          const w = Math.max(0, hi - lo)
          const r = mo.rect
          r.setAttribute(vertical ? 'x' : 'y', lo.toFixed(2))
          r.setAttribute(vertical ? 'width' : 'height', w.toFixed(2))
          r.setAttribute(vertical ? 'y' : 'x', '0')
          r.setAttribute(vertical ? 'height' : 'width', String(PAGE))
        }
      },
    }
  },
}

/**
 * The point of the glyph (em units, ink centre = origin) to put in the middle
 * of the slot: a place where the slot, running across the whole page, meets
 * as much ink as possible.
 */
function anchor(src: GlyphSource, k: number, vertical: boolean, rng: Rng): { x: number; y: number } {
  const { grid, half } = src.metrics
  const cw = (2 * half.w) / GRID
  const ch = (2 * half.h) / GRID
  const reach = PAGE / 2 / k // em units visible on either side of the centre along the slot
  const r = Math.max(1, Math.round(reach / (vertical ? ch : cw)))
  const scored: { gx: number; gy: number; score: number }[] = []
  for (let gy = 0; gy < GRID; gy++)
    for (let gx = 0; gx < GRID; gx++) {
      let score = 0
      for (let d = -r; d <= r; d++) {
        const yy = vertical ? gy + d : gy
        const xx = vertical ? gx : gx + d
        if (yy >= 0 && yy < GRID && xx >= 0 && xx < GRID) score += grid[yy][xx]
      }
      score *= grid[gy][gx] > 0.3 ? 1 : 0.5 // prefer a centre that is itself ink
      scored.push({ gx, gy, score })
    }
  const max = Math.max(...scored.map((s) => s.score))
  if (max <= 0) return { x: 0, y: 0 }
  const best = rng.pick(scored.filter((s) => s.score >= max * 0.8))
  return { x: -half.w + (best.gx + 0.5) * cw, y: -half.h + (best.gy + 0.5) * ch }
}
