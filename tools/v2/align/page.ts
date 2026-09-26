// Build time only (tools/v2/align.mjs, through tools/v2/align/render.mjs): the page that measures glyphs
// for align-1. It registers the bundled faces exactly as the site does (src/glyph/font-face.ts) and measures
// with v1's own code, unchanged (GlyphLibrary.prepare → glyph/metrics measure), so a raster here is the
// raster the site reads. A character the reading face does not declare (v1 glyph/coverage) is not measured:
// it would be drawn in whatever font the system falls back to.
import '../../../src/glyph/font-face'
import { covers } from '../../../src/glyph/coverage'
import { FACES } from '../../../src/glyph/font'
import { GlyphLibrary } from '../../../src/glyph/source'

export interface Measured {
  c: string
  covered: boolean
  pen?: { x: number; y: number }
  half?: { w: number; h: number }
  /** the ink raster of v1 measure, one bit per pixel (alpha > 127, v1's ink), row-major, base64 */
  ink?: { w: number; h: number; left: number; top: number; px: number; bits: string }
}

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
    return { c, covered: true, pen: m.pen, half: m.half, ink: { w: m.ink.w, h: m.ink.h, left: m.ink.left, top: m.ink.top, px: m.ink.px, bits: pack(m.ink.data) } }
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
