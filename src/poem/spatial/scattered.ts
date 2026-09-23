/**
 * 散在 — SCATTERED
 * Words that stand side by side without depending on each other do not share
 * a line: each keeps its own place on the page.
 */
import { PAGE } from '../../render/stage'
import type { Analysis, Mark, SpatialComposition, Unit, Vec } from '../types'
import { centredLine, inside, isWritten } from './common'
import { coordinated, has, relationsOf } from './relations'

/** the words to place: every token with something written, except bare marks */
function independentGroups(a: Analysis, tokens: Unit[][]): Unit[][] {
  return tokens.filter((t) => t.some(isWritten) && !t.every((u) => a.graphemes[u.grapheme].script === 'symbol'))
}

export const scattered: SpatialComposition = {
  id: 'scattered',
  title: '散在',
  rules: [
    '空白で隔てられた語、三つ以上並列された語は、互いに依存しない：一語ずつ紙面の別々の場所に置かれる',
    '語どうしは一行を共有しない：一語ずつ自分の行を持ち、行は読みの順に一段ずつ下がりながら紙面を渡る（段）。どの語も読みの順を越えない',
    '段の幅は語の数から決まる：語が多いほど一段は浅い。語の大きさはすべて同じで、紙面が収められる大きさ',
    '一段下りるごとに、語は同じ角度ずつ傾く：傾きは並べられた順番に比例し、読みの順が一つずつ進むことを示す。一段あたりの角度は造形（6〜12°）',
    '散在は語どうしの置き方しか示せない：字形の関係・字の部品・語の継ぎ目が主操作のときは、それを表せないので使わない',
  ],

  fit(a, m) {
    // this space shows nothing of a glyph relation, a glyph's parts, or a joint inside a word
    const shows = m.primary.focus.kind
    if (shows === 'pair' || shows === 'parts' || shows === 'joint') return null
    const groups = independentGroups(a, m.tokens)
    if (groups.length < 2) return null
    if (relationsOf(a, 'separation').length) return { id: 'scattered', score: 0.85, grounds: ['語が空白で隔てられている → 散在'] }
    if (coordinated(a).length >= 3) return { id: 'scattered', score: 0.8, grounds: ['三つ以上の語が並列 → 散在'] }
    if (groups.length >= 3 && !has(a, 'dependency') && !has(a, 'coordination'))
      return { id: 'scattered', score: 0.5, grounds: ['互いに依存しない語が並ぶ'] }
    return null
  },

  realize(a, m, rng, scale) {
    const groups = independentGroups(a, m.tokens)
    const n = groups.length
    const vertical = a.direction === 'vertical'
    const longest = Math.max(...groups.map((g) => g.length))
    // one size for every word: the steps must fit, and so must the longest word
    const margin = 0.1 * PAGE
    const room = PAGE - 2 * margin
    const s = Math.min(scale.range('body')[1] * 0.8, room / (n + 1), room / (longest + n - 1))
    // 造形: how far each step goes across, between a half and a whole word
    const across = (room - s) / Math.max(1, n - 1) * rng.range(0.75, 1)
    const down = (room - longest * s) / Math.max(1, n - 1)
    // 造形: how far each step turns
    const turn = rng.range(6, 12)
    const marks: Mark[] = []
    groups.forEach((g, i) => {
      // vertical writing: columns step right to left, each a step lower;
      // horizontal: rows step down, each a step to the right
      const at: Vec = vertical
        ? { x: PAGE - margin - s / 2 - i * across, y: margin + i * down + (g.length * s) / 2 }
        : { x: margin + i * down + (g.length * s) / 2, y: margin + s / 2 + i * across }
      // the word turns as a whole, about its own centre: each character is
      // carried round with it, so the word still reads as one line
      const centre = inside(a, at, g.length * s, s)
      const theta = (i * turn * Math.PI) / 180
      marks.push(
        ...centredLine(a, g, centre, s).map((k) => {
          const dx = k.x - centre.x
          const dy = k.y - centre.y
          return {
            ...k,
            x: centre.x + dx * Math.cos(theta) - dy * Math.sin(theta),
            y: centre.y + dx * Math.sin(theta) + dy * Math.cos(theta),
            rotate: (k.rotate ?? 0) + i * turn || undefined,
          }
        }),
      )
    })
    return { marks }
  },
}
