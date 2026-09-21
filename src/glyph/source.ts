/**
 * Where a glyph's shape comes from.
 *
 * Every source draws into an em square of EM units with the INK CENTRE at the
 * origin, both into SVG (screen) and into a canvas (PNG), so figures can scale,
 * rotate, crop, cut and subtract it without knowing what kind of drawing it is.
 * Today it is text in the bundled font. An OutlineGlyph built from opentype.js
 * path commands can implement the same interface (a <path> / Path2D in the
 * same em space) for outlined SVG export.
 */
import { EM, FACES, familyOf, fontOf, INK, type Face } from './font'
import { measure, type GlyphMetrics } from './metrics'

/** how to lay the glyph's ink: filled, and optionally widened by a stroke */
export interface Ink {
  color?: string
  /** stroke width in em units (widens the glyph by half of it on every side) */
  spread?: number
}

export interface GlyphSource {
  readonly char: string
  readonly metrics: GlyphMetrics
  /** Append the drawing to parent, in em units, ink centre at (0, 0). */
  draw(parent: SVGGElement, ink?: Ink): void
  /** Paint into a canvas whose current transform is the em space. */
  paint(ctx: CanvasRenderingContext2D, ink?: Ink): void
}

export class TextGlyph implements GlyphSource {
  constructor(
    readonly char: string,
    readonly metrics: GlyphMetrics,
    readonly face: Face = 'sans',
  ) {}

  draw(parent: SVGGElement, ink: Ink = {}): void {
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    const color = ink.color ?? INK
    t.setAttribute('x', this.metrics.pen.x.toFixed(3))
    t.setAttribute('y', this.metrics.pen.y.toFixed(3))
    t.setAttribute('font-size', String(EM))
    t.setAttribute('font-family', familyOf(this.face))
    t.setAttribute('font-weight', String(FACES[this.face].weight))
    t.setAttribute('fill', color)
    if (ink.spread) {
      t.setAttribute('stroke', color)
      t.setAttribute('stroke-width', ink.spread.toFixed(3))
      t.setAttribute('stroke-linejoin', 'round')
    }
    t.textContent = this.char
    parent.appendChild(t)
  }

  paint(ctx: CanvasRenderingContext2D, ink: Ink = {}): void {
    const color = ink.color ?? INK
    ctx.font = fontOf(this.face, EM)
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = color
    ctx.fillText(this.char, this.metrics.pen.x, this.metrics.pen.y)
    if (ink.spread) {
      ctx.strokeStyle = color
      ctx.lineWidth = ink.spread
      ctx.lineJoin = 'round'
      ctx.strokeText(this.char, this.metrics.pen.x, this.metrics.pen.y)
    }
  }
}

const keyOf = (char: string, face: Face) => (face === 'sans' ? char : `${face}:${char}`)

export class GlyphLibrary {
  private cache = new Map<string, GlyphSource>()

  /** Load a face for these characters and measure them. Fails if the font is unavailable. */
  async prepare(chars: readonly string[], face: Face = 'sans'): Promise<void> {
    const text = [...new Set(chars)].join('')
    const font = fontOf(face, EM)
    await document.fonts.load(font, text)
    if (!document.fonts.check(font, text)) throw new Error(`font ${familyOf(face)} could not be loaded`)
    for (const c of chars) {
      const key = keyOf(c, face)
      if (!this.cache.has(key)) this.cache.set(key, new TextGlyph(c, measure(c, face), face))
    }
  }

  get(char: string, face: Face = 'sans'): GlyphSource {
    const g = this.cache.get(keyOf(char, face))
    if (!g) throw new Error(`glyph not prepared: ${char} (${face})`)
    return g
  }

  /** the readings' glyphs: the reading face only */
  metrics(): Map<string, GlyphMetrics> {
    return new Map([...this.cache].filter(([k]) => !k.startsWith('serif:')).map(([, g]) => [g.char, g.metrics]))
  }
}
