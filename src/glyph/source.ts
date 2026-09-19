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
import { EM, FONT_FAMILY, FONT_WEIGHT, INK } from './font'
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

const CANVAS_FONT = `${FONT_WEIGHT} ${EM}px ${FONT_FAMILY}`

export class TextGlyph implements GlyphSource {
  constructor(
    readonly char: string,
    readonly metrics: GlyphMetrics,
  ) {}

  draw(parent: SVGGElement, ink: Ink = {}): void {
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    const color = ink.color ?? INK
    t.setAttribute('x', this.metrics.pen.x.toFixed(3))
    t.setAttribute('y', this.metrics.pen.y.toFixed(3))
    t.setAttribute('font-size', String(EM))
    t.setAttribute('font-family', FONT_FAMILY)
    t.setAttribute('font-weight', String(FONT_WEIGHT))
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
    ctx.font = CANVAS_FONT
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

export class GlyphLibrary {
  private cache = new Map<string, GlyphSource>()

  /** Load the fixed font for these characters and measure them. Fails if the font is unavailable. */
  async prepare(chars: readonly string[]): Promise<void> {
    const text = [...new Set(chars)].join('')
    await document.fonts.load(CANVAS_FONT, text)
    if (!document.fonts.check(CANVAS_FONT, text)) throw new Error(`font ${FONT_FAMILY} could not be loaded`)
    for (const c of chars) if (!this.cache.has(c)) this.cache.set(c, new TextGlyph(c, measure(c)))
  }

  get(char: string): GlyphSource {
    const g = this.cache.get(char)
    if (!g) throw new Error(`glyph not prepared: ${char}`)
    return g
  }

  metrics(): Map<string, GlyphMetrics> {
    return new Map([...this.cache].map(([c, g]) => [c, g.metrics]))
  }
}
