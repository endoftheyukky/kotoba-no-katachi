// Build time only (tools/v2/align.mjs, through tools/v2/align/render.mjs): the page that measures glyphs
// for align-1. It registers the bundled faces exactly as the site does (src/glyph/font-face.ts) and measures
// with v1's own code, unchanged (GlyphLibrary.prepare → glyph/metrics measure), so a raster here is the
// raster the site reads. A character the reading face does not declare (v1 glyph/coverage) is not measured:
// it would be drawn in whatever font the system falls back to.
import '../../../src/glyph/font-face'
import { covers } from '../../../src/glyph/coverage'
import { FACES } from '../../../src/glyph/font'
import { islands } from '../../../src/glyph/parts'
import { GlyphLibrary } from '../../../src/glyph/source'

export interface Measured {
  c: string
  covered: boolean
  pen?: { x: number; y: number }
  half?: { w: number; h: number }
  /** the ink raster of v1 measure, one bit per pixel (alpha > 127, v1's ink), row-major, base64 */
  ink?: { w: number; h: number; left: number; top: number; px: number; bits: string }
  /** v1 glyph/parts islands (connected ink, ≥ 3% of it): box, share, centroid, and the island's own ink on a SHAPE × SHAPE grid over its box (hex) */
  islands?: { box: [number, number, number, number]; share: number; centroid: [number, number]; shape: string }[]
}

/** the grid an island's shape is compared on (the pre-v2 reading of alike islands) */
const SHAPE = 16

const lib = new GlyphLibrary()

function pack(data: Uint8Array): string {
  const bytes = new Uint8Array(Math.ceil(data.length / 8))
  for (let k = 0; k < data.length; k++) if (data[k] > 127) bytes[k >> 3] |= 128 >> (k & 7)
  let s = ''
  for (let k = 0; k < bytes.length; k++) s += String.fromCharCode(bytes[k])
  return btoa(s)
}

async function measure(chars: string[]): Promise<Measured[]> {
  const inFace = chars.filter((c) => covers('sans', c))
  await lib.prepare(inFace)
  return chars.map((c) => {
    if (!inFace.includes(c)) return { c, covered: false }
    const m = lib.get(c).metrics
    return { c, covered: true, pen: m.pen, half: m.half, ink: { w: m.ink.w, h: m.ink.h, left: m.ink.left, top: m.ink.top, px: m.ink.px, bits: pack(m.ink.data) }, islands: islandsOf(m) }
  })
}

/** v1's islands, each with its own ink sampled on a SHAPE × SHAPE grid over its box */
function islandsOf(m: ReturnType<GlyphLibrary['get']>['metrics']): NonNullable<Measured['islands']> {
  const { w, h, data, left, top, px } = m.ink
  const on = (a: number, b: number) => a >= 0 && b >= 0 && a < w && b < h && data[b * w + a] > 127
  return islands(m).map((p) => {
    const x0 = Math.min(...p.keep.map((r) => r.x))
    const y0 = Math.min(...p.keep.map((r) => r.y))
    const x1 = Math.max(...p.keep.map((r) => r.x + r.w))
    const y1 = Math.max(...p.keep.map((r) => r.y + r.h))
    const bits = new Uint8Array((SHAPE * SHAPE) / 8)
    for (let j = 0; j < SHAPE; j++)
      for (let i = 0; i < SHAPE; i++) {
        const x = x0 + ((i + 0.5) / SHAPE) * (x1 - x0)
        const y = y0 + ((j + 0.5) / SHAPE) * (y1 - y0)
        const kept = p.keep.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)
        if (kept && on(Math.floor((x - left) / px), Math.floor((y - top) / px))) bits[(j * SHAPE + i) >> 3] |= 128 >> ((j * SHAPE + i) & 7)
      }
    const shape = [...bits].map((b) => b.toString(16).padStart(2, '0')).join('')
    return { box: [x0, y0, x1, y1], share: p.share, centroid: [p.centroid.x, p.centroid.y], shape }
  })
}

/** the faces the page declares for the reading face, and the font files it actually fetched */
function faces() {
  const declared = [...document.fonts]
    .filter((f) => f.family.replace(/["']/g, '') === FACES.sans.name && String(f.weight) === String(FACES.sans.weight))
    .map((f) => ({ family: f.family, weight: f.weight, style: f.style, status: f.status }))
  const fetched = performance
    .getEntriesByType('resource')
    .map((e) => e.name)
    .filter((n) => /\.woff2?(\?|$)/.test(n))
    .map((n) => decodeURIComponent(new URL(n).pathname.split('/').pop()!))
    .sort()
  return { declared: declared.length, loaded: declared.filter((f) => f.status === 'loaded').length, fetched, dpr: devicePixelRatio }
}

Object.assign(window, { alignRender: { measure, faces } })
document.body.dataset.state = 'ready'
