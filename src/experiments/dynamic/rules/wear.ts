/**
 * 摩耗 — WEAR
 *
 * linguistic input
 *   the word's graphemes and morae; how often each mora recurs inside the word.
 *
 * transformation rule
 *   Repetition wears a word away (semantic satiation).
 *   The word is written continuously, without spaces, on a grid larger than
 *   the page, the way text runs through a manuscript grid. A written line
 *   holds 2n+1 cells (n = graphemes), so every line starts one step further
 *   into the word: the same mora lines up diagonally, not in rows.
 *   Morae then wear away one kind at a time, all their occurrences at once.
 *   Morae that already recur inside the word resist longest; the most
 *   resistant one survives. Finally the survivors are worn away in reading
 *   order until the last one written remains.
 *
 * start   the page is saturated with the word, cut on all four edges
 *         mid-glyph and mid-word: there is no place where the word begins.
 * middle  only the surviving mora is left, as diagonal bands; their width is
 *         the number of times it occurs in the word, their spacing is the
 *         word's length.
 * final   one glyph, at the place where it was written last — near the end
 *         of the reading order, never at the centre. Everything else is white.
 */
import { clamp } from '../../core/math'
import { GlyphFigure } from '../../glyph/figure'
import { cellAdjust } from '../../glyph/layout'
import { PAGE } from '../../render/stage'
import type { Composition, Cue, PoeticRule } from '../types'

interface Cell {
  fig: GlyphFigure
  key: string
  /** position in the continuous text */
  order: number
  /** entirely inside the page */
  whole: boolean
  vanish: number
}

export const wear: PoeticRule = {
  id: 'wear',
  title: '摩耗',
  statement: {
    input: 'graphemes, morae, recurrence of morae within the word',
    transformation: 'the word written continuously beyond the page; morae wear away by kind, recurring morae last',
    start: 'saturated field cut on every edge; same morae align diagonally',
    middle: 'diagonal bands of the most resistant mora',
    final: 'a single glyph where it was written last',
  },

  affinity(word) {
    const kinds = new Set(word.morae.map((mo) => mo.key)).size
    if (kinds < 2) return 0 // nothing can wear away
    const recurs = word.morae.length > kinds
    return 1 + (recurs ? 1.5 : 0) + (word.morae.length <= 5 ? 0.5 : 0)
  },

  compose(word, { stage, rng, glyphs }): Composition {
    const G = word.graphemes
    const n = G.length
    const vertical = word.direction === 'vertical'
    const keyOf = G.map((_, j) => word.morae[word.moraOf[j]].key)
    const morae = (key: string) => word.morae.filter((mo) => mo.key === key).map((mo) => mo.index)

    // RULE: resistance to wear = recurrence inside the word.
    const kinds = [...new Set(keyOf)]
    const resistance = new Map(kinds.map((k) => [k, (word.count.get(k) ?? 1) + rng.next() * 0.9]))
    const order = [...kinds].sort((a, b) => resistance.get(a)! - resistance.get(b)!)
    const survivor = order[order.length - 1]
    const eroding = order.slice(0, -1)

    // RULE: the grid. A line of 2n+1 cells makes each line begin one step later in the word.
    const span = clamp(2 * n, 6, 14) // cells between opposite page edges
    const s = PAGE / span
    const perLine = span + 1 // the first and last cell of a line are halved by the page
    const lines = span + 1
    const phase = Math.floor(rng.next() * n) // where the page cuts into the text

    const cells: Cell[] = []
    for (let l = 0; l < lines; l++)
      for (let c = 0; c < perLine; c++) {
        const k = l * perLine + c
        const g = G[(k + phase) % n]
        // vertical: lines are columns, right to left; horizontal: rows, top to bottom
        const x = vertical ? PAGE - l * s : c * s
        const y = vertical ? c * s : l * s
        const adj = cellAdjust(g, vertical)
        const size = s * 0.96
        const fig = new GlyphFigure(stage, glyphs.get(g.char)).place({
          x: x + adj.dx * size,
          y: y + adj.dy * size,
          size,
          rotate: adj.rotate,
        })
        const whole = x - s / 2 >= -0.5 && x + s / 2 <= PAGE + 0.5 && y - s / 2 >= -0.5 && y + s / 2 <= PAGE + 0.5
        cells.push({ fig, key: keyOf[(k + phase) % n], order: k, whole, vanish: Infinity })
      }

    // timeline
    const cues: Cue[] = [{ t: 0, kind: 'present', morae: word.morae.map((mo) => mo.index), amount: 1 }]
    const firstCut = 1.6
    const gap = eroding.length > 1 ? Math.min(1.0, 2.2 / (eroding.length - 1)) : 0
    eroding.forEach((key, i) => {
      const t = firstCut + i * gap
      const lost = cells.filter((c) => c.key === key)
      lost.forEach((c) => (c.vanish = t))
      cues.push({ t, kind: 'erode', morae: morae(key), amount: lost.length / cells.length })
    })
    const middle = eroding.length ? firstCut + (eroding.length - 1) * gap + 0.05 : 0

    // the last survivor = the last one written entirely inside the page
    const survivors = cells.filter((c) => c.key === survivor).sort((a, b) => a.order - b.order)
    const kept = [...survivors].reverse().find((c) => c.whole) ?? survivors[survivors.length - 1]
    const sweepStart = Math.max(middle + 1.5, 4.6)
    const sweep = 2.0
    const others = survivors.filter((c) => c !== kept)
    others.forEach((c, i) => (c.vanish = sweepStart + (sweep * i) / Math.max(1, others.length - 1)))
    cues.push({ t: sweepStart, kind: 'vanish', morae: morae(survivor), amount: others.length / cells.length })
    const final = sweepStart + sweep + 0.05
    cues.push({ t: final, kind: 'hold', morae: morae(survivor), amount: 1 / cells.length })

    return {
      duration: final + 2.6,
      states: { start: 0, middle, final },
      cues,
      render(t) {
        for (const c of cells) c.fig.show(t < c.vanish)
      },
    }
  },
}
