/**
 * 分解 — DECOMPOSITION
 * A character comes apart where the computer reads the font's letterform as
 * already separate. Every character can be cut; so cutting is worth giving
 * the poem its subject only where the parts remain writing.
 */
import { clamp } from '../../core/math'
import { readPart } from '../../glyph/legibility'
import { arrangement, islands, openness, partition, type GlyphPart } from '../../glyph/parts'
import { RELATION_THRESHOLD } from '../../glyph/relation'
import type { Analysis, PoeticOperation, Proposal } from '../types'
import { contentGraphemes, salience } from '../salience'

/** a structural cut is made only where the letterform is at least this open */
const OPEN_SEAM = 0.35
/** as the primary operation, every part must hold at least this share of the ink */
const MIN_PART = 0.08
/** as the primary operation, the parts must read as writing at least this much */
const MIN_LEGIBILITY = 0.4

/**
 * RULE (structural): the glyph comes apart only where the font already
 * separates it — into its islands of ink, or else along seams it leaves open.
 * This needs no knowledge of the sound.
 */
export function structuralParts(a: Analysis, grapheme: number): GlyphPart[] {
  const m = a.glyphs.get(a.graphemes[grapheme].char).metrics
  const isl = islands(m)
  return isl.length >= 2 ? isl.slice(0, 6) : partition(m, 5, OPEN_SEAM)
}

/**
 * RULE (by beats): with a reading, a character is cut once per beat it
 * carries. Such cuts cross the ink, so they only open a character slightly in
 * place (modifier); they never give the poem its subject.
 */
export function beatParts(a: Analysis, grapheme: number): GlyphPart[] | null {
  const m = a.glyphs.get(a.graphemes[grapheme].char).metrics
  const morae = a.morae.filter((mo) => mo.graphemes.includes(grapheme))
  const read = morae.length > 0 && morae.every((mo) => mo.kind !== 'unread')
  if (!read) return null
  const beats = morae.reduce((s, mo) => s + mo.weight / mo.graphemes.length, 0)
  return partition(m, Math.max(1, Math.round(beats)) + 1)
}

/** the parts a modifier opens: by beats when the reading is known, else structural */
function modifierParts(a: Analysis, grapheme: number): GlyphPart[] {
  return beatParts(a, grapheme) ?? structuralParts(a, grapheme)
}

