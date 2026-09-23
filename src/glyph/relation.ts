/**
 * Glyph relations: the computer's reading of two letterforms of the fixed
 * font laid over each other. "川 lies in 州" here means: drawn in this font,
 * most of 川's ink falls on 州's ink after a small shift and scale.
 * It is a reading of shapes, not a fact about the characters.
 */
import type { Rect } from '../render/stage'
import { STROKES } from './legibility'
import type { GlyphMetrics } from './metrics'

/**
 * Kinds of glyph relation the computer can read.
 *   containment  one glyph's form lies inside another's (川 ⊂ 州)
 *   similarity   two glyphs are nearly the same form (人 ≈ 入)
 * Designed to grow: sharedShape (a part in common), difference, …
 */
export type GlyphRelationKind = 'containment' | 'similarity'

/** below this, a relation is not read */
export const RELATION_THRESHOLD = 0.65
/** a similarity leaves little of either glyph when the other is removed */
const SIMILAR_RESIDUE = 0.15

export interface GlyphRelation {
  kind: GlyphRelationKind
  /**
   * title: both glyphs are written in the title.
   * inventory: the inner glyph is not in the title — the computer found it
   * inside one of the title's characters, among the components it can read.
   * decomposition: the inner glyph is what the outer one itself decomposes
   * into (ぜ = せ + ゛): intrinsic to the character, not fetched from outside.
   */
  origin: 'title' | 'inventory' | 'decomposition'
  /** containment: the glyph inside. similarity: the first of the pair */
  inner: string
  /** containment: the glyph that holds it. similarity: the second of the pair */
  outer: string
  /** strength of the reading, 0–1 (containment beyond chance; for similarity, the weaker direction) */
  score: number
  /**
   * How far the inner glyph's ink lies on the outer's beyond chance:
   * (overlap − density of the outer under the inner) ÷ (1 − that density).
   * 1 = every stroke of the inner lies on a stroke of the outer; 0 = no better
   * than scattering the inner's ink over the outer at random.
   */
  containment: number
  /** plain share of the inner glyph's ink that falls on the outer's ink */
  overlap: number
  /** placement of the inner glyph in the outer glyph's em space: p = q·scale + (dx, dy) */
  dx: number
  dy: number
  scale: number
  /**
   * What is left of the outer glyph once the inner glyph is removed (em space
   * of the outer). Only pieces with a form of their own count; slivers left by
   * a slight misfit between the two letterforms are not part of the residue.
   */
  residue: {
    /** share of the outer glyph's ink that is left, in pieces */
    share: number
    /** the pieces, as rectangles to keep (em space) */
    pieces: Rect[]
    box: Rect
    centroid: { x: number; y: number }
    /** share of everything left that lies in pieces rather than slivers */
    substance: number
  }
}

const N = 64
const R = 62 // em units covered on either side of the ink centre
const CELL = (2 * R) / N
/**
 * Removing a glyph also removes this much around it (em units): the same one
 * grid cell of tolerance the reading uses, so the drawn residue is the read one.
 */
export const REMOVAL_MARGIN = CELL

function sample(m: GlyphMetrics, x: number, y: number): boolean {
  const { w, h, data, left, top, px } = m.ink
  const i = Math.floor((x - left) / px)
  const j = Math.floor((y - top) / px)
  return i >= 0 && j >= 0 && i < w && j < h && data[j * w + i] > 127
}

const grids = new WeakMap<GlyphMetrics, Uint8Array>()
function grid(m: GlyphMetrics): Uint8Array {
  const had = grids.get(m)
  if (had) return had
  const g = new Uint8Array(N * N)
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) g[j * N + i] = sample(m, -R + (i + 0.5) * CELL, -R + (j + 0.5) * CELL) ? 1 : 0
  grids.set(m, g)
  return g
}

