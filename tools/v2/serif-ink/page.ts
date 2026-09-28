// Build time only (tools/v2/serif-ink.mjs, through tools/v2/serif-ink/render.mjs): the page that measures the
// writing face (Noto Serif JP 300) for serif-ink-1. It registers the bundled faces exactly as the site does
// (src/glyph/font-face.ts) and measures with v1's own measure, unchanged (src/glyph/metrics.ts measure, the
// function GlyphLibrary.prepare calls), so a raster here is the raster the site would read. A character the
// writing face does not declare (v1 glyph/coverage) is not measured: it would be drawn in a fallback font.
import '../../../src/glyph/font-face'
import { covers } from '../../../src/glyph/coverage'
import { FACES, fontOf, type Face } from '../../../src/glyph/font'
import { measure } from '../../../src/glyph/metrics'
import { EM } from '../../../src/glyph/font'

function pack(data: Uint8Array): string {
  const bytes = new Uint8Array(Math.ceil(data.length / 8))
  for (let k = 0; k < data.length; k++) if (data[k] > 127) bytes[k >> 3] |= 128 >> (k & 7)
  let s = ''
  for (let k = 0; k < bytes.length; k++) s += String.fromCharCode(bytes[k])
  return btoa(s)
}

/** load the face for these characters, as GlyphLibrary.prepare does, and refuse when it cannot */
async function load(chars: string[], face: Face) {
  const text = [...new Set(chars)].join('')
  if (!text) return
  const font = fontOf(face, EM)
  await document.fonts.load(font, text)
  if (!document.fonts.check(font, text)) throw new Error(`font ${FACES[face].name} could not be loaded for ${text}`)
}

/**
 * the glyphs the fit reads: v1 measure in the writing face, with its ink raster (tools/v2/align/page.ts's format).
 * The build measures the serif only; another face is measured here only for a diagnosis beside the build
 */
async function glyphs(chars: string[], face: Face = 'serif') {
  const inFace = chars.filter((c) => covers(face, c))
  await load(inFace, face)
  return chars.map((c) => {
    if (!inFace.includes(c)) return { c, covered: false }
    const m = measure(c, face)
    return { c, covered: true, pen: m.pen, half: m.half, density: m.density, ink: { w: m.ink.w, h: m.ink.h, left: m.ink.left, top: m.ink.top, px: m.ink.px, bits: pack(m.ink.data) } }
  })
}

/** v1 writable (poem/face.ts) for declared code points: the serif's ink, and the reading face's where the serif has none (in the order given) */
async function writing(chars: string[]) {
  await load(chars, 'serif')
  const serif = chars.map((c) => measure(c, 'serif').density > 0)
  const empty = chars.filter((_, i) => !serif[i])
  await load(empty.filter((c) => covers('sans', c)), 'sans')
  return chars.map((c, i) => (serif[i] ? { c, serif: 1 } : { c, serif: 0, sans: covers('sans', c) ? (measure(c, 'sans').density > 0 ? 1 : 0) : -1 }))
}

/** the faces the page declares, and the font files it actually fetched */
function faces() {
  const of = (face: Face) => [...document.fonts].filter((f) => f.family.replace(/["']/g, '') === FACES[face].name && String(f.weight) === String(FACES[face].weight))
  const fetched = performance
    .getEntriesByType('resource')
    .map((e) => e.name)
    .filter((n) => /\.woff2?(\?|$)/.test(n))
    .map((n) => decodeURIComponent(new URL(n).pathname.split('/').pop()!))
    .sort()
  const serif = of('serif')
  return {
    serif: { family: FACES.serif.name, weight: FACES.serif.weight, declared: serif.length, loaded: serif.filter((f) => f.status === 'loaded').length },
    sans: { family: FACES.sans.name, weight: FACES.sans.weight, declared: of('sans').length },
    fetched: fetched.filter((n) => n.includes('noto-serif-jp')),
    fetchedReading: fetched.filter((n) => n.includes('noto-sans-jp')),
    dpr: devicePixelRatio,
  }
}

Object.assign(window, { serifInkRender: { glyphs, writing, faces } })
document.body.dataset.state = 'ready'