export const decomposition: PoeticOperation = {
  id: 'decomposition',
  title: '分解',
  rules: [
    '主操作としての分解は、フォントがすでに分けているところでだけ分かれる：インクの島（連結成分）ごとに、島が一つなら開いた継ぎ目（閉じ具合 0.35 以下）で。読みの有無は関係しない',
    '主操作になれるのは、どの部品もインクの8%以上を持ち、部品が文字として読める度合いが0.4以上のときだけ（部品が「木」「口」のような字に読めるか、計算機が固定フォントの字形と照らして判定する）',
    '読みがあるとき、一字をその字が担う拍の数だけ切る。この切り方はインクを横切るので、修飾として字をその場でわずかに開くことにだけ使う',
    '言語的な顕著さ：関係の強さ ＝ 継ぎ目の開き・部品の数・インクの島の数。固有性は低い（0.15）：どの字も切れるから。題の中の他の字と字形の関係を持つ字だけ＋0.5。被覆 ＝ その字が内容字に占める割合',
    '分けられるのは字だけではない：漢字の語幹とかなの活用語尾で書かれた語（触|る、美し|い、走|れ）は、語そのものが継ぎ目を持つ。字を割らずに語を割る',
    '語の継ぎ目：関係の強さ 0.7（送り仮名は書き方の上ではっきり見えている）、固有性 0.35（活用語はありふれている）、被覆 ＝ その語が内容字に占める割合',
  ],

  propose(a) {
    const content = contentGraphemes(a)
    const joints: Proposal[] = a.relations.flatMap((r) => {
      if (r.kind !== 'inflection') return []
      const t = a.tokens[r.token]
      const covered = content.filter((g) => g.index >= t.start && g.index < t.end).length
      return [
        {
          op: 'decomposition' as const,
          // the joint is in the word itself, as it is written
          origin: 'endogenous' as const,
          focus: { kind: 'joint' as const, token: r.token, at: r.at },
          linguisticSalience: salience(0.7, 0.35, covered / Math.max(1, content.length)),
          roles: { primary: true, modifier: false },
          relations: [`inflection「${t.surface}」語幹「${t.surface.slice(0, r.at - t.start)}」|語尾「${t.surface.slice(r.at - t.start)}」`],
          evidence: [`「${t.surface}」は漢字の語幹とかなの活用語尾で書かれている`],
        },
      ]
    })
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
      const parts = structuralParts(a, g.index)
      const beat = beatParts(a, g.index)
      if (parts.length < 2 && !beat) continue

      const shown = parts.length >= 2 ? parts : beat!
      const readings = shown.map((p) => readPart(p, m, a.readables, g.char))
      const open = shown.reduce((s, p) => s + openness(p), 0) / shown.length
      const rs = clamp(0.45 * open + 0.3 * Math.min(1, (shown.length - 1) / 3) + 0.25 * Math.min(1, (m.islands - 1) / 4))
      const d = 0.15 + (related.has(g.char) ? 0.5 : 0)

      // legibility of the structural parts decides whether they may carry the poem
      const legible = shown.reduce((s, p, i) => {
        const r = readings[i]
        return s + p.share * (r ? (r.kind === 'character' ? 1 : 0.5) : p.cut ? 0.15 * openness(p) : 0.35)
      }, 0)
      const reasons: string[] = []
      if (parts.length < 2) reasons.push('フォントの中で分かれていない')
      if (parts.length >= 2 && parts.some((p) => p.share < MIN_PART)) reasons.push('インクの8%未満の部品がある')
      if (parts.length >= 2 && legible < MIN_LEGIBILITY) reasons.push(`部品が文字として読めない（${legible.toFixed(2)}）`)
      const primary = reasons.length === 0

      const readable = readings.filter((r) => r).map((r) => `「${r!.char}」`)
      out.push({
        op: 'decomposition',
        // the structure of one character, read in the character itself
        origin: 'intrinsic',
        focus: { kind: 'parts', grapheme: g.index, parts: shown, readings, arrangement: arrangement(shown), byReading: parts.length < 2 },
        linguisticSalience: salience(rs, d, 1 / content.length),
        roles: { primary, modifier: true, note: primary ? undefined : `主操作にならない：${reasons.join('・')}` },
        relations: [
          `glyphParts「${g.char}」${shown.length}部品 開き${open.toFixed(2)} 島${m.islands}${readable.length ? ` 読める部品${readable.join('')}` : ''}${related.has(g.char) ? ' 他字と字形関係' : ''}`,
        ],
        evidence: [
          parts.length >= 2
            ? `「${g.char}」はフォントの中で${parts.length}部品に分かれている（${parts.some((p) => p.cut) ? '開いた継ぎ目' : 'インクの島'}）`
            : `「${g.char}」は読みの拍の数だけ切られる（修飾のみ）`,
        ],
      })
    }
    // one proposal per character: the most prominent two, plus any word joints
    return [...joints, ...out.sort((x, y) => y.linguisticSalience.value - x.linguisticSalience.value).slice(0, 2)]
  },

  apply(a, p, tokens) {
    if (p.focus.kind !== 'parts') return null
    const char = a.graphemes[p.focus.grapheme].char
    let hit = false
    const out = tokens.map((t) =>
      t.map((u) => {
        if (u.char !== char || u.absent) return u
        hit = true
        return { ...u, parts: modifierParts(a, u.grapheme) }
      }),
    )
    return hit ? out : null
  },
}
