/**
 * 増殖・反復 — PROLIFERATION / REPETITION
 * What already repeats in the title is what the poem repeats.
 * (How the repetition occupies the page is the spatial composition's matter.)
 */
import { arrangement } from '../../glyph/parts'
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
    '一字の中で同じ形が戻ってくることも反復である（品の三つの口、羽の二つ、川の三画）：インクの島を正規化して互いに8割以上重なるときだけ。読める部品への分割（分解）とは別で、こちらは字として読めないインクの塊の関係を見ている',
    '字の中の反復：関係の強さ ＝ 島どうしの似方。固有性 0.60（三つ以上で 0.70）。被覆 ＝ その字が内容字に占める割合',
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

    // 画（level 4）：一字の中で同じ形が戻ってくる
    const done = new Set<string>()
    for (const g of content) {
      if (done.has(g.char)) continue
      done.add(g.char)
      const echo = a.interiors.get(g.char)?.echo
      if (!echo) continue
      const k = echo.members.length
      out.push({
        op: 'proliferation',
        level: 4,
        // the repetition is inside the character, not between characters
        origin: 'intrinsic',
        focus: {
          kind: 'parts',
          grapheme: g.index,
          parts: echo.members,
          readings: echo.members.map(() => null),
          arrangement: arrangement(echo.members),
          byReading: false,
          echo: { similarity: echo.similarity },
        },
        linguisticSalience: salience(echo.similarity, k >= 3 ? 0.7 : 0.6, content.filter((o) => o.char === g.char).length / n),
        roles: { primary: true, modifier: false },
        relations: [`echoForm「${g.char}」${k}塊 類似${echo.similarity.toFixed(2)}`],
        evidence: [
          `「${g.char}」の中で同じ形が${k}回戻ってくる（インクの島どうしが${(echo.similarity * 100).toFixed(0)}%重なる）`,
          '字としては読めない：読めるなら、それは部品への分解（字の層）の領分',
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
