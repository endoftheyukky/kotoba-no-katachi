/**
 * What a page may never break: the structure that holds the title on it.
 * Checked for every page of the public title sets (tools/verify/fixture.mjs):
 *
 *   lost        every character of the title stays on the page: written by a
 *               mark of which at least half is on the page, stood for by a
 *               form of small marks, or written as space by the poem
 *   order       characters the title writes once keep their reading order
 *               along the writing direction. A repetition page is exempt, and
 *               so is a figure that is read along itself: where the page is a
 *               curve that closes, the order is the curve's own, and the
 *               writing direction says nothing about it.
 *   overlap     no two of the title's own marks of comparable size cover each
 *               other by more than a quarter
 *   inkHit      derived marks do not stand on the title's own ink
 *   crowd       derived marks do not cover each other
 *   finite      every coordinate is a number
 */
import { EM } from '../glyph/font'
import { PAGE } from '../render/stage'
import type { Analysis, Mark } from './types'

export interface Soundness {
  lost: number
  disordered: number
  overlaps: number
  inkHits: number
  crowded: number
  infinite: number
}

const box = (k: Mark, f = 0.9) => {
  const s = (k.size / 2) * f * (k.rotate ? 1.2 : 1)
  return { x0: k.x - s, y0: k.y - s, x1: k.x + s, y1: k.y + s }
}

function covers(k: Mark, q: Mark, f: number, share: number): boolean {
  const p = box(k, f)
  const r = box(q, f)
  const w = Math.min(p.x1, r.x1) - Math.max(p.x0, r.x0)
  const h = Math.min(p.y1, r.y1) - Math.max(p.y0, r.y0)
  return w > 0 && h > 0 && w * h > share * Math.min((p.x1 - p.x0) * (p.y1 - p.y0), (r.x1 - r.x0) * (r.y1 - r.y0))
}

function inkAt(a: Analysis, k: Mark, x0: number, y0: number): boolean {
  const s = k.size / EM
  const t = (-(k.rotate ?? 0) * Math.PI) / 180
  const dx = x0 - k.x
  const dy = y0 - k.y
  let x = (dx * Math.cos(t) - dy * Math.sin(t)) / s
  let y = (dx * Math.sin(t) + dy * Math.cos(t)) / s
  if (k.shift) {
    x -= k.shift.x
    y -= k.shift.y
  }
  if (k.keep?.length && !k.keep.some((r) => x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h)) return false
  let ink
  try {
    ink = a.glyphs.get(k.char, k.face ?? 'sans').metrics.ink
  } catch {
    return false
  }
  const i = Math.floor((x - ink.left) / ink.px)
  const j = Math.floor((y - ink.top) / ink.px)
  return i >= 0 && j >= 0 && i < ink.w && j < ink.h && ink.data[j * ink.w + i] > 96
}

const visible = (k: Mark) => {
  const h = k.size / 2
  const w = Math.max(0, Math.min(PAGE, k.x + h) - Math.max(0, k.x - h))
  const v = Math.max(0, Math.min(PAGE, k.y + h) - Math.max(0, k.y - h))
  return (w * v) / (k.size * k.size || 1)
}

/**
 * `repetition`: the page is a repetition page (proliferation), exempt from
 * the order check as in the audits. `absent`: graphemes the poem writes as space.
 */
export function soundness(
  a: Analysis,
  marks: Mark[],
  o: {
    repetition: boolean
    absent: number[]
    alongCurve?: boolean
    /**
     * Characters an act sent away from the others (parametric/acts.ts,
     * withdraw): they have left the reading on purpose, so the order of the
     * reading is checked without them. Named, not ignored: the act is recorded.
     */
    left?: number[]
  },
): Soundness {
  const own = marks.filter((k) => !k.derived)
  const derived = marks.filter((k) => k.derived)
  const title = a.graphemes.filter((g) => g.char.trim())
  const absent = new Set(o.absent)
  const represented = new Set(derived.map((k) => k.represents).filter((v) => v !== undefined))
  const onPage = own.filter((k) => visible(k) >= 0.5 || k.keep?.length)
  const written = new Set(onPage.map((k) => k.grapheme).filter((g) => g !== undefined))
  const pool = onPage.filter((k) => k.grapheme === undefined).map((k) => k.char)
  let lost = 0
  for (const g of title) {
    if (written.has(g.index) || represented.has(g.index) || absent.has(g.index)) continue
    const i = pool.indexOf(g.char)
    if (i >= 0) pool.splice(i, 1)
    else lost++
  }
  const along = (k: Mark) => (a.direction === 'vertical' ? k.y : k.x)
  const gone = new Set(o.left ?? [])
  const once = title.filter((g) => !gone.has(g.index) && title.filter((h) => h.char === g.char).length === 1)
  const seen = once.flatMap((g) => {
    const hits = own.filter((k) => k.char === g.char)
    return hits.length === 1 ? [{ at: along(hits[0]), size: hits[0].size }] : []
  })
  let disordered = 0
  if (!o.repetition && !o.alongCurve)
    for (let i = 1; i < seen.length; i++) if (seen[i].at < seen[i - 1].at - Math.max(seen[i].size, seen[i - 1].size) * 0.75) disordered++
  let overlaps = 0
  const plain = own.filter((k) => !k.minus && !k.keep)
  for (let i = 0; i < plain.length; i++)
    for (let j = i + 1; j < plain.length; j++) {
      if (Math.max(plain[i].size, plain[j].size) > 3 * Math.min(plain[i].size, plain[j].size)) continue
      if (covers(plain[i], plain[j], 0.9, 0.25)) overlaps++
    }
  let inkHits = 0
  for (const d of derived) {
    const pts = [[0, 0], [0.3, 0.3], [-0.3, 0.3], [0.3, -0.3], [-0.3, -0.3]].map(([u, v]) => [d.x + u * d.size, d.y + v * d.size])
    if (own.some((k) => Math.abs(k.x - d.x) < k.size && Math.abs(k.y - d.y) < k.size && pts.some(([x, y]) => inkAt(a, k, x, y)))) inkHits++
  }
  // derived against derived, on a grid so that a page of a thousand grains stays quick
  let crowded = 0
  const cell = 60
  const grid = new Map<string, number[]>()
  derived.forEach((k, i) => {
    const key = `${Math.floor(k.x / cell)},${Math.floor(k.y / cell)}`
    grid.set(key, [...(grid.get(key) ?? []), i])
  })
  derived.forEach((k, i) => {
    const gx = Math.floor(k.x / cell)
    const gy = Math.floor(k.y / cell)
    const r = Math.ceil(k.size / cell) + 1
    for (let u = -r; u <= r; u++)
      for (let v = -r; v <= r; v++)
        for (const j of grid.get(`${gx + u},${gy + v}`) ?? []) if (j > i && covers(k, derived[j], 0.8, 0.3)) crowded++
  })
  const infinite = marks.filter((k) => ![k.x, k.y, k.size, k.rotate ?? 0].every(Number.isFinite)).length
  return { lost, disordered, overlaps, inkHits, crowded, infinite }
}
