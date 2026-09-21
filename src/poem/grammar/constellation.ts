/**
 * 星座 — CONSTELLATION (v2)
 *
 *   linguistic input  the kinds of material the page holds, each from its own
 *                     distance to the title's writing (grammar/material.ts):
 *                     structure (a repetition, a form read in a character, the
 *                     rest of the title), sound (the reading reduced to its
 *                     vowels), and — in review only — meaning (characters a
 *                     lexicon relates to the title's own). At least two kinds.
 *   rule              each kind is a cluster of its own. What the title itself
 *                     holds (structure, sound) is a small disc of grains
 *                     written through with its characters in reading order,
 *                     its area one share for each character measured — a
 *                     mass, not a word, so that it is never read as a gloss
 *                     on the title. Meaning, from outside, is only a few
 *                     marks round a ring. The clusters stand in the page's
 *                     own white (the largest empty circles it leaves), in the
 *                     order of the kind's distance from the writing: structure
 *                     in the white nearest the writing, sound in white further
 *                     off, meaning furthest; each apart from the ones before.
 *                     How much a cluster holds is what was measured: a
 *                     repetition as many times as the title repeats it, a
 *                     form as many times as it was read in the character, the
 *                     rest of the title and the vowels once each; meaning once
 *                     each, and never more than three.
 *   visual output     the title's writing with its satellites, at three
 *                     distances: what it is made of close by, how it sounds
 *                     further off, what it calls up furthest away.
 *
 * Plastic: the area of one share, the gap between clusters, and the grain of
 * each cluster inside its role's range. Their order, and which white each
 * takes (nearest first), are not.
 */
import { PAGE } from '../../render/stage'
import type { Mark } from '../types'
import { derive, free, within, type MarkGrammar } from './common'
import { partsRead, strandsOf, type Strand } from './material'
import { boxOf, type PageView } from './page'
import { roleSize } from './roles'

/** the core the clusters stand around: the nucleus, or else the whole body */
function core(v: PageView) {
  const ks = v.nucleus.length ? v.nucleus : v.body
  const bs = ks.map(boxOf)
  const x0 = Math.min(...bs.map((b) => b.x0))
  const x1 = Math.max(...bs.map((b) => b.x1))
  const y0 = Math.min(...bs.map((b) => b.y0))
  const y1 = Math.max(...bs.map((b) => b.y1))
  return { ks, x: (x0 + x1) / 2, y: (y0 + y1) / 2, rx: (x1 - x0) / 2, ry: (y1 - y0) / 2 }
}

/**
 * The page's white: where a disc can stand clear of the writing, as the
 * centres of the largest empty circles on a coarse grid, each with its
 * radius and its distance from the core. Ink is taken as the marks' boxes,
 * which is on the side of caution.
 */
function whiteOf(v: PageView, margin: number): { x: number; y: number; r: number; d: number }[] {
  const N = 50
  const cell = PAGE / N
  const INF = 1e9
  const dist = new Float32Array(N * N).fill(INF)
  const c = core(v)
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const x = (i + 0.5) * cell
      const y = (j + 0.5) * cell
      // the page's edge is an obstacle, and so is every mark's box
      let d = Math.min(x - margin, y - margin, PAGE - margin - x, PAGE - margin - y)
      for (const k of v.marks) {
        const b = boxOf(k)
        const dx = Math.max(b.x0 - x, 0, x - b.x1)
        const dy = Math.max(b.y0 - y, 0, y - b.y1)
        d = Math.min(d, Math.hypot(dx, dy))
      }
      dist[j * N + i] = Math.max(0, d)
    }
  const out: { x: number; y: number; r: number; d: number }[] = []
  for (let j = 1; j < N - 1; j++)
    for (let i = 1; i < N - 1; i++) {
      const r = dist[j * N + i]
      if (r < cell * 1.5) continue
      let top = true
      for (const [di, dj] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) if (dist[(j + dj) * N + i + di] > r) top = false
      if (!top) continue
      const x = (i + 0.5) * cell
      const y = (j + 0.5) * cell
      out.push({ x, y, r, d: Math.hypot(x - c.x, y - c.y) })
    }
  return out
}

/** how many times the structure was measured: a repetition's occurrences, a form's readings */
function times(v: PageView, s: Strand, ks: Mark[]): number {
  if (s.kind === 'repeat') {
    const f = v.m.primary.focus
    if (f.kind === 'repetition') return f.occurrences.length
    const unit = s.chars.join('')
    for (const r of v.a.relations) {
      if (r.kind === 'reduplication' && r.value === unit) return r.occurrences.length
      if (r.kind === 'recurrence' && r.unit === 'grapheme' && r.value === unit) return r.members.length
    }
    return 1
  }
  if (s.kind === 'form') {
    const graphemes = [...new Set(ks.map((k) => k.grapheme).filter((g): g is number => g !== undefined))]
    const read = graphemes.flatMap((g) => partsRead(v, g)).filter((p) => p.char === s.chars[0]).length
    return Math.max(1, read)
  }
  return 1
}

interface Cluster {
  strand: Strand
  chars: string[]
  from: (number | undefined)[]
}

function clusters(v: PageView): Cluster[] {
  const c = core(v)
  if (!c.ks.length) return []
  const strands = strandsOf(v, c.ks)
  if (strands.length < 2) return []
  return strands.map((s) => {
    if (s.layer !== 'structure') return { strand: s, chars: s.chars, from: s.from }
    const n = times(v, s, c.ks)
    return {
      strand: s,
      chars: Array.from({ length: n }, () => s.chars).flat(),
      from: Array.from({ length: n }, () => s.from).flat(),
    }
  })
}

