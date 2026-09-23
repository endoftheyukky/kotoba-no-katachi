/**
 * 微小シルエット — MICRO-SILHOUETTE (v2)
 *
 *   linguistic input  the mark the page is organised around (the nucleus), and
 *                     what small marks are made of (grammar/material.ts: a
 *                     repetition, a form read inside the nucleus, the rest of
 *                     the title in reading order, or the nucleus itself).
 *   rule              the nucleus is not written as one mark: its ink is
 *                     sampled on a fixed lattice and becomes small marks of the
 *                     material. The nucleus's character is still on the page —
 *                     as a form, not as a glyph. Where the nucleus is too small
 *                     for the grains to be read, the form is drawn larger than
 *                     the glyph was (a form made of small marks can be large
 *                     and still light), as far as the page and its other marks
 *                     allow.
 *   visual output     a character made of other writing: 森 in 木, あと in 海,
 *                     a residue in the glyph that was taken out of it.
 *
 * Four ways, one per kind of nucleus, never by chance (variantOf):
 *
 *   residue   the nucleus is what a subtraction left: the residue is filled
 *             with grains, and the glyph taken out of it stays where it was
 *             as a trace — the smallest grains, every other lattice point
 *   contour   the nucleus's white is what the page is about (the counter it
 *             closes in, or white holding a quarter of its box): only the
 *             edge of its ink is drawn, a line of grains standing just off
 *             the strokes, so that the white inside becomes the figure
 *   density   the nucleus is written as writing, in the face whose strokes
 *             vary in width (their widths vary by a quarter or more): the
 *             grains follow the strokes' width — large on the thick strokes,
 *             small on the thin — on one lattice
 *   fill      otherwise (a reading of ink, in the even face): every lattice
 *             point that falls on ink holds a grain of one size
 *
 * The lattice's fineness is plastic (twelve to fifteen grains across the em;
 * twenty to twenty-four for a contour, whose line must stand apart from
 * itself); where the samples fall is not.
 */
import { PAGE } from '../../render/stage'
import { faceOf } from '../face'
import type { Mark } from '../types'
import { CLEAR, derive, dither, GRAIN_MIN, within, type MarkGrammar } from './common'
import { coverNear, distances, edgeDistance, strokeWidths, widthNear } from './ink'
import { materialOf } from './material'
import { boxOf, inkAt, inkNear, removedAt, toEm, type PageView } from './page'

/** the part of a sample cell that must be ink for a grain to stand there */
const COVER = 4 / 9
/** a trace of what was taken out: the smaller share of a cell that marks where it was */
const TRACE_COVER = 3 / 9
/** white of this share of the nucleus's box makes the white the subject */
const CONTOUR_WHITE = 0.25
/** stroke widths varying this much (coefficient of variation) are a face with contrast */
const CONTRAST = 0.25
/** the largest grain of a density form, over the smallest */
const DENSITY_RANGE = 2
/** grains across the em, by way */
const ACROSS = { fill: [12, 15], residue: [12, 15], density: [11, 13], contour: [20, 24] } as const

export type SilhouetteWay = keyof typeof ACROSS
export const SILHOUETTE_WAYS: readonly SilhouetteWay[] = ['fill', 'contour', 'density', 'residue']

const EM = 100
const plain = (k: Mark) => !k.keep?.length && !k.minus && !k.shift

/** the smallest grain, in page units */
const gMin = () => GRAIN_MIN * PAGE

/**
 * The nucleus as one form, enlarged about its own centre toward `want` times
 * its size, moved to fit the page, and made smaller again only where the page
 * or the page's other marks require.
 */
function grow(v: PageView, want: number): Mark[] {
  const others = v.marks.filter((k) => !v.nucleus.includes(k))
  const boxes0 = v.nucleus.map(boxOf)
  const cx = (Math.min(...boxes0.map((b) => b.x0)) + Math.max(...boxes0.map((b) => b.x1))) / 2
  const cy = (Math.min(...boxes0.map((b) => b.y0)) + Math.max(...boxes0.map((b) => b.y1))) / 2
  const margin = PAGE * 0.04
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
    if (free) return moved
  }
  return v.nucleus
}

