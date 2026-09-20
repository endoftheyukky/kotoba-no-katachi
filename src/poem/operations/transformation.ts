/**
 * 字形関係・変形 — GLYPH RELATION / TRANSFORMATION
 * The computer lays the title's letterforms (in the fixed font) over each
 * other. Where one lies inside another, or two are nearly the same, the poem
 * works with that relation: the difference, or the pair.
 */
import { RELATION_THRESHOLD, type GlyphRelation } from '../../glyph/relation'
import { contentGraphemes, salience } from '../salience'
import type { Analysis, PoeticOperation, Proposal } from '../types'

function usable(r: GlyphRelation): boolean {
  if (r.score < RELATION_THRESHOLD) return false
  return r.kind === 'similarity' || (r.residue.share >= 0.06 && r.residue.share <= 0.85)
}

export const transformation: PoeticOperation = {
  id: 'transformation',
  title: '字形関係・変形',
  rules: [
    '字形の関係は、固定したフォントのグリフを計算機が重ね合わせて読んだ結果である：言語学的な事実ではなく「計算機による字形の読み」',
    '包含：字Aのインクが偶然以上に字Bに重なり（0.65以上）、Bに十分な残りがあるとき「AはBの中にある」',
    '類似：互いに相手の中にあり、どちらから引いても15%以下しか残らないとき「AとBはほぼ同じ形」。その小さな差（犬の点、入のはね）が二つを分けるものである',
    '題が書いていない字との関係も読む：題の一字の中に、計算機が読める部品が入っていることがある（在庫との関係）。ただし漢字が部品を含むこと自体はありふれているので、読みが 0.80 以上、残りが 10〜60% で、その 6 割以上がまとまった形（断片4つ以下）であることを条件とし、単画は内側の候補にしない',
    '関係の強さ ＝ 読みの強さを 0.5〜1 から 0〜1 へ。固有性は、題の字どうしなら高く（包含 0.9、類似 0.85）、在庫との関係なら低い（0.4）：題の中で二つの字が重なることはまれだが、一つの字が部品を含むことはありふれているから。題が自分で書いている関係が、外の部品との関係に先んじる。被覆 ＝ 関係する字が題の内容字に占める割合',
    '修飾として：紙面上のすべてのBは、Aを引かれた姿で書かれる（包含のみ）',
  ],

  propose(a) {
    const content = contentGraphemes(a)
    const out: Proposal[] = []
    for (const r of a.glyphRelations.filter(usable).slice(0, 2)) {
      const involved = content.filter((g) => g.char === r.inner || g.char === r.outer).length
      const containment = r.kind === 'containment'
      const known = r.origin === 'title'
      const distinctiveness = known ? (containment ? 0.9 : 0.85) : 0.4
      out.push({
        op: 'transformation',
        origin: known ? 'endogenous' : 'exogenous',
        focus: { kind: 'pair', relation: r },
        linguisticSalience: salience((r.score - 0.5) / 0.5, distinctiveness, involved / content.length),
        // A component the title never writes cannot carry the poem alone: the
        // reader has no way to see what it was held against. It may still
        // strengthen a structure as a modifier, stand as another reading in a
        // later variant, or be taken up when nothing else reaches the page.
        roles: {
          primary: known,
          modifier: containment,
          note: known ? undefined : '題の外の部品との関係：単独では主操作にしない（修飾・別解・最後の手段としてのみ）',
        },
        relations: [
          `${containment ? `containment「${r.inner}」⊂「${r.outer}」${r.score.toFixed(2)} 残${(r.residue.share * 100).toFixed(0)}%` : `similarity「${r.inner}」≈「${r.outer}」${r.score.toFixed(2)}`}${known ? '' : '（在庫）'}`,
        ],
        evidence: containment
          ? [
              ...(known ? [] : [`「${r.inner}」は題が書いていない字：計算機が「${r.outer}」の中に読んだ`]),
              `計算機の読み：「${r.inner}」のインクの${(r.overlap * 100).toFixed(0)}%が「${r.outer}」に重なる（偶然を差し引いて${r.score.toFixed(2)}）`,
              `「${r.outer}」から「${r.inner}」を引くと${(r.residue.share * 100).toFixed(0)}%が残る`,
            ]
          : [`計算機の読み：「${r.inner}」と「${r.outer}」は互いにほぼ重なる（${r.score.toFixed(2)}）`],
      })
    }
    return out
  },

  apply(_a: Analysis, p, tokens) {
    if (p.focus.kind !== 'pair' || p.focus.relation.kind !== 'containment') return null
    const r = p.focus.relation
    const minus = { char: r.inner, dx: r.dx, dy: r.dy, scale: r.scale, keep: r.residue.pieces }
    let hit = false
    const out = tokens.map((t) =>
      t.map((u) => {
        if (u.char !== r.outer || u.absent) return u
        hit = true
        return { ...u, minus }
      }),
    )
    return hit ? out : null
  },
}
