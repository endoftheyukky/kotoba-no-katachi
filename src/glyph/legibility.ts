/**
 * Can a part of a glyph be read as a character in its own right?
 *
 * Another reading the computer makes of the fixed font: the part's ink is
 * compared, box to box, with whole glyphs of the same font — a small set of
 * common components and simple characters, and the other characters of the
 * title. 森 comes apart into three islands that read as 木; 嘘 gives up a
 * 口. A single stroke (一 丨 丿 丶) is a trace of writing rather than a
 * character, and is read as such.
 */
import type { Rect } from '../render/stage'
import type { GlyphMetrics } from './metrics'
import type { GlyphPart } from './parts'

/** characters a part may be read as (drawn in the fixed font; not a dictionary of radicals) */
export const COMPONENTS = Array.from(
  '木口日月目田人亻大小山川土士工王子女力刀又寸十八心火水氵米糸言金門立石耳貝車虫竹示禾犬牛手扌艹宀穴广辶冖夕止皿巾己弓欠斤方文白夫井中上下',
)
/** single strokes: marks of writing, not characters */
export const STROKES = Array.from('一丨丿丶乙')

export interface PartReading {
  char: string
  kind: 'character' | 'stroke'
  score: number
}

const G = 32
/** a part is read as a glyph when both overlap each other this much (with one cell of tolerance) */
const READ = 0.85
/** a "part" holding nearly all the ink is the glyph itself, not a part of it */
const WHOLE = 0.85
/** and their boxes are not much more different in shape than this */
const ASPECT = Math.log(1.6)

interface Shape {
  mask: Uint8Array
  aspect: number
}

/** the ink inside the given regions (or all of it), scaled onto a G × G grid keeping its proportions */
function shapeOf(m: GlyphMetrics, keep?: Rect[]): Shape | null {
  const { w, h, data, left, top, px } = m.ink
  if (!w || !h) return null
  let bx0 = 0, by0 = 0, bx1 = w, by1 = h
  if (keep) {
    const ex0 = Math.min(...keep.map((r) => r.x))
    const ey0 = Math.min(...keep.map((r) => r.y))
    const ex1 = Math.max(...keep.map((r) => r.x + r.w))
    const ey1 = Math.max(...keep.map((r) => r.y + r.h))
    bx0 = Math.max(0, Math.floor((ex0 - left) / px))
    by0 = Math.max(0, Math.floor((ey0 - top) / px))
    bx1 = Math.min(w, Math.ceil((ex1 - left) / px))
    by1 = Math.min(h, Math.ceil((ey1 - top) / px))
  }
  const inside = (i: number, j: number) => {
    if (!keep) return true
    const x = left + (i + 0.5) * px
    const y = top + (j + 0.5) * px
    return keep.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)
  }
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1
  const pts: number[] = []
  for (let j = by0; j < by1; j++)
    for (let i = bx0; i < bx1; i++)
      if (data[j * w + i] > 127 && inside(i, j)) {
        pts.push(i, j)
        x0 = Math.min(x0, i)
        y0 = Math.min(y0, j)
        x1 = Math.max(x1, i)
        y1 = Math.max(y1, j)
      }
  if (x1 < 0) return null
  const bw = x1 - x0 + 1
  const bh = y1 - y0 + 1
  const side = Math.max(bw, bh)
  const ox = (side - bw) / 2
  const oy = (side - bh) / 2
  const mask = new Uint8Array(G * G)
  for (let k = 0; k < pts.length; k += 2) {
    const gi = Math.min(G - 1, Math.floor(((pts[k] - x0 + ox) / side) * G))
    const gj = Math.min(G - 1, Math.floor(((pts[k + 1] - y0 + oy) / side) * G))
    mask[gj * G + gi] = 1
  }
  return { mask, aspect: Math.log(bw / bh) }
}

function dilate(g: Uint8Array): Uint8Array {
  const out = new Uint8Array(G * G)
  for (let j = 0; j < G; j++)
    for (let i = 0; i < G; i++) {
      let v = 0
      for (let dj = -1; dj <= 1 && !v; dj++)
        for (let di = -1; di <= 1 && !v; di++) {
          const x = i + di
          const y = j + dj
          if (x >= 0 && y >= 0 && x < G && y < G && g[y * G + x]) v = 1
        }
      out[j * G + i] = v
    }
  return out
}

/** the smaller of the two overlaps: how much of each lies on the other */
function overlap(a: Uint8Array, b: Uint8Array): number {
  const da = dilate(a)
  const db = dilate(b)
  let na = 0, nb = 0, ab = 0, ba = 0
  for (let k = 0; k < G * G; k++) {
    if (a[k]) {
      na++
      if (db[k]) ab++
    }
    if (b[k]) {
      nb++
      if (da[k]) ba++
    }
  }
  return na && nb ? Math.min(ab / na, ba / nb) : 0
}

const shapes = new WeakMap<GlyphMetrics, Shape | null>()
function wholeShape(m: GlyphMetrics): Shape | null {
  if (!shapes.has(m)) shapes.set(m, shapeOf(m))
  return shapes.get(m)!
}

/**
 * Read a part of `glyph` against the candidate glyphs (never against the
 * glyph it comes from). Returns the best reading, or null if it reads as none.
 */
export function readPart(
  part: GlyphPart,
  glyph: GlyphMetrics,
  candidates: ReadonlyMap<string, GlyphMetrics>,
  self: string,
): PartReading | null {
  if (part.share >= WHOLE) return null
  const shape = shapeOf(glyph, part.keep)
  if (!shape) return null
  let best: PartReading | null = null
  for (const [char, m] of candidates) {
    if (char === self) continue
    const other = wholeShape(m)
    if (!other || Math.abs(other.aspect - shape.aspect) > ASPECT) continue
    const score = overlap(shape.mask, other.mask)
    if (score >= READ && (!best || score > best.score))
      best = { char, kind: STROKES.includes(char) ? 'stroke' : 'character', score }
  }
  return best
}
