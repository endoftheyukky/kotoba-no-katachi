/**
 * Glyph relations: the computer's reading of two letterforms of the fixed
 * font laid over each other. "川 lies in 州" here means: drawn in this font,
 * most of 川's ink falls on 州's ink after a small shift and scale.
 * It is a reading of shapes, not a fact about the characters.
 */
import type { Rect } from '../render/stage'
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
  /** what is left of the outer glyph once the inner glyph is removed (em space of the outer) */
  residue: {
    share: number
    box: Rect
    centroid: { x: number; y: number }
    /** share of the residue held by its largest connected piece: a coherent form (a dot) is high, scattered slivers low */
    coherence: number
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

function grid(m: GlyphMetrics): Uint8Array {
  const g = new Uint8Array(N * N)
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) g[j * N + i] = sample(m, -R + (i + 0.5) * CELL, -R + (j + 0.5) * CELL) ? 1 : 0
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

/** cells in the largest 8-connected piece of a grid */
function largestPiece(g: Uint8Array): number {
  const seen = new Uint8Array(N * N)
  let best = 0
  for (let k = 0; k < N * N; k++) {
    if (!g[k] || seen[k]) continue
    let size = 0
    const stack = [k]
    seen[k] = 1
    while (stack.length) {
      const q = stack.pop()!
      size++
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
    best = Math.max(best, size)
  }
  return best
}

export function relate(
  innerChar: string,
  inner: GlyphMetrics,
  outerChar: string,
  outer: GlyphMetrics,
): Omit<GlyphRelation, 'kind' | 'score'> {
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
  let left = 0
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, sx = 0, sy = 0
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const k = j * N + i
      if (!outerGrid[k]) continue
      total++
      if (removed[k]) continue
      rest[k] = 1
      left++
      const x = -R + (i + 0.5) * CELL
      const y = -R + (j + 0.5) * CELL
      sx += x
      sy += y
      x0 = Math.min(x0, x - CELL / 2)
      y0 = Math.min(y0, y - CELL / 2)
      x1 = Math.max(x1, x + CELL / 2)
      y1 = Math.max(y1, y + CELL / 2)
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
      box: left ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : { x: 0, y: 0, w: 0, h: 0 },
      centroid: left ? { x: sx / left, y: sy / left } : { x: 0, y: 0 },
      coherence: left ? largestPiece(rest) / left : 0,
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
  const out: GlyphRelation[] = []
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
  return out.sort((x, y) => y.score - x.score)
}