/** the largest the nucleus can be drawn as a form of `across` smallest grains, or null where it cannot reach it */
function reachable(v: PageView, across: number): boolean {
  const size = Math.max(...v.nucleus.map((k) => k.size))
  const need = (gMin() * across) / size
  const form = grow(v, Math.max(1, need))
  return Math.max(...form.map((k) => k.size)) >= gMin() * across * 0.98
}

/** which way the nucleus is drawn, and why */
export function variantOf(v: PageView): { way: SilhouetteWay; why: string } {
  const chars = v.nucleus.map((k) => k.char).join('')
  // review only: a way asked for by name, where the nucleus can be drawn that way at all
  const asked = SILHOUETTE_WAYS.find((w) => w === v.variant)
  if (asked) {
    const can = asked === 'fill' || (asked === 'residue' ? v.nucleus.some((k) => k.minus) : v.nucleus.every(plain))
    return can ? { way: asked, why: `（レビュー用に${asked}を指定）` } : { way: 'fill', why: `（${asked}を指定したが、核「${chars}」はその描き方をとれない：塗り）` }
  }
  if (v.nucleus.some((k) => k.minus))
    return { way: 'residue', why: `核「${chars}」は引き算の残り：残りを粒で満たし、取り去られた字を（その場に書かれていなければ）跡として残す` }
  const f = v.m.primary.focus
  const white =
    v.nucleus.every(plain) &&
    v.nucleus.some((k) => {
      if (f.kind === 'counter' && f.grapheme === k.grapheme) return true
      const inside = v.a.interiors.get(k.char)
      return !!inside && inside.counters.reduce((s, c) => s + c.area, 0) >= CONTOUR_WHITE
    })
  if (white && reachable(v, ACROSS.contour[0]))
    return { way: 'contour', why: `核「${chars}」の閉じた白が主題：インクの縁だけを粒の線で描き、内側の白を図にする` }
  if (v.nucleus.every(plain) && v.nucleus.every((k) => faceOf(v.a, v.m, k) === 'serif')) {
    const cv = Math.min(...v.nucleus.map((k) => strokeWidths(v.a.glyphs.get(k.char, 'serif').metrics.ink).cv))
    if (cv >= CONTRAST && reachable(v, ACROSS.density[0] * DENSITY_RANGE))
      return { way: 'density', why: `核「${chars}」は書の字体で書かれ、画の太さが揺れる（変動係数${cv.toFixed(2)}）：太い画は大きな粒、細い画は小さな粒` }
  }
  return { way: 'fill', why: `核「${chars}」は均一な画の読み：インクに落ちた格子点すべてに同じ大きさの粒` }
}

