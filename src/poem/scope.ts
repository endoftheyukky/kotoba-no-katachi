/**
 * How much of the title a feature acts on.
 *
 * Every focus already names the graphemes it works with; this reads them off
 * and says whether the feature is the whole title, a contiguous part of it,
 * or a unit or two. What is left over is the context: the rest of the title,
 * which a local feature must not cost the reader (poem/context.ts).
 *
 * There is nothing here about particular titles: a focus names its graphemes,
 * and the shape of that set decides the scope.
 */
import type { Analysis, FeatureScope, Focus } from './types'

/** the graphemes a title writes, spaces aside — the seats of the reading */
export function seatsOf(a: Analysis): number[] {
  return a.graphemes.filter((g) => g.char.trim()).map((g) => g.index)
}

function targetOf(a: Analysis, f: Focus): number[] {
  switch (f.kind) {
    case 'repetition':
      return f.occurrences.flat()
    case 'plain':
      return seatsOf(a)
    case 'parts':
      return [f.grapheme]
    case 'pair': {
      const { inner, outer } = f.relation
      // a glyph read inside another may not be written in the title at all
      return a.graphemes.filter((g) => g.char === inner || g.char === outer).map((g) => g.index)
    }
    case 'absence':
      return f.graphemes
    case 'counter':
      return [f.grapheme]
    case 'joint': {
      const t = a.tokens[f.token]
      return seatsOf(a).filter((i) => i >= t.start && i < t.end)
    }
  }
}

export function scopeOf(a: Analysis, f: Focus): FeatureScope {
  const seats = seatsOf(a)
  const target = [...new Set(targetOf(a, f))].filter((i) => seats.includes(i)).sort((x, y) => x - y)
  const context = seats.filter((i) => !target.includes(i))
  const contiguous = target.every((v, i) => i === 0 || v === target[i - 1] + 1)
  const kind: FeatureScope['kind'] =
    context.length === 0 ? 'whole' : contiguous && target.length >= 2 ? 'span' : 'unit'
  const chars = (xs: number[]) => xs.map((i) => a.graphemes[i].char).join('')
  return {
    kind,
    target,
    context,
    grounds:
      kind === 'whole'
        ? '題そのものが対象：外に残るものがない'
        : `対象は「${chars(target)}」、題の残り「${chars(context)}」は文脈として紙面に留まる`,
  }
}

/**
 * What a proposal rests on, as a few tokens naming the observations it uses.
 * Two proposals that name the same observation are not independent evidence:
 * the islands of 川 read as parts, and the same islands read as a form
 * returning, are one fact read twice. The descent uses this so that a deeper
 * reading of what has already been read cannot displace it (poem/compose.ts).
 *
 * Deliberately small: a handful of strings, no provenance graph.
 */
export function basisOf(a: Analysis, f: Focus): string[] {
  switch (f.kind) {
    case 'repetition':
      // a repetition of sound is an observation of the reading, not of the ink
      return f.sound
        ? [`sound:${f.sound.unit}:${f.sound.value}`]
        : [...new Set(f.occurrences.flat().map((i) => `char:${a.graphemes[i]?.char ?? i}`))]
    case 'parts':
      // the islands or cuts of one glyph — whether read as parts or as an echo
      return [`parts:${a.graphemes[f.grapheme].char}`]
    case 'counter':
      // the white those strokes close in: a different measurement of the same glyph
      return [`counter:${a.graphemes[f.grapheme].char}`]
    case 'pair':
      return [`glyphs:${f.relation.inner}|${f.relation.outer}`]
    case 'absence':
      return f.graphemes.map((i) => `absent:${i}`)
    case 'joint':
      return [`joint:${f.token}`]
    case 'plain':
      return []
  }
}
