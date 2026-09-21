/**
 * The page as a mark grammar sees it (v2).
 *
 * A spatial composition hands over its marks and, where it lays the title in
 * a line, its seats. What a grammar needs on top of that is the page's
 * hierarchy: which marks are the title written, which are the rest of it
 * beside a figure, which one the page is organised around, and in what order
 * the title's own marks are read. None of this changes a mark; it is read off
 * what the composition already did.
 */
import { EM, type Face } from '../../glyph/font'
import { REMOVAL_MARGIN } from '../../glyph/relation'
import type { Analysis, Mark, Material, Placed, Realization, Vec } from '../types'
import { faceOf } from '../face'
import { distances, edgeDistance } from './ink'

export interface PageView {
  a: Analysis
  m: Material
  spatial: Realization
  /** every mark as placed, with its role */
  marks: Mark[]
  /** the title's own marks that are not context, in reading order */
  body: Mark[]
  context: Mark[]
  /** the marks the page is organised around: the largest of the body, when they stand out */
  nucleus: Mark[]
  seats: NonNullable<Placed['seats']>
  /** review only: whether material may be taken from the lexicon (grammar/material.ts) */
  semantic: boolean
  /** review only: a way of a grammar asked for by name, instead of the one its rule chooses */
  variant?: string
}

/** what a review may ask of a grammar, beyond naming it */
export interface Asked {
  semantic?: boolean
  variant?: string
}

const median = (v: number[]) => [...v].sort((x, y) => x - y)[Math.floor(v.length / 2)] ?? 0

export function viewOf(a: Analysis, m: Material, spatial: Realization, placed: Placed, asked: Asked = {}): PageView {
  const marks = placed.marks
  const context = marks.filter((k) => k.context)
  const body = marks
    .map((k, i) => ({ k, i }))
    .filter(({ k }) => !k.context)
    .sort((x, y) => (x.k.grapheme ?? 1e9 + x.i) - (y.k.grapheme ?? 1e9 + y.i) || x.i - y.i)
    .map(({ k }) => k)
  // the nucleus: the body marks of the largest size, if that size clearly
  // stands above the rest; a page of equals has none
  const largest = Math.max(0, ...body.map((k) => k.size))
  const rest = body.filter((k) => k.size < largest * 0.98).map((k) => k.size)
  const stands = body.length === 1 || rest.length === 0 ? body.length <= 3 : largest >= 1.5 * median(rest)
  const nucleus = stands ? body.filter((k) => k.size >= largest * 0.98) : []
  const roled = marks.map((k) => ({ ...k, role: k.context ? ('context' as const) : nucleus.includes(k) ? ('nucleus' as const) : ('body' as const) }))
  const byOld = new Map(marks.map((k, i) => [k, roled[i]]))
  return {
    a,
    m,
    spatial,
    marks: roled,
    body: body.map((k) => byOld.get(k)!),
    context: context.map((k) => byOld.get(k)!),
    nucleus: nucleus.map((k) => byOld.get(k)!),
    seats: placed.seats ?? [],
    semantic: !!asked.semantic,
    ...(asked.variant ? { variant: asked.variant } : {}),
  }
}

/** a point of the page in a mark's own em space (ink centre = origin) */
export function toEm(k: Mark, p: Vec): Vec {
  const s = k.size / EM
  const t = (-(k.rotate ?? 0) * Math.PI) / 180
  const dx = p.x - k.x
  const dy = p.y - k.y
  let x = (dx * Math.cos(t) - dy * Math.sin(t)) / s
  let y = (dx * Math.sin(t) + dy * Math.cos(t)) / s
  if (k.shift) {
    x -= k.shift.x
    y -= k.shift.y
  }
  return { x, y }
}

/** a page point in a mark's em space, back to the page */
export function fromEm(k: Mark, e: Vec): Vec {
  const s = k.size / EM
  const x0 = (e.x + (k.shift?.x ?? 0)) * s
  const y0 = (e.y + (k.shift?.y ?? 0)) * s
  const t = ((k.rotate ?? 0) * Math.PI) / 180
  return { x: k.x + x0 * Math.cos(t) - y0 * Math.sin(t), y: k.y + x0 * Math.sin(t) + y0 * Math.cos(t) }
}