export const silhouette: MarkGrammar = {
  id: 'silhouette',
  title: '微小シルエット',
  rules: [
    '紙面の核は一つの字として書かれない：そのインクを固定の格子で標本化し、小さな字にする。核の字は形として紙面に残る',
    '小さな字の材料は、題が繰り返す単位、核の中に読まれた形、題の残り（読みの順）、核そのもの、の順に取る',
    '描き方は核の種類が決める（偶然ではない）：引き算の残りなら残りを粒で満たし、取り去られた字を最小の粒の跡として残す（残余）。閉じた白が主題なら、インクの縁だけを粒の線で描く（輪郭）。書の字体で書かれ画の太さが揺れる字なら、画の太さが粒の大きさになる（濃淡）。それ以外は、インクに落ちた格子点すべてに同じ粒（塗り）',
    '核が小さく粒が読めないときは、形を元の字より大きく描く（小さな字でできた形は、大きくても軽い）。紙面と他の字が許す範囲で',
    '格子の細かさは造形（一字あたり十二〜十五粒、輪郭は二十〜二十四粒）。点がどこに落ちるかは字形が決める',
  ],

  offer(v) {
    if (!v.nucleus.length) return null
    const mat = materialOf(v, v.nucleus)
    const { way, why } = variantOf(v)
    return {
      grounds: [`核「${v.nucleus.map((k) => k.char).join('')}」を、${mat.note}の小さな字で描く`, why],
      uses: [
        { property: 'nucleus', value: v.nucleus.map((k) => k.char).join('') },
        { property: 'grain', value: `${mat.chars.join('')}（${mat.kind}）` },
        { property: 'way', value: way },
      ],
      variant: way,
    }
  },

  apply(v, rng) {
    if (!v.nucleus.length) return v.marks
    const mat = materialOf(v, v.nucleus)
    const { way } = variantOf(v)
    const [lo, hi] = ACROSS[way]
    const across = Math.round(within(rng, lo, hi))
    const others = v.marks.filter((k) => !v.nucleus.includes(k))
    const size = Math.max(...v.nucleus.map((k) => k.size))
    // density needs room between its smallest grain and its largest: the
    // thickest stroke's grain is twice the smallest a grain can be
    const grain = Math.max(gMin() * (way === 'density' ? DENSITY_RANGE : 1), size / across)
    const form = grow(v, (grain * across) / size)
    const g = Math.max(gMin(), Math.max(...form.map((k) => k.size)) / across)
    const out: Mark[] = [...others]
    let n = 0
    const next = () => {
      const c = mat.chars[n % mat.chars.length]
      const from = mat.from[n % mat.from.length]
      n++
      return { c, from }
    }
    const kind = mat.kind === 'self' ? 'repeat' : mat.kind
    const grainOf = (fi: number, x: number, y: number, s: number, note: string): Mark => {
      const { c, from } = next()
      const k0 = v.nucleus[fi]
      return {
        char: c,
        x,
        y,
        size: s,
        role: 'grain',
        derived: derive('silhouette', kind, note, from),
        ...(k0.grapheme !== undefined ? { represents: k0.grapheme } : {}),
      }
    }
    // a grain never lands on the ink of another mark of the page
    const clearOfOthers = (x: number, y: number, s: number) =>
      !others.some((o) => Math.abs(o.x - x) < (o.size + s) * 0.75 && Math.abs(o.y - y) < (o.size + s) * 0.75 && inkNear(v, o, { x, y }, s * CLEAR))
    const inside = (x: number, y: number, s: number) => x >= s / 2 && y >= s / 2 && x <= PAGE - s / 2 && y <= PAGE - s / 2
    const note = (k0: Mark) => `「${k0.char}」の形を${mat.note}で描く`

    if (way === 'contour') {
      // a line of grains standing just off the ink: the outline of the strokes
      const off = g * 0.62
      const fine = g * 0.34
      const dist = form.map((k) => distances(v.a.glyphs.get(k.char, 'sans').metrics.ink))
      const edge = (x: number, y: number) =>
        Math.min(...form.map((k, i) => (edgeDistance(dist[i], toEm(k, { x, y })) * k.size) / EM))
      const band: { x: number; y: number; fi: number }[] = []
      const seen = new Set<string>()
      form.forEach((k, fi) => {
        const b = boxOf(k)
        const pad = off + g
        for (let j = Math.floor((b.y0 - pad) / fine); j <= Math.ceil((b.y1 + pad) / fine); j++)
          for (let i = Math.floor((b.x0 - pad) / fine); i <= Math.ceil((b.x1 + pad) / fine); i++) {
            const key = `${i},${j}`
            if (seen.has(key)) continue
            seen.add(key)
            const x = i * fine
            const y = j * fine
            if (Math.abs(edge(x, y) - off) <= fine * 0.5) band.push({ x, y, fi })
          }
      })
      // walk the band as a line: from its first point to the nearest next one,
      // setting a grain down each time the walk has gone a grain and a bit
      const spacing = g * 1.12
      const placed: Mark[] = []
      const left = new Set(band.map((_, i) => i))
      const far = (x: number, y: number) => placed.every((p) => Math.hypot(p.x - x, p.y - y) >= g * 1.02)
      while (left.size) {
        let i = Math.min(...left)
        let walked = spacing
        let px = band[i].x
        let py = band[i].y
        for (;;) {
          left.delete(i)
          const p = band[i]
          walked += Math.hypot(p.x - px, p.y - py)
          px = p.x
          py = p.y
          if (walked >= spacing && inside(p.x, p.y, g) && far(p.x, p.y) && clearOfOthers(p.x, p.y, g)) {
            placed.push(grainOf(p.fi, p.x, p.y, g * 0.94, note(v.nucleus[p.fi])))
            walked = 0
          }
          let best = -1
          let bd = fine * 2.2
          for (const j of left) {
            const d = Math.hypot(band[j].x - p.x, band[j].y - p.y)
            if (d < bd) {
              bd = d
              best = j
            }
          }
          if (best < 0) break
          i = best
        }
      }
      return [...out, ...placed]
    }

    const step = g * 1.1
    // one lattice for the whole form, so that two marks of it never put two grains in one place
    const taken = new Set<string>()
    if (way === 'density') {
      // the writing face: the width of the stroke under a point sets the grain there
      const small = Math.max(gMin(), g / DENSITY_RANGE)
      for (let fi = 0; fi < form.length; fi++) {
        const k = form[fi]
        const ink = v.a.glyphs.get(k.char, 'serif').metrics.ink
        const d = distances(ink)
        const widths = strokeWidths(ink)
        const wide = widths.mean * (1 + widths.cv)
        const thin = widths.mean * (1 - widths.cv)
        const r = (step / 2) * (EM / k.size)
        const b = boxOf(k)
        for (let j = Math.floor(b.y0 / step); j <= Math.ceil(b.y1 / step); j++)
          for (let i = Math.floor(b.x0 / step); i <= Math.ceil(b.x1 / step); i++) {
            const key = `${i},${j}`
            if (taken.has(key)) continue
            const x = i * step
            const y = j * step
            const e = toEm(k, { x, y })
            if (coverNear(d, e, r) < 2 / 25) continue
            const w = widthNear(d, e, r)
            const t = Math.min(1, Math.max(0, (w - thin) / Math.max(1e-6, wide - thin)))
            const s = small + (g - small) * t
            if (!inside(x, y, s) || !clearOfOthers(x, y, s)) continue
            taken.add(key)
            out.push(grainOf(fi, x, y, s * 0.94, note(v.nucleus[fi])))
          }
      }
      return out
    }

    // fill, and the residue of a subtraction
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
          if (!clearOfOthers(x, y, g)) continue
          taken.add(key)
          out.push(grainOf(fi, x, y, g * 0.94, note(v.nucleus[fi])))
        }
    }
    if (way !== 'residue') return out
    // what was taken out stays where it was, as the smallest grains, every other point
    const trace = gMin()
    for (let fi = 0; fi < form.length; fi++) {
      const k = form[fi]
      if (!k.minus) continue
      const gone = k.minus.char
      const from = v.m.tokens.flat().find((u) => u.char === gone)?.grapheme
      const b = boxOf(k)
      // where the page writes what was taken out in its own place (a nest), it needs no trace
      if (others.some((o) => o.char === gone && o.x > b.x0 && o.x < b.x1 && o.y > b.y0 && o.y < b.y1)) continue
      for (let j = Math.floor(b.y0 / step); j <= Math.ceil(b.y1 / step); j++)
        for (let i = Math.floor(b.x0 / step); i <= Math.ceil(b.x1 / step); i++) {
          const key = `${i},${j}`
          if (taken.has(key) || dither(i, j) >= 0.5) continue
          const x = i * step
          const y = j * step
          let hit = 0
          for (const oy of [-1, 0, 1]) for (const ox of [-1, 0, 1]) if (removedAt(v, k, { x: x + (ox * step) / 3, y: y + (oy * step) / 3 })) hit++
          // a trace is thin: a third of the cell on the removed ink is enough to mark it
          if (hit / 9 < TRACE_COVER || !inside(x, y, trace) || !clearOfOthers(x, y, trace)) continue
          // and never on what remains
          if ([[0, 0], [0.4, 0.4], [-0.4, 0.4], [0.4, -0.4], [-0.4, -0.4]].some(([u, w]) => inkAt(v, k, { x: x + u * trace, y: y + w * trace }, 'sans'))) continue
          taken.add(key)
          out.push({
            char: gone,
            x,
            y,
            size: trace * 0.94,
            role: 'trace',
            derived: derive('silhouette', 'form', `「${k.char}」から取り去られた「${gone}」の跡`, from),
          })
        }
    }
    return out
  },
}