function dilate(g: Uint8Array): Uint8Array {
  const out = new Uint8Array(N * N)
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      let v = 0
      for (let dj = -1; dj <= 1 && !v; dj++)
        for (let di = -1; di <= 1 && !v; di++) {
          const x = i + di
          const y = j + dj
          if (x >= 0 && y >= 0 && x < N && y < N && g[y * N + x]) v = 1
        }
      out[j * N + i] = v
    }
  return out
}

/** the inner glyph transformed into the outer's em space, on the grid */
function placed(inner: GlyphMetrics, dx: number, dy: number, scale: number): Uint8Array {
  const g = new Uint8Array(N * N)
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const x = (-R + (i + 0.5) * CELL - dx) / scale
      const y = (-R + (j + 0.5) * CELL - dy) / scale
      g[j * N + i] = sample(inner, x, y) ? 1 : 0
    }
  return g
}

/** overlap of the inner on the outer, and how much of it chance alone would give */
function contained(inner: Uint8Array, outer: Uint8Array): { overlap: number; lift: number } {
  let a = 0
  let both = 0
  let i0 = N, j0 = N, i1 = -1, j1 = -1
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const k = j * N + i
      if (!inner[k]) continue
      a++
      if (outer[k]) both++
      if (i < i0) i0 = i
      if (i > i1) i1 = i
      if (j < j0) j0 = j
      if (j > j1) j1 = j
    }
  if (!a) return { overlap: 0, lift: 0 }
  let area = 0
  let dense = 0
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      area++
      if (outer[j * N + i]) dense++
    }
  const chance = dense / area
  const overlap = both / a
  return { overlap, lift: chance < 1 ? (overlap - chance) / (1 - chance) : 0 }
}

/** the 8-connected pieces of a grid, as lists of cells */
function pieces(g: Uint8Array): number[][] {
  const seen = new Uint8Array(N * N)
  const out: number[][] = []
  for (let k = 0; k < N * N; k++) {
    if (!g[k] || seen[k]) continue
    const cells: number[] = []
    const stack = [k]
    seen[k] = 1
    while (stack.length) {
      const q = stack.pop()!
      cells.push(q)
      const x = q % N
      const y = (q - x) / N
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          const n = ny * N + nx
          if (nx >= 0 && ny >= 0 && nx < N && ny < N && g[n] && !seen[n]) {
            seen[n] = 1
            stack.push(n)
          }
        }
    }
    out.push(cells)
  }
  return out
}

/** a piece of residue smaller than this share of the outer glyph is a sliver, not a form */
const SLIVER = 0.03

