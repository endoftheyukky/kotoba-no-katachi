/**
 * 離散 — DISPERSION
 *
 * linguistic input
 *   the joints between characters: characters of one script hold firmly, a
 *   change of script (漢字|かな, かな|カナ) is weak, and a small kana or ー
 *   cannot be separated from what precedes it. The ink of each glyph:
 *   its thinnest line (seam) and how the ink divides on either side of it.
 *
 * transformation rule
 *   The word is one body, larger than the page. It breaks at its weakest
 *   joint (the one nearest the middle of the word, if several are equal);
 *   the page recentres on the break. Every glyph splits along its measured
 *   seam. Each half of the word is thrown away from the break as a fan:
 *   its fragments keep their reading order across the fan (the direction in
 *   which lines follow each other: right→left for vertical writing, top→
 *   bottom for horizontal), and a fragment with less ink flies further,
 *   across the edge.
 *   The fragments with less ink are lost. What remains returns to where the
 *   word stood. The fragments are whatever the measurement produces; nothing
 *   is chosen for what it looks like.
 *
 * start   the word set solid, no spacing, 1.75 × the page along its axis:
 *         a column (or bar) of type cut at both ends by the page.
 * middle  a void across the centre where the weakest joint was; two fans of
 *         fragments pressed against and across the edges.
 * final   the start composition again — same place, same scale — holding
 *         only the heavier fragment of every glyph.
 */
import { Track, inOut, out } from '../../core/time'
import { EM } from '../../glyph/font'
import { GlyphFigure } from '../../glyph/figure'
import { cellAdjust } from '../../glyph/layout'
import type { GlyphMetrics } from '../../glyph/metrics'
import type { Grapheme } from '../../language/types'
import { CENTRE, PAGE } from '../../render/stage'
import type { Composition, Cue, PoeticRule } from '../types'

const FIRM = 1
const WEAK = 0.35
/** length of the solid word relative to the page */
const OVERSIZE = 1.75
/** angular spread of each half of the word after the break, radians */
const FAN = (110 * Math.PI) / 180

const bound = (g: Grapheme) => g.small || g.char === 'ー'

interface Vec {
  x: number
  y: number
}

const rot = (v: Vec, deg: number): Vec => {
  const a = (deg * Math.PI) / 180
  return { x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) }
}

/** ink centroid of each side of the seam, em units relative to the ink centre */
function sideCentroids(m: GlyphMetrics): [Vec, Vec] {
  const { seam, half } = m
  const profile = seam.axis === 'x' ? m.cols : m.rows
  const ext = seam.axis === 'x' ? half.w : half.h
  const acc = [
    { w: 0, p: 0 },
    { w: 0, p: 0 },
  ]
  profile.forEach((v, b) => {
    const p = -ext + ((b + 0.5) / profile.length) * 2 * ext
    const side = p < seam.at ? 0 : 1
    acc[side].w += v
    acc[side].p += v * p
  })
  const c = acc.map((a, i) => (a.w > 0 ? a.p / a.w : i === 0 ? -ext / 2 : ext / 2))
  return seam.axis === 'x'
    ? [
        { x: c[0], y: 0 },
        { x: c[1], y: 0 },
      ]
    : [
        { x: 0, y: c[0] },
        { x: 0, y: c[1] },
      ]
}