/**
 * Whether a mark has ink at a point of the page: its glyph's own ink, inside
 * what it keeps, outside what was taken from it. Measured in the face the
 * mark will be written in.
 */
export function inkAt(v: PageView, k: Mark, p: Vec, as?: Face): boolean {
  const e = toEm(k, p)
  if (k.keep?.length && !k.keep.some((r) => e.x >= r.x && e.y >= r.y && e.x <= r.x + r.w && e.y <= r.y + r.h)) return false
  const face = as ?? faceOf(v.a, v.m, k)
  let metrics
  try {
    metrics = v.a.glyphs.get(k.char, face).metrics
  } catch {
    metrics = v.a.glyphs.get(k.char).metrics
  }
  if (!rasterHas(metrics.ink, e)) return false
  if (k.minus) {
    let other
    try {
      other = v.a.glyphs.get(k.minus.char).metrics
    } catch {
      return true
    }
    // the removed glyph, widened by the same margin the drawing removes
    const q = { x: (e.x - k.minus.dx) / k.minus.scale, y: (e.y - k.minus.dy) / k.minus.scale }
    const r = REMOVAL_MARGIN
    for (const [ox, oy] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) if (rasterHas(other.ink, { x: q.x + ox, y: q.y + oy })) return false
  }
  return true
}

/**
 * Whether any of a mark's ink lies within `r` of a page point: measured on the
 * glyph's distance field, so a hairline between two sample points is not
 * missed. A part or a residue (what is kept or left of a glyph) is sampled.
 */
export function inkNear(v: PageView, k: Mark, p: Vec, r: number): boolean {
  if (k.keep?.length || k.minus) {
    for (const u of [-1, -0.5, 0, 0.5, 1])
      for (const w of [-1, -0.5, 0, 0.5, 1]) if (u * u + w * w <= 1.01 && inkAt(v, k, { x: p.x + u * r, y: p.y + w * r })) return true
    return false
  }
  const face = faceOf(v.a, v.m, k)
  let ink
  try {
    ink = v.a.glyphs.get(k.char, face).metrics.ink
  } catch {
    ink = v.a.glyphs.get(k.char).metrics.ink
  }
  return (edgeDistance(distances(ink), toEm(k, p)) * k.size) / EM < r
}

/**
 * Whether a point of the page lies on the ink of the glyph a subtraction took
 * out of this mark: the removed form itself, where it was, whole.
 */
export function removedAt(v: PageView, k: Mark, p: Vec): boolean {
  if (!k.minus) return false
  let other
  try {
    other = v.a.glyphs.get(k.minus.char).metrics
  } catch {
    return false
  }
  const e = toEm(k, p)
  return rasterHas(other.ink, { x: (e.x - k.minus.dx) / k.minus.scale, y: (e.y - k.minus.dy) / k.minus.scale })
}

function rasterHas(ink: { w: number; h: number; data: Uint8Array; left: number; top: number; px: number }, e: Vec): boolean {
  const i = Math.floor((e.x - ink.left) / ink.px)
  const j = Math.floor((e.y - ink.top) / ink.px)
  return i >= 0 && j >= 0 && i < ink.w && j < ink.h && ink.data[j * ink.w + i] > 96
}

/** the page box a mark covers: its em square, or what it keeps of it */
export function boxOf(k: Mark): { x0: number; y0: number; x1: number; y1: number } {
  if (!k.keep?.length) {
    const h = (k.size / 2) * (k.rotate ? Math.SQRT2 : 1)
    return { x0: k.x - h, y0: k.y - h, x1: k.x + h, y1: k.y + h }
  }
  const pts = k.keep.flatMap((r) => [
    fromEm(k, { x: r.x, y: r.y }),
    fromEm(k, { x: r.x + r.w, y: r.y }),
    fromEm(k, { x: r.x, y: r.y + r.h }),
    fromEm(k, { x: r.x + r.w, y: r.y + r.h }),
  ])
  return {
    x0: Math.min(...pts.map((p) => p.x)),
    y0: Math.min(...pts.map((p) => p.y)),
    x1: Math.max(...pts.map((p) => p.x)),
    y1: Math.max(...pts.map((p) => p.y)),
  }
}
