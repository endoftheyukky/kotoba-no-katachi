/**
 * 分解 — DECOMPOSITION
 * A character comes apart where the computer reads the font's letterform as
 * already open. Every character can be cut; so cutting is worth something
 * only where the form itself is strikingly separable, or relates to another
 * character of the title.
 */
import { clamp } from '../../core/math'
import { arrangement, islands, openness, partition, type GlyphPart } from '../../glyph/parts'
import { RELATION_THRESHOLD } from '../../glyph/relation'
import type { Analysis, PoeticOperation, Proposal } from '../types'
import { contentGraphemes, salience } from '../salience'

/** a structural cut is made only where the letterform is at least this open */
const OPEN_SEAM = 0.35

/**
 * RULE: with a reading, a character is cut once per beat it carries.
 * Without one, it comes apart only where the font already separates it: into
 * its islands of ink, or else along seams the font leaves open.
 * (A rule that needs sound is not applied when the sound is unknown.)
 */
export function partsOf(a: Analysis, grapheme: number): { parts: GlyphPart[]; byReading: boolean } {
  const g = a.graphemes[grapheme]
  const m = a.glyphs.get(g.char).metrics
  const morae = a.morae.filter((mo) => mo.graphemes.includes(grapheme))
  const read = morae.length > 0 && morae.every((mo) => mo.kind !== 'unread')
  if (read) {
    const beats = morae.reduce((s, mo) => s + mo.weight / mo.graphemes.length, 0)
    return { parts: partition(m, Math.max(1, Math.round(beats)) + 1), byReading: true }
  }
  const isl = islands(m)
  return { parts: isl.length >= 2 ? isl.slice(0, 6) : partition(m, 5, OPEN_SEAM), byReading: false }
}

export const decomposition: PoeticOperation = {
  id: 'decomposition',
  title: '分解',
  rules: [
    '字は、計算機がこのフォントの字形に読んだ継ぎ目で切られる（部首の知識ではなく、インクの読み）',
    '読みがあるとき、一字はその字が担う拍の数だけ切られる。読みがないときは、フォントがすでに分けているところでだけ分かれる：インクの島（連結成分）ごとに、島が一つなら開いた継ぎ目（閉じ具合 0.35 以下）で',
    '関係の強さ ＝ 継ぎ目の開き・部品の数・インクの島の数。固有性は低い（0.15）：どの字も切れるから。題の中の他の字と字形の関係を持つ字だけ固有性が上がる（＋0.5）',
    '被覆 ＝ 題の内容字のうち、その一字が占める割合',
    '修飾として：その字は、書かれる所でわずかに開いた部品として書かれる',
  ],

  propose(a) {
    const content = contentGraphemes(a)
    const related = new Set(
      a.glyphRelations.filter((r) => r.score >= RELATION_THRESHOLD).flatMap((r) => [r.inner, r.outer]),
    )
    const out: Proposal[] = []
    const seen = new Set<string>()
    for (const g of content) {
      if (seen.has(g.char)) continue
      seen.add(g.char)
      const m = a.glyphs.get(g.char).metrics
      if (!m.density) continue
      const { parts, byReading } = partsOf(a, g.index)
      if (parts.length < 2) continue
      const open = parts.reduce((s, p) => s + openness(p), 0) / parts.length
      const rs = clamp(0.45 * open + 0.3 * Math.min(1, (parts.length - 1) / 3) + 0.25 * Math.min(1, (m.islands - 1) / 4))
      const d = 0.15 + (related.has(g.char) ? 0.5 : 0)
      out.push({
        op: 'decomposition',
        focus: { kind: 'parts', grapheme: g.index, parts, arrangement: arrangement(parts), byReading },
        salience: salience(rs, d, 1 / content.length),
        relations: [`glyphParts「${g.char}」${parts.length}部品 開き${open.toFixed(2)} 島${m.islands}${related.has(g.char) ? ' 他字と字形関係' : ''}`],
        evidence: [
          byReading
            ? `「${g.char}」は読みの拍の数だけ切られる`
            : `「${g.char}」はフォントの中で${parts.length}部品に分かれている（${parts.some((p) => p.cut) ? '開いた継ぎ目' : 'インクの島'}）`,
        ],
      })
    }
    return out.sort((x, y) => y.salience.value - x.salience.value).slice(0, 2)
  },

  apply(a, p, tokens) {
    if (p.focus.kind !== 'parts') return null
    const char = a.graphemes[p.focus.grapheme].char
    let hit = false
    const out = tokens.map((t) =>
      t.map((u) => {
        if (u.char !== char || u.absent) return u
        hit = true
        return { ...u, parts: partsOf(a, u.grapheme).parts }
      }),
    )
    return hit ? out : null
  },
}