export const disperse: PoeticRule = {
  id: 'disperse',
  title: '離散',
  statement: {
    input: 'joints between characters (script boundary weak, small kana bound); measured seam and ink share of each glyph',
    transformation: 'the word breaks at its weakest joint; glyphs split at their seam; fragments thrown from the break, lighter ones further; lighter ones lost',
    start: 'solid word, 1.3× the page, cut at both ends',
    middle: 'void at the break; fragments at and past the edges',
    final: 'the start composition holding only the heavier fragments',
  },

  affinity(word) {
    const n = word.graphemes.length
    if (n < 2) return 0 // no joint to break
    const scripts = new Set(word.graphemes.filter((g) => g.script !== 'mark').map((g) => g.script))
    return 1 + (scripts.size > 1 ? 1.2 : 0) + (n >= 3 ? 0.4 : 0)
  },

  compose(word, { stage, rng, glyphs }): Composition {
    const G = word.graphemes
    const n = G.length
    const vertical = word.direction === 'vertical'
    const axis: Vec = vertical ? { x: 0, y: 1 } : { x: 1, y: 0 }

    // units: bound graphemes are part of their predecessor
    const unit: number[] = []
    G.forEach((g, i) => unit.push(i === 0 ? 0 : bound(g) ? unit[i - 1] : unit[i - 1] + 1))
    const units = unit[n - 1] + 1

    // start: solid, oversized
    const size = Math.min(700, (PAGE * OVERSIZE) / n)
    const pitch = size * 0.94
    const along = G.map((_, i) => CENTRE + (i - (n - 1) / 2) * pitch)

    // RULE: the break is the weakest joint, the one nearest the middle among equals.
    const head = (u: number) => G[unit.indexOf(u)]
    let breakAt = CENTRE
    let lastBefore = Math.floor((n - 1) / 2) // last grapheme before the break
    if (units > 1) {
      const joints = Array.from({ length: units - 1 }, (_, j) => ({
        j,
        strength: head(j).script === head(j + 1).script ? FIRM : WEAK,
        centrality: Math.abs(j - (units - 2) / 2) + rng.next() * 0.01,
      }))
      joints.sort((a, b) => a.strength - b.strength || a.centrality - b.centrality)
      lastBefore = unit.lastIndexOf(joints[0].j)
      breakAt = (along[lastBefore] + along[lastBefore + 1]) / 2
    }
    const recentre = CENTRE - breakAt

    const metrics = G.map((g) => glyphs.get(g.char).metrics)
    const adjust = G.map((g) => cellAdjust(g, vertical))
    const k = size / EM
    const home = G.map((_, i): Vec => {
      const a = adjust[i]
      const x = (vertical ? CENTRE : along[i]) + a.dx * size
      const y = (vertical ? along[i] : CENTRE) + a.dy * size
      return { x, y }
    })

    // fragments
    const whole = G.map((g, i) =>
      new GlyphFigure(stage, glyphs.get(g.char)).place({ ...home[i], size, rotate: adjust[i].rotate }),
    )
    const parts = whole.map((f, i) => f.fragment(metrics[i].seam.axis, metrics[i].seam.at))
    const light = metrics.map((m) => (m.seam.share[0] < m.seam.share[1] ? 0 : 1))

    const rupture = 1.6
    const ruptureDur = 0.7
    const middle = rupture + ruptureDur + 0.05
    const lossStart = middle + 1.4
    const lossStep = Math.min(0.35, 1.4 / n)
    const back = lossStart + n * lossStep + 0.3
    const backDur = 1.3
    const final = back + backDur + 0.05

    const cues: Cue[] = [{ t: 0, kind: 'present', morae: word.morae.map((mo) => mo.index), amount: 1 }]
    let travel = 0

    // the two halves of the word, each a fan of fragments in reading order
    const lateral: Vec = vertical ? { x: 1, y: 0 } : { x: 0, y: -1 } // where reading order begins
    const halves = [0, 1].map((h) =>
      G.flatMap((_, i) => ((i <= lastBefore ? 0 : 1) === h ? [i * 2, i * 2 + 1] : [])),
    )
    const fanAngle = new Map<number, number>()
    for (const half of halves)
      half.forEach((f, q) => fanAngle.set(f, half.length > 1 ? FAN / 2 - (FAN * q) / (half.length - 1) : 0))

    const tracks = G.map((_, i) =>
      sideCentroids(metrics[i]).map((centroid, side) => {
        const c = rot(centroid, adjust[i].rotate)
        const off = { x: c.x * k, y: c.y * k }
        // RULE: away from the break, fanned by reading order
        const away = i <= lastBefore ? -1 : 1
        const a = fanAngle.get(i * 2 + side)!
        const u = {
          x: axis.x * away * Math.cos(a) + lateral.x * Math.sin(a),
          y: axis.y * away * Math.cos(a) + lateral.y * Math.sin(a),
        }
        // RULE: the lighter a fragment, the further it flies toward and across the edge
        const toEdge = CENTRE / Math.max(Math.abs(u.x), Math.abs(u.y))
        const share = metrics[i].seam.share[side]
        const r = toEdge * (0.58 + 0.42 * (1 - share))
        const from = { x: home[i].x + off.x + axis.x * recentre, y: home[i].y + off.y + axis.y * recentre }
        travel += Math.hypot(CENTRE + u.x * r - from.x, CENTRE + u.y * r - from.y) / PAGE
        const target = { x: CENTRE + u.x * r - off.x, y: CENTRE + u.y * r - off.y }
        const x = new Track(home[i].x).hold(rupture).to(rupture + ruptureDur, target.x, out)
        const y = new Track(home[i].y).hold(rupture).to(rupture + ruptureDur, target.y, out)
        if (side !== light[i]) {
          x.hold(back).to(back + backDur, home[i].x, inOut)
          y.hold(back).to(back + backDur, home[i].y, inOut)
        }
        return { x, y }
      }),
    )

    cues.push({ t: rupture, kind: 'rupture', morae: word.morae.map((mo) => mo.index), amount: travel / (2 * n) })
    const lostAt = G.map((_, i) => lossStart + i * lossStep)
    G.forEach((_, i) =>
      cues.push({ t: lostAt[i], kind: 'vanish', morae: [word.moraOf[i]], amount: metrics[i].seam.share[light[i]] }),
    )
    const kept = metrics.reduce((a, m, i) => a + m.density * m.seam.share[1 - light[i]], 0)
    const all = metrics.reduce((a, m) => a + m.density, 0)
    cues.push({ t: back, kind: 'return', morae: word.morae.map((mo) => mo.index), amount: all ? kept / all : 0 })
    cues.push({ t: final, kind: 'hold', morae: [], amount: all ? kept / all : 0 })

    return {
      duration: final + 2.6,
      states: { start: 0, middle, final },
      cues,
      render(t) {
        const broken = t >= rupture
        G.forEach((_, i) => {
          whole[i].show(!broken)
          parts[i].forEach((f, side) => {
            const gone = side === light[i] && t >= lostAt[i]
            f.show(broken && !gone)
            if (broken && !gone)
              f.place({ x: tracks[i][side].x.at(t), y: tracks[i][side].y.at(t), size, rotate: adjust[i].rotate })
          })
        })
      },
    }
  },
}