export function relate(
  innerChar: string,
  inner: GlyphMetrics,
  outerChar: string,
  outer: GlyphMetrics,
): Omit<GlyphRelation, 'kind' | 'score' | 'origin'> {
  const outerGrid = grid(outer)
  let best = { c: -Infinity, overlap: 0, dx: 0, dy: 0, scale: 1 }
  const tryAt = (dx: number, dy: number, scale: number) => {
    const { overlap, lift } = contained(placed(inner, dx, dy, scale), outerGrid)
    if (lift > best.c) best = { c: lift, overlap, dx, dy, scale }
  }
  for (const scale of [0.94, 1, 1.06]) for (let dx = -12; dx <= 12; dx += 4) for (let dy = -12; dy <= 12; dy += 4) tryAt(dx, dy, scale)
  const coarse = { ...best }
  for (const scale of [coarse.scale - 0.03, coarse.scale, coarse.scale + 0.03])
    for (let dx = coarse.dx - 3; dx <= coarse.dx + 3; dx += 1)
      for (let dy = coarse.dy - 3; dy <= coarse.dy + 3; dy += 1) tryAt(dx, dy, scale)

  // residue: the outer glyph without (a margin around) the inner glyph
  const removed = dilate(placed(inner, best.dx, best.dy, best.scale))
  const rest = new Uint8Array(N * N)
  let total = 0
  let everything = 0
  for (let k = 0; k < N * N; k++) {
    if (!outerGrid[k]) continue
    total++
    if (!removed[k]) {
      rest[k] = 1
      everything++
    }
  }
  // keep only the pieces with a form of their own
  const kept = pieces(rest).filter((c) => c.length >= Math.max(3, total * SLIVER))
  const keep: Rect[] = []
  let left = 0
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, sx = 0, sy = 0
  for (const cells of kept) {
    let px0 = Infinity, py0 = Infinity, px1 = -Infinity, py1 = -Infinity
    for (const k of cells) {
      const i = k % N
      const j = (k - i) / N
      const x = -R + (i + 0.5) * CELL
      const y = -R + (j + 0.5) * CELL
      left++
      sx += x
      sy += y
      px0 = Math.min(px0, x - CELL)
      py0 = Math.min(py0, y - CELL)
      px1 = Math.max(px1, x + CELL)
      py1 = Math.max(py1, y + CELL)
    }
    keep.push({ x: px0, y: py0, w: px1 - px0, h: py1 - py0 })
    x0 = Math.min(x0, px0)
    y0 = Math.min(y0, py0)
    x1 = Math.max(x1, px1)
    y1 = Math.max(y1, py1)
  }
  return {
    inner: innerChar,
    outer: outerChar,
    containment: Math.max(0, best.c),
    overlap: best.overlap,
    dx: best.dx,
    dy: best.dy,
    scale: best.scale,
    residue: {
      share: total ? left / total : 0,
      pieces: keep,
      box: left ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : { x: 0, y: 0, w: 0, h: 0 },
      centroid: left ? { x: sx / left, y: sy / left } : { x: 0, y: 0 },
      substance: everything ? left / everything : 0,
    },
  }
}

/**
 * All readable relations among the distinct glyphs of a title.
 * A glyph with much less ink than another is not tested for lying inside it
 * (anything small fits somewhere); nor is a glyph with more ink.
 * When each lies in the other and at most 15% is left either way, the two are
 * read as similar (人 ≈ 入, 大 ≈ 犬): the same form and a small difference.
 * When more is left (州 − 川 = 28%), the smaller lies in the larger.
 */
export function readRelations(glyphs: ReadonlyMap<string, GlyphMetrics>): GlyphRelation[] {
  const chars = [...glyphs.keys()].filter((c) => glyphs.get(c)!.density > 0)
  const out: Omit<GlyphRelation, 'origin'>[] = []
  const ratio = (a: string, b: string) => glyphs.get(a)!.density / glyphs.get(b)!.density
  // tested at all: the first has between 30% and 118% of the second's ink
  const tested = (a: string, b: string) => ratio(a, b) >= 0.3 && ratio(a, b) <= 1.18
  // read as lying inside: it has no more ink than the other (+5%)
  const inside = (a: string, b: string) => ratio(a, b) <= 1.05
  for (let i = 0; i < chars.length; i++)
    for (let j = i + 1; j < chars.length; j++) {
      const a = chars[i]
      const b = chars[j]
      const ab = tested(a, b) ? relate(a, glyphs.get(a)!, b, glyphs.get(b)!) : null
      const ba = tested(b, a) ? relate(b, glyphs.get(b)!, a, glyphs.get(a)!) : null
      if (
        ab && ba &&
        ab.containment >= RELATION_THRESHOLD && ba.containment >= RELATION_THRESHOLD &&
        ab.residue.share <= SIMILAR_RESIDUE && ba.residue.share <= SIMILAR_RESIDUE
      ) {
        out.push({ ...ab, kind: 'similarity', score: Math.min(ab.containment, ba.containment) })
        continue
      }
      if (ab && inside(a, b)) out.push({ ...ab, kind: 'containment', score: ab.containment })
      if (ba && inside(b, a)) out.push({ ...ba, kind: 'containment', score: ba.containment })
    }
  return out.map((r) => ({ ...r, origin: 'title' as const })).sort((x, y) => y.score - x.score)
}

