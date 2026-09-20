/**
 * 空白・欠落 — ABSENCE
 * Words that are only relation, morae that are only silence, and negations
 * are written as the space they occupy.
 */
import { RELATION_WORD_DISTINCTIVENESS, salience } from '../salience'
import type { PoeticOperation } from '../types'

export const absence: PoeticOperation = {
  id: 'absence',
  title: '空白・欠落',
  rules: [
    '助詞・接続語は語と語の関係そのものであって、形を持たない：その場所は空白として書かれる',
    '促音「っ」は拍としての沈黙である：空白として書かれる。ただし欠けているのは語ではなく一拍なので、等間隔の拍の列（帯）の中でしか「欠けた一枡」としては読めない',
    '否定（ない・ず・不・無…）は、否定されたものの不在である：否定の語は空白として書かれる',
    '関係の強さ：否定 0.9、促音 0.6、関係語 0.6。固有性：否定 0.8、促音 0.5、関係語は語による（の 0.3 … または 0.6）。被覆：空白が題の内側にあって語を二つに分けるなら 1、端にあるなら 0.5',
    '空白は詰められない：失われた字の位置と大きさは、紙面に残る',
  ],

  propose(a) {
    const inside = (graphemes: number[]) =>
      graphemes.length > 0 && Math.min(...graphemes) > 0 && Math.max(...graphemes) < a.graphemes.length - 1

    const negations = a.relations.flatMap((r) => (r.kind === 'negation' ? [r] : []))
    const silences = a.morae.filter((m) => m.kind === 'Q')
    const words = a.tokens.filter((t) => t.pos === 'particle' || t.pos === 'conjunction')
    if (!negations.length && !silences.length && !words.length) return []

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

    return [
      {
        op: 'absence',
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
