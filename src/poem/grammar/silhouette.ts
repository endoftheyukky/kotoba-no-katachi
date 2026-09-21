/**
 * 微小シルエット — MICRO-SILHOUETTE (v2)
 *
 *   linguistic input  the mark the page is organised around (the nucleus), and
 *                     what small marks are made of (grammar/material.ts: a
 *                     repetition, a form read inside the nucleus, the rest of
 *                     the title in reading order, or the nucleus itself).
 *   rule              the nucleus is not written as one mark: its ink is
 *                     sampled on a fixed lattice and every sample that falls on
 *                     ink becomes a small mark of the material. The nucleus's
 *                     character is still on the page — as a form, not as a
 *                     glyph. Where the nucleus is too small for the grains to
 *                     be read, the form is drawn larger than the glyph was (a
 *                     form made of small marks can be large and still light),
 *                     as far as the page and its other marks allow.
 *   visual output     a character made of other writing: 森 in 木, あと in 海,
 *                     a residue in the glyph that was taken out of it.
 *
 * The lattice's fineness is plastic (twelve to fifteen grains across the em);
 * where the samples fall is not.
 */
import { PAGE } from '../../render/stage'
import type { Mark } from '../types'
import { derive, GRAIN_MIN, within, type MarkGrammar } from './common'
import { materialOf } from './material'
import { boxOf, inkAt } from './page'

/** the part of a sample cell that must be ink for a grain to stand there */
const COVER = 4 / 9

export const silhouette: MarkGrammar = {
  id: 'silhouette',
  title: '微小シルエット',
  rules: [
    '紙面の核は一つの字として書かれない：そのインクを固定の格子で標本化し、インクに落ちた点ごとに小さな字を置く。核の字は形として紙面に残る',
    '小さな字の材料は、題が繰り返す単位、核の中に読まれた形、題の残り（読みの順）、核そのもの、の順に取る',
    '核が小さく粒が読めないときは、形を元の字より大きく描く（小さな字でできた形は、大きくても軽い）。紙面と他の字が許す範囲で',
    '格子の細かさは造形（一字あたり十二〜十五粒）。点がどこに落ちるかは字形が決める',
  ],

  offer(v) {
    if (!v.nucleus.length) return null
    const mat = materialOf(v, v.nucleus)
    return {
      grounds: [`核「${v.nucleus.map((k) => k.char).join('')}」を、${mat.note}の小さな字で描く`],
      uses: [
        { property: 'nucleus', value: v.nucleus.map((k) => k.char).join('') },
        { property: 'grain', value: `${mat.chars.join('')}（${mat.kind}）` },
      ],
    }
  },

  apply(v, rng) {
    if (!v.nucleus.length) return v.marks
    const mat = materialOf(v, v.nucleus)
    const across = Math.round(within(rng, 12, 15))
    const others = v.marks.filter((k) => !v.nucleus.includes(k))

    // the nucleus is one form, however many marks it is (a word): it is
    // enlarged as a whole about its own centre, then moved to fit the page,
    // and made smaller again only where the page or its other marks require
    const size = Math.max(...v.nucleus.map((k) => k.size))
    const grain = Math.max(GRAIN_MIN * PAGE, size / across)
    const want = (grain * across) / size
    const boxes0 = v.nucleus.map(boxOf)
    const cx = (Math.min(...boxes0.map((b) => b.x0)) + Math.max(...boxes0.map((b) => b.x1))) / 2
    const cy = (Math.min(...boxes0.map((b) => b.y0)) + Math.max(...boxes0.map((b) => b.y1))) / 2
    const margin = PAGE * 0.04
    let form = v.nucleus
    for (let f = want; f >= 1; f -= 0.04) {
      const grown = v.nucleus.map((k) => ({ ...k, x: cx + (k.x - cx) * f, y: cy + (k.y - cy) * f, size: k.size * f }))
      const bs = grown.map(boxOf)
      const x0 = Math.min(...bs.map((b) => b.x0))
      const x1 = Math.max(...bs.map((b) => b.x1))
      const y0 = Math.min(...bs.map((b) => b.y0))
      const y1 = Math.max(...bs.map((b) => b.y1))
      if (x1 - x0 > PAGE - 2 * margin || y1 - y0 > PAGE - 2 * margin) continue
      const dx = x0 < margin ? margin - x0 : x1 > PAGE - margin ? PAGE - margin - x1 : 0
      const dy = y0 < margin ? margin - y0 : y1 > PAGE - margin ? PAGE - margin - y1 : 0
      const moved = grown.map((k) => ({ ...k, x: k.x + dx, y: k.y + dy }))
      const free = moved.every((k) => {
        const b = boxOf(k)
        return others.every((o) => {
          const c = boxOf(o)
          return c.x1 < b.x0 || c.x0 > b.x1 || c.y1 < b.y0 || c.y0 > b.y1
        })
      })
      if (free) {
        form = moved
        break
      }
    }
    const g = Math.max(GRAIN_MIN * PAGE, Math.max(...form.map((k) => k.size)) / across)
    const step = g * 1.1
    const out: Mark[] = [...others]
    // one lattice for the whole form, so that two marks of it never put two grains in one place
    const taken = new Set<string>()
    let n = 0
    for (let fi = 0; fi < form.length; fi++) {
      const k = form[fi]
      const b = boxOf(k)
      for (let j = Math.floor(b.y0 / step); j <= Math.ceil(b.y1 / step); j++)
        for (let i = Math.floor(b.x0 / step); i <= Math.ceil(b.x1 / step); i++) {
          const key = `${i},${j}`
          if (taken.has(key)) continue
          const x = i * step
          const y = j * step
          if (x < g / 2 || y < g / 2 || x > PAGE - g / 2 || y > PAGE - g / 2) continue
          // the form is read in the face the reading was made in: its full ink
          let hit = 0
          for (const oy of [-1, 0, 1]) for (const ox of [-1, 0, 1]) if (inkAt(v, k, { x: x + (ox * step) / 3, y: y + (oy * step) / 3 }, 'sans')) hit++
          if (hit / 9 < COVER) continue
          // a grain never lands on the ink of another mark of the page
          const corners = [[0, 0], [0.4, 0.4], [-0.4, 0.4], [0.4, -0.4], [-0.4, -0.4]].map(([u, w]) => ({ x: x + u * g, y: y + w * g }))
          if (others.some((o) => corners.some((p) => inkAt(v, o, p)))) continue
          taken.add(key)
          const c = mat.chars[n % mat.chars.length]
          const from = mat.from[n % mat.from.length]
          n++
          const k0 = v.nucleus[fi]
          out.push({
            char: c,
            x,
            y,
            size: g * 0.94,
            role: 'grain',
            derived: derive('silhouette', mat.kind === 'self' ? 'repeat' : mat.kind, `「${k0.char}」の形を${mat.note}で描く`, from),
            ...(k0.grapheme !== undefined ? { represents: k0.grapheme } : {}),
          })
        }
    }
    return out
  },
}
