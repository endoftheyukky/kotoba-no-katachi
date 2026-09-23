/**
 * 密度場 — DENSITY FIELD (v2)
 *
 *   linguistic input  what the small marks are made of (grammar/material.ts:
 *                     a repetition, a form read inside a character, the rest
 *                     of the title) and where the page's writing already is.
 *                     Where the poem erases seats, the erased characters.
 *   rule              the page's own marks stay as they are, an island; the
 *                     rest of the page is a sea of grains of that material,
 *                     sparse against the island and denser toward the edges,
 *                     thinned in a fixed dither order, never by chance. An
 *                     erasure is not a sea but a cloud: the erased characters
 *                     as grains, only where their seats were.
 *                     A page that is already a field of the title thins out
 *                     along the reading instead: dense where it begins,
 *                     sparse where it ends.
 *   visual output     a figure standing in weather made of its own writing;
 *                     an erased ending left as dust.
 *
 * Grain size and the sea's steepness are plastic. The lattice and the dither
 * are fixed, so the same title always makes the same weather.
 */
import { clamp } from '../../core/math'
import { PAGE } from '../../render/stage'
import type { Mark } from '../types'
import { clear, derive, dither, within, type MarkGrammar } from './common'
import { materialOf } from './material'
import { boxOf, type PageView } from './page'

function erased(v: PageView) {
  return v.seats.filter((s) => !s.written)
}

export const field: MarkGrammar = {
  id: 'field',
  title: '密度場',
  rules: [
    '紙面の字はそのまま島として残り、残りの紙面はその材料の粒の海になる：どの字の際でも疎く、字から離れるほど密になる。間引きは固定の網点の順で、偶然ではない',
    '粒の材料は、題が繰り返す単位、字の中に読まれた形、題の残り、の順に取る（題とその字形がすでに持っているものだけ）',
    '消された席は海ではなく雲になる：消えた字そのものが粒として、その席のあった場所にだけ残る',
    'すでに題の場である紙面は、読みの順に疎くなる：書き始めは密、書き終わりは疎',
    '粒の大きさと海の傾きは造形',
  ],

  offer(v) {
    const e = erased(v)
    if (e.length)
      return {
        grounds: [`${e.length}席が空として書かれる → 消えた字が粒として、その席に残る`],
        uses: [{ property: 'erased seats', value: e.map((s) => v.a.graphemes[s.grapheme]?.char).join('') }],
      }
    if (v.spatial.id === 'field')
      return { grounds: ['題そのものが場になっている → 読みの順に疎くなる'], uses: [{ property: 'field marks', value: `${v.marks.length}` }] }
    const mat = materialOf(v, v.nucleus.length ? v.nucleus : v.body)
    return {
      grounds: [`紙面の字を島に、${mat.note}を粒の海に`],
      uses: [{ property: 'grain', value: `${mat.chars.join('')}（${mat.kind}）` }],
    }
  },

  apply(v, rng) {
    const grain = within(rng, 0.024, 0.032) * PAGE
    const step = grain * 1.3
    const vertical = v.a.direction === 'vertical'

    // a page that is already a field thins out along its own reading
    if (v.spatial.id === 'field' && !erased(v).length) {
      const n = v.marks.length
      const s = v.marks[0]?.size ?? grain
      return v.marks.filter((k, idx) => {
        const t = idx / Math.max(1, n - 1)
        const i = Math.round(k.x / s)
        const j = Math.round(k.y / s)
        // the start is kept whole; from a fifth of the way on, it thins to a tenth
        return dither(i, j) < clamp(1 - 0.9 * Math.max(0, (t - 0.2) / 0.8), 0.1, 1)
      })
    }

    const island = v.marks
    const out: Mark[] = [...v.marks]
    const add = (x: number, y: number, char: string, kind: 'repeat' | 'form' | 'rest' | 'echo', note: string, from?: number) => {
      if (!clear(v, out, x, y, grain)) return
      if (x < grain || y < grain || x > PAGE - grain || y > PAGE - grain) return
      out.push({ char, x, y, size: grain * 0.92, role: 'grain', derived: derive('field', kind, note, from) })
    }

    // an erasure: a cloud of the erased characters over their own seats
    const e = erased(v)
    if (e.length) {
      for (const s of e) {
        const char = v.a.graphemes[s.grapheme]?.char
        if (!char?.trim()) continue
        const r = s.size * 0.62
        const cols = Math.floor((2 * r) / step)
        for (let j = 0; j <= cols; j++)
          for (let i = 0; i <= cols; i++) {
            const x = s.x - r + i * step
            const y = s.y - r + j * step
            const d = Math.hypot(x - s.x, y - s.y) / r
            if (d > 1) continue
            // a cloud: dense at its middle, thin at its edge
            if (dither(i, j) < 0.75 * (1 - d * d)) add(x, y, char, 'echo', `消された「${char}」が粒として席に残る`, s.grapheme)
          }
      }
      return out
    }

    // a sea of the material around the page's own writing: how thick it is at
    // a point depends on how far that point is from the nearest mark, so every
    // mark stands in its own clearing, however the marks are spread
    const mat = materialOf(v, v.nucleus.length ? v.nucleus : v.body)
    const boxes = island.map(boxOf)
    const gap = PAGE * within(rng, 0.03, 0.06)
    const span = PAGE * within(rng, 0.3, 0.45)
    const far = (x: number, y: number) =>
      Math.min(...boxes.map((b) => Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.y0 - y, 0, y - b.y1))))
    const count = Math.floor(PAGE / step)
    let n = 0
    // the lattice is read in the title's own direction, so the material runs in reading order
    for (let a = 0; a < count; a++)
      for (let b = 0; b < count; b++) {
        const i = vertical ? count - 1 - a : b
        const j = vertical ? b : a
        const x = (i + 0.5) * step
        const y = (j + 0.5) * step
        const d = clamp((far(x, y) - gap) / span)
        if (dither(i, j) >= 0.8 * Math.sqrt(d)) continue
        const c = mat.chars[n % mat.chars.length]
        const from = mat.from[n % mat.from.length]
        n++
        add(x, y, c, mat.kind === 'self' ? 'repeat' : mat.kind, mat.note, from)
      }
    return out
  },
}