// --- the title's characters against the components the computer can read ----
//
// A character of the title may hold a component that the title never writes
// (犬 holds 大). Such a reading is only worth having when it is unmistakable,
// so the conditions are stricter than for two characters of the same title —
// otherwise nearly every kanji would have one.

/** the inner glyph must lie on the outer's ink this much beyond chance */
const INVENTORY_THRESHOLD = 0.8
/** and take up at least this share of the outer's ink … */
const INVENTORY_MIN_INK = 0.3
/**
 * … leaving a remainder that is neither nothing nor almost everything.
 * Note: the overlay only moves a component by ±12 and scales it by ±9%, so a
 * component that appears shrunk inside a character (a 偏 or a 旁) is not
 * found. Only components that stand at nearly their own size are read.
 */
const INVENTORY_RESIDUE = [0.06, 0.8]
/** … made of forms rather than slivers, and few of them */
const INVENTORY_SUBSTANCE = 0.6
const INVENTORY_PIECES = 4

/** a few placements, to throw out the obvious misfits cheaply */
function coarseLift(inner: GlyphMetrics, outer: GlyphMetrics): number {
  const g = grid(outer)
  let best = 0
  for (let dx = -8; dx <= 8; dx += 8)
    for (let dy = -8; dy <= 8; dy += 8) best = Math.max(best, contained(placed(inner, dx, dy, 1), g).lift)
  return best
}

/**
 * A light, skeletal form (十 人 上 广) sits inside almost any character that
 * has a crossing or a sweep, so finding one there says nothing. Only a
 * component with a body of its own may be the inner glyph: measured on the
 * font alone, as ink per em square.
 */
const INVENTORY_MIN_DENSITY = 0.24

function worthReading(r: Omit<GlyphRelation, 'kind' | 'score' | 'origin'>): boolean {
  return (
    r.containment >= INVENTORY_THRESHOLD &&
    r.residue.share >= INVENTORY_RESIDUE[0] &&
    r.residue.share <= INVENTORY_RESIDUE[1] &&
    r.residue.substance >= INVENTORY_SUBSTANCE &&
    r.residue.pieces.length <= INVENTORY_PIECES
  )
}

/**
 * At most one reading per character of the title: the strongest component
 * found inside it. Single strokes and light skeletal forms are never the
 * inner glyph — finding one inside a character says nothing about it.
 */
export function readInventory(
  letters: ReadonlyMap<string, GlyphMetrics>,
  inventory: ReadonlyMap<string, GlyphMetrics>,
): GlyphRelation[] {
  const strokes = new Set(STROKES)
  const out: GlyphRelation[] = []
  for (const [outerChar, outer] of letters) {
    if (!outer.density) continue
    let best: GlyphRelation | null = null
    for (const [innerChar, inner] of inventory) {
      if (innerChar === outerChar || strokes.has(innerChar)) continue
      if (inner.density < INVENTORY_MIN_DENSITY) continue
      const ratio = inner.density / outer.density
      if (ratio < INVENTORY_MIN_INK || ratio > 1.05) continue
      if (coarseLift(inner, outer) < 0.35) continue
      const r = relate(innerChar, inner, outerChar, outer)
      if (!worthReading(r)) continue
      // the two are read as alike when each lies in the other and little is left
      let kind: GlyphRelationKind = 'containment'
      let score = r.containment
      if (ratio >= 0.85) {
        const back = relate(outerChar, outer, innerChar, inner)
        if (
          back.containment >= INVENTORY_THRESHOLD &&
          r.residue.share <= SIMILAR_RESIDUE &&
          back.residue.share <= SIMILAR_RESIDUE
        ) {
          kind = 'similarity'
          score = Math.min(r.containment, back.containment)
        }
      }
      if (!best || score > best.score) best = { ...r, kind, score, origin: 'inventory' }
    }
    if (best) out.push(best)
  }
  return out.sort((x, y) => y.score - x.score)
}
