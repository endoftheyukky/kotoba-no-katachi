/**
 * 増殖・反復 — PROLIFERATION / REPETITION
 * What already repeats in the title is what the poem repeats.
 * (How the repetition occupies the page is the spatial composition's matter.)
 */
import { toHiragana } from '../../language/kana'
import { chanceOfRepeat, contentGraphemes, isRelationWord, salience } from '../salience'
import type { PoeticOperation, Proposal } from '../types'

export const proliferation: PoeticOperation = {
  id: 'proliferation',
  title: '増殖・反復',
  rules: [
    '題の中ですでに反復しているものを、詩は反復する',
    '直に続く反復（ささ・許許・ころころ・人々）は最も強い：関係の強さ 0.85、題全体が反復なら 1.0。固有性 0.9',
    '離れた反復は、回数が多いほど強い。固有性は「その長さの題で偶然に同じ字が現れる確率」の補数。助詞・接続語の反復はありふれているので固有性を 0.35 倍する',
    '反復が何もない題でも増殖は可能だが、題固有ではない：関係の強さ 0.25・固有性 0.05（最後の手段）',
  ],

  propose(a) {
    const content = contentGraphemes(a)
    const n = Math.max(1, content.length)
    const out: Proposal[] = []

    for (const r of a.relations) {
      if (r.kind !== 'reduplication') continue
      const covered = r.occurrences.flat().filter((i) => !isRelationWord(a, i)).length
      const whole = covered >= n
      out.push({
        op: 'proliferation',
        focus: { kind: 'repetition', value: r.value, occurrences: r.occurrences, contiguous: true, whole },
        salience: salience(whole ? 1 : 0.85, 0.9, covered / n),
        relations: [`reduplication「${r.value}」×${r.occurrences.length}`],
        evidence: [`「${r.value}」が直に${r.occurrences.length}回続く${whole ? '（題全体が反復）' : ''}`],
      })
    }

    const doubled = new Set(
      a.relations.flatMap((r) => (r.kind === 'reduplication' ? [toHiragana(r.value)] : [])),
    )
    for (const r of a.relations) {
      if (r.kind !== 'recurrence' || r.unit !== 'grapheme' || doubled.has(r.value)) continue
      const g = a.graphemes[r.members[0]]
      const functional = isRelationWord(a, g.index)
      const k = r.members.length
      const d = (1 - chanceOfRepeat(a.graphemes.length, g.script)) * (functional ? 0.35 : 1)
      out.push({
        op: 'proliferation',
        focus: { kind: 'repetition', value: g.char, occurrences: r.members.map((i) => [i]), contiguous: false, whole: false },
        salience: salience(Math.min(1, 0.4 + 0.3 * (k - 1)), d, (functional ? k : r.members.length) / (functional ? a.graphemes.length : n)),
        relations: [`recurrence 字「${g.char}」×${k}${functional ? '（関係語）' : ''}`],
        evidence: [`「${g.char}」が${k}回現れる`],
      })
    }

    out.push({
      op: 'proliferation',
      focus: { kind: 'plain' },
      salience: salience(0.25, 0.05, 1),
      relations: ['—'],
      evidence: ['反復は題に見当たらない：どの題にも可能な増殖'],
    })
    return out
  },

  apply: (_a, _p, tokens) => tokens,
}
