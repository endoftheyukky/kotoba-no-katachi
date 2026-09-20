/**
 * 空白・欠落 — ABSENCE
 * Words that are only relation, morae that are only silence, and negations
 * are written as the space they occupy.
 */
import { clamp } from '../../core/math'
import { contentGraphemes, RELATION_WORD_DISTINCTIVENESS, salience } from '../salience'
import type { Analysis, PoeticOperation, Proposal } from '../types'

/**
 * 画（level 4）: the white a character's own strokes close in. Not a gap
 * between strokes — the flood fill from outside cannot reach it, and it
 * holds at least 8% of the ink box.
 */
function interiors(a: Analysis): Proposal[] {
  const content = contentGraphemes(a)
  const out: Proposal[] = []
  const seen = new Set<string>()
  for (const g of content) {
    if (seen.has(g.char)) continue
    seen.add(g.char)
    const inside = a.interiors.get(g.char)
    if (!inside?.counters.length) continue
    const holes = inside.counters
    const biggest = holes[0].area
    const rhythm = holes.length >= 2 && inside.even >= 0.7
    const rs = Math.max(Math.min(1, biggest / 0.25), rhythm ? 0.75 : 0)
    const d = 0.45 + 0.35 * clamp((biggest - 0.08) / 0.3)
    const carried = content.filter((o) => o.char === g.char).length
    // Detecting the white and being able to do something with it are two
    // things. What the present compositions can do with a counter is put the
    // rest of the title inside it; with nothing to put there, the page would
    // be the character enlarged and no more. The feature is still read and
    // recorded — a later grammar that opens the counters themselves as voids
    // can lift this condition.
    const placeable = content.filter((o) => o.index !== g.index).length
    out.push({
      op: 'absence',
      level: 4,
      // the white belongs to the character itself
      origin: 'intrinsic',
      focus: { kind: 'counter', grapheme: g.index, holes, arrangement: inside.arrangement, even: inside.even },
      linguisticSalience: salience(rs, d, carried / Math.max(1, content.length)),
      roles: {
        primary: placeable > 0,
        modifier: false,
        note:
          placeable > 0
            ? undefined
            : '閉じた白の中に置ける題の字がない：今の構成語彙では元の字を一様に大きくするだけになるので、feature としては読むが主操作にはしない',
      },
      relations: [
        `counter「${g.char}」×${holes.length} ${holes.map((h) => h.area.toFixed(2)).join('/')} ${inside.arrangement}`,
      ],
      evidence: [
        `「${g.char}」の線は${holes.length}つの白を閉じ込めている（最大でインク箱の${(biggest * 100).toFixed(0)}%）`,
        inside.arrangement === 'nested'
          ? '白の中に白がある'
          : holes.length > 1
            ? `${holes.length}つの白は${(inside.even * 100).toFixed(0)}%まで等しい`
            : '白は一つ',
      ],
    })
  }
  return out
}

export const absence: PoeticOperation = {
  id: 'absence',
  title: '空白・欠落',
  rules: [
    '助詞・接続語は語と語の関係そのものであって、形を持たない：その場所は空白として書かれる',
    '促音「っ」は拍としての沈黙である：空白として書かれる。ただし欠けているのは語ではなく一拍なので、等間隔の拍の列（帯）の中でしか「欠けた一枡」としては読めない',
    '否定（ない・ず・不・無…）は、否定されたものの不在である：否定の語は空白として書かれる',
    '関係の強さ：否定 0.9、促音 0.6、関係語 0.6。固有性：否定 0.8、促音 0.5、関係語は語による（の 0.3 … または 0.6）。被覆：空白が題の内側にあって語を二つに分けるなら 1、端にあるなら 0.5',
    '空白は詰められない：失われた字の位置と大きさは、紙面に残る',
    '字がすでに抱えている閉じた白（口の中、日の二つ、田の四つ）も、置かれていない場所である：それは画の隙間ではなく、線が閉じ込めた白で、インク箱の8%以上を占めるものだけを数える',
    '閉じた白の関係の強さ ＝ 最大の白の大きさ（0.25で1）。等しい白が二つ以上あればそれ自体が律動なので0.75を下回らない。固有性は白が大きいほど高い（口0.47→0.80、日0.21→0.60、閾値付近→0.45）',
    '閉じた白が主操作になれるのは、その白の中に置ける題の他の字があるときだけである：白は場所であって、場所は何かが置かれて初めて場所になる。置くものがなければ紙面は元の字の拡大にしかならないので、feature としては読み、記録し、主操作の候補にはしない。白そのものを複数の空洞として展開する構成が加われば、この条件は外せる',
  ],

  propose(a) {
    const inside = (graphemes: number[]) =>
      graphemes.length > 0 && Math.min(...graphemes) > 0 && Math.max(...graphemes) < a.graphemes.length - 1

    const negations = a.relations.flatMap((r) => (r.kind === 'negation' ? [r] : []))
    const silences = a.morae.filter((m) => m.kind === 'Q')
    const words = a.tokens.filter((t) => t.pos === 'particle' || t.pos === 'conjunction')
    // the white a character holds does not depend on the title having a word
    // or a beat to lose
    if (!negations.length && !silences.length && !words.length) return interiors(a)

    const graphemes = [
      ...negations.flatMap((r) => r.graphemes),
      ...silences.flatMap((m) => m.graphemes),
      ...words.flatMap((t) => Array.from({ length: t.end - t.start }, (_, i) => t.start + i)),
    ]
    // the strongest of the absences sets the salience
    const candidates = [
      // what is missing is a word (level 1) or a beat (level 3)
      ...negations.map((r) => ({ rs: 0.9, d: 0.8, at: r.graphemes, level: 1 as const, label: `negation「${a.tokens[r.token].surface}」` })),
      ...silences.map((m) => ({ rs: 0.6, d: 0.5, at: m.graphemes, level: 3 as const, label: `silence「${m.text}」` })),
      ...words.map((t) => ({
        rs: 0.6,
        d: RELATION_WORD_DISTINCTIVENESS[t.surface] ?? 0.4,
        at: Array.from({ length: t.end - t.start }, (_, i) => t.start + i),
        level: 1 as const,
        label: `relationWord「${t.surface}」`,
      })),
    ].map((c) => ({ ...c, s: salience(c.rs, c.d, inside(c.at) ? 1 : 0.5) }))
    const best = candidates.sort((x, y) => y.s.value - x.s.value)[0]
    const read = a.morae.filter((m) => m.kind !== 'unread')

    return [...interiors(a), {
        op: 'absence' as const,
        level: best.level,
        origin: 'endogenous',
        focus: {
          kind: 'absence',
          graphemes: [...new Set(graphemes)],
          negation: negations.length > 0,
          silence: silences.length > 0,
          beats: read.length,
          silentMorae: silences.map((m) => m.index),
        },
        linguisticSalience: best.s,
        roles: { primary: true, modifier: true },
        relations: candidates.map((c) => c.label),
        evidence: candidates.map((c) => `${c.label.replace(/^\w+/, '')} は空白として書かれる`),
      },
    ]
  },

  apply(_a, p, tokens) {
    if (p.focus.kind !== 'absence') return null
    const gone = new Set(p.focus.graphemes)
    let hit = false
    const out = tokens.map((t) =>
      t.map((u) => {
        if (!gone.has(u.grapheme)) return u
        hit = true
        return { ...u, absent: true }
      }),
    )
    // a poem cannot be made of nothing
    return hit && out.flat().some((u) => !u.absent && u.char.trim()) ? out : null
  },
}
