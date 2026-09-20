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
    '音の反復（同じ拍・同じ子音・同じ母音）も反復である。ただし紙面に置くのは題が書いている字そのもので、音素の記号を新たに書くことはしない',
    '母音は五つしかないので偶然に重なる。顕著さの条件：拍の反復は2回から、子音は拍の6割、母音は拍の4分の3以上（v1の暫定値）。表記の反復がすでに同じ構造を捉えているときは候補を作らず、根拠を重ねるだけにする',
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
        level: 2,
        origin: 'endogenous',
        focus: { kind: 'repetition', value: r.value, occurrences: r.occurrences, contiguous: true, whole },
        linguisticSalience: salience(whole ? 1 : 0.85, 0.9, covered / n),
        roles: { primary: true, modifier: false },
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
        level: 2,
        origin: 'endogenous',
        focus: { kind: 'repetition', value: g.char, occurrences: r.members.map((i) => [i]), contiguous: false, whole: false },
        roles: { primary: true, modifier: false },
        linguisticSalience: salience(Math.min(1, 0.4 + 0.3 * (k - 1)), d, (functional ? k : r.members.length) / (functional ? a.graphemes.length : n)),
        relations: [`recurrence 字「${g.char}」×${k}${functional ? '（関係語）' : ''}`],
        evidence: [`「${g.char}」が${k}回現れる`],
      })
    }

    // 音（level 3）：同じ音が戻ってくる。表記の反復が同じものを捉えていれば作らない
    const seen = new Set([...doubled, ...a.relations.flatMap((r) => (r.kind === 'recurrence' && r.unit === 'grapheme' ? [r.value] : []))])
    for (const f of a.phonology) {
      if (f.kind !== 'echo') continue
      const chars = [...new Set(f.graphemes.map((i) => toHiragana(a.graphemes[i].char)))]
      // the writing already repeats the same thing: evidence, not a candidate
      if (chars.length === 1 && seen.has(chars[0])) continue
      const morae = f.morae.map((i) => a.morae[i])
      const contiguous = f.morae.every((v, i) => i === 0 || v === f.morae[i - 1] + 1)
      const label = { mora: '拍', vowel: '母音', onset: '子音' }[f.unit]
      const d =
        f.unit === 'mora' ? 0.6 * (1 - f.chance) : f.unit === 'onset' ? 0.4 * f.share : 0.3 * f.share * f.share
      out.push({
        op: 'proliferation',
        level: 3,
        origin: 'endogenous',
        focus: {
          kind: 'repetition',
          // what is drawn: the title's own characters that carry the sound
          value: f.graphemes.map((i) => a.graphemes[i].char).join(''),
          occurrences: morae.map((mo) => mo.graphemes),
          contiguous,
          whole: f.share >= 1,
          sound: { unit: f.unit, value: f.value },
        },
        linguisticSalience: salience(f.unit === 'mora' ? 0.7 : 0.6, d, f.share),
        roles: { primary: true, modifier: false },
        relations: [`echo ${label}「${f.value}」×${f.morae.length}（拍の${(f.share * 100).toFixed(0)}%）`],
        evidence: [
          `同じ${label}「${f.value}」が${f.morae.length}回戻ってくる：題の拍の${(f.share * 100).toFixed(0)}%`,
          `紙面に置くのは、その音を担う題の字「${f.graphemes.map((i) => a.graphemes[i].char).join('」「')}」`,
        ],
      })
    }

    out.push({
      op: 'proliferation',
      level: 2,
      origin: 'endogenous',
      focus: { kind: 'plain' },
      linguisticSalience: salience(0.25, 0.05, 1),
      roles: { primary: true, modifier: false },
      relations: ['—'],
      evidence: ['反復は題に見当たらない：どの題にも可能な増殖'],
    })
    return out
  },

  apply: (_a, _p, tokens) => tokens,
}
