/**
 * visualPotential — a measure separate from linguistic salience.
 *
 * linguisticSalience says how prominent a relation is for the title, as
 * language. visualPotential says how far the operations and spatial
 * compositions that exist now can turn that relation into a strong visual
 * structure that stays writing. A relation can be prominent and hard to show
 * (a negation at the end of a word), or modest and very visible (a glyph that
 * falls apart into readable characters).
 *
 *   visualPotential = legibility × structure
 *   poeticPotential = √(linguisticSalience × visualPotential)
 *
 * The rules are general: they look at what the operation would draw and how
 * the relation would appear, never at particular titles.
 */
import { openness } from '../glyph/parts'
import { isRelationWord } from './salience'
import type { Analysis, Proposal, VisualPotential } from './types'

/** what a part contributes to legibility, by what it reads as */
const PART_LEGIBILITY = {
  character: 1, // the part is itself a character: 森 → 木
  stroke: 0.5, // a single stroke: a trace of writing
  island: 0.35, // a separate island of ink, read as nothing
  cut: 0.15, // a piece cut through ink, read as nothing (× how open the cut was)
}

function potential(legibility: number, structure: number, notes: string[]): VisualPotential {
  return { value: legibility * structure, legibility, structure, notes }
}

export function visualPotential(a: Analysis, p: Proposal): VisualPotential {
  const f = p.focus
  switch (f.kind) {
    case 'repetition': {
      // repeated units stay whole characters; how clearly repetition shows depends on its kind
      if (f.whole) return potential(1, 0.9, ['題全体の反復は場として紙面を覆う'])
      if (f.contiguous) return potential(1, 0.75, ['直に続く反復は、その場で伸びる帯になる'])
      const functional = isRelationWord(a, f.occurrences[0][0])
      return functional
        ? potential(1, 0.35, ['関係語の反復は、紙面では目立たない'])
        : potential(1, 0.6, ['離れた反復は、帯の各所で伸びる'])
    }
    case 'plain':
      return potential(1, 0.15, ['反復の根拠がなく、構造が生まれない'])
    case 'parts': {
      let legibility = 0
      const notes: string[] = []
      f.parts.forEach((part, i) => {
        const r = f.readings[i]
        const kind = r ? r.kind : part.cut ? 'cut' : 'island'
        const value = kind === 'cut' ? PART_LEGIBILITY.cut * openness(part) : PART_LEGIBILITY[kind]
        legibility += part.share * value
        notes.push(r ? `部品${i + 1}（${(part.share * 100).toFixed(0)}%）は「${r.char}」と読める` : `部品${i + 1}（${(part.share * 100).toFixed(0)}%）は${kind === 'cut' ? 'インクを横切る破片' : '読めないインクの島'}`)
      })
      // three or more parts can be arranged (radiating, in a band); two only stand apart
      const structure = f.parts.length >= 3 ? 0.85 : 0.5
      return potential(legibility, structure, notes)
    }
    case 'pair': {
      const r = f.relation
      if (r.kind === 'similarity')
        return potential(0.6 + 0.4 * r.residue.substance, 0.9, ['よく似た二つの字は、どちらも字のまま並べられる'])
      // the inner glyph stays whole; the residue is legible only as far as it has form
      return potential(0.4 + 0.6 * r.residue.substance, 0.9, [
        `引いた残りのうち${(r.residue.substance * 100).toFixed(0)}%が形を持つ（残りは削りかす）`,
      ])
    }
    case 'absence': {
      // a gap is seen as a missing character only where written characters hold it on both sides
      const g = f.graphemes
      const bounded = g.length > 0 && Math.min(...g) > 0 && Math.max(...g) < a.graphemes.length - 1
      return potential(1, bounded ? 0.45 : 0.25, [
        bounded ? '空白は両側を字に挟まれる' : '空白が題の端にあり、欠けたものとして見えにくい',
        '今の紙面構成では、欠落は欠けた字の形として残らない',
      ])
    }
  }
}

export function poeticPotential(p: Proposal): number {
  return Math.sqrt(p.linguisticSalience.value * (p.visualPotential?.value ?? 0))
}