export const constellation: MarkGrammar = {
  id: 'constellation',
  title: '星座',
  rules: [
    '紙面が持つ材料の種類ごとに一つの群：構造（題の反復、字の中に読まれた形、題の残り）、音（読みの母音）、レビュー時のみ語彙（題の字に語彙資源が関係づける字）。二種類以上あるときだけ',
    '題そのものが持つ材料（構造・音）の群は、その字で読みの順に書き継いだ粒の小さな円盤で、面積は測られた字数に比例する：語の列ではなく塊（題への注釈・ルビに見えないように）。外から来た語彙は、環の上のわずかな字だけ。群は書かれた題のまわりに、その種類が書かれたものから離れている距離に立つ：構造は近く、音はその先、語彙は最も遠く',
    '群は紙面自身の白（書かれたものが残す最大の空いた円）に立つ：書かれたものに近い白から順に、構造、音、語彙。どの群も先の群から離れる。白が群の面積より小さければ、白の大きさまで',
    '群の量は測られたもの：反復は題が繰り返す回数、形はその字の中に読まれた回数、題の残りと母音は一字ずつ。語彙は一度ずつ、三字まで',
    '一字分の面積、群どうしの間隔、各群の粒の大きさは造形。順序と、どの白に立つか（近い順）は造形ではない',
  ],

  offer(v) {
    const cs = clusters(v)
    if (cs.length < 2) return null
    return {
      grounds: cs.map((c) => `${{ structure: '構造', sound: '音', meaning: '語彙' }[c.strand.layer]}の群：${c.strand.note}`),
      uses: cs.map((c) => ({ property: c.strand.layer, value: c.chars.join('') })),
    }
  },

  apply(v, rng) {
    const cs = clusters(v)
    if (cs.length < 2) return v.marks
    const c = core(v)
    const vertical = v.a.direction === 'vertical'
    const start = vertical ? -Math.PI / 2 : Math.PI
    const margin = PAGE * 0.03
    const holes = whiteOf(v, margin)
    // one share of area per character measured, the same for every cluster (plastic within bounds)
    const unit = within(rng, 0.11, 0.13) * PAGE
    const gap = within(rng, 0.035, 0.05) * PAGE
    const added: Mark[] = []
    const set: { x: number; y: number; r: number; d: number }[] = []
    for (const cl of cs) {
      const layer = cl.strand.layer
      const disc = layer !== 'meaning'
      const n = cl.chars.length
      const s = disc ? roleSize('grain', layer === 'structure' ? 1 : 0.5, PAGE) : roleSize('auxiliary', within(rng, 0.5, 1), PAGE)
      const want = disc ? Math.max(s * 1.2, unit * Math.sqrt(n / Math.PI)) : n <= 1 ? s : Math.max(s * 1.1, (s * 1.9 * n) / (2 * Math.PI)) + s
      // the page's white, nearest the writing first; each kind further than the one before it
      const further = set.length ? set[set.length - 1].d : 0
      const hole = holes
        .filter((h) => h.d > further && h.r >= Math.min(want, disc ? s * 2.2 : want) && set.every((o) => Math.hypot(o.x - h.x, o.y - h.y) >= o.r + Math.min(h.r, want) + gap))
        .sort((p, q) => p.d - q.d)[0]
      if (!hole) {
        if (disc) return v.marks
        continue
      }
      const R = Math.min(want, hole.r)
      let pts: { x: number; y: number }[]
      if (disc) {
        // a hexagonal lattice cut by the disc
        const step = s * 1.14
        pts = []
        const m = Math.ceil(R / step) + 1
        for (let j = -m; j <= m; j++)
          for (let i = -m; i <= m; i++) {
            const u = (i + (j % 2 ? 0.5 : 0)) * step
            const w = j * step * 0.87
            if (Math.hypot(u, w) > R - s * 0.5) continue
            pts.push(vertical ? { x: hole.x - w, y: hole.y + u } : { x: hole.x + u, y: hole.y + w })
          }
      } else {
        const ring = n <= 1 ? 0 : R - s
        pts = cl.chars.map((_, i) => {
          const t = start + (i / Math.max(1, n)) * 2 * Math.PI
          return { x: hole.x + Math.cos(t) * ring, y: hole.y + Math.sin(t) * ring }
        })
      }
      let k = 0
      for (const p of pts) {
        if (p.x < margin || p.y < margin || p.x > PAGE - margin || p.y > PAGE - margin) continue
        if (!free(v, v.marks, added, p.x, p.y, disc ? s : s * 1.1)) continue
        added.push({
          char: cl.chars[k % n],
          x: p.x,
          y: p.y,
          size: disc ? s * 0.94 : s,
          role: disc ? 'grain' : 'auxiliary',
          derived: derive(
            'constellation',
            cl.strand.kind,
            `${{ structure: '構造', sound: '音', meaning: '語彙' }[layer]}の群：${cl.strand.note}`,
            cl.from[k % n],
            cl.strand.source?.[k % n],
          ),
        })
        k++
      }
      // a cluster of the title's own material holds at least one share of what it measured
      if (disc && k < n) return v.marks
      set.push({ x: hole.x, y: hole.y, r: R, d: hole.d })
    }
    // one cluster alone is a satellite, not a constellation
    if (set.length < 2) return v.marks
    void c
    return [...v.marks, ...added]
  },
}
