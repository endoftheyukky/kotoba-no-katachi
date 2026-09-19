/**
 * Where a glyph's shape comes from.
 *
 * Every source draws into an em square of EM units with the INK CENTRE at the
 * origin, so figures can scale, rotate, crop and cut it without knowing what
 * kind of drawing it is. Today it is SVG <text>. An OutlineGlyph built from
 * opentype.js path commands can implement the same interface (a <path> in the
 * same em space) and every rule will keep working — and can then address
 * individual contours as glyph parts.
 */
import { EM, FONT_FAMILY, FONT_WEIGHT, INK } from './font'
import { measure, type GlyphMetrics } from './metrics'

export interface GlyphSource {
  readonly char: string
  readonly metrics: GlyphMetrics
  /** Append the drawing to parent, in em units, ink centre at (0, 0). */
  draw(parent: SVGGElement): void
}

export class TextGlyph implements GlyphSource {
  constructor(
    readonly char: string,
    readonly metrics: GlyphMetrics,
  ) {}

  draw(parent: SVGGElement): void {
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    t.setAttribute('x', this.metrics.pen.x.toFixed(3))
    t.setAttribute('y', this.metrics.pen.y.toFixed(3))
    t.setAttribute('font-size', String(EM))
    t.setAttribute('font-family', FONT_FAMILY)
    t.setAttribute('font-weight', String(FONT_WEIGHT))
    t.setAttribute('fill', INK)
    t.textContent = this.char
    parent.appendChild(t)
  }
}

export class GlyphLibrary {
  private cache = new Map<string, GlyphSource>()

  async prepare(chars: readonly string[]): Promise<void> {
    const text = chars.join('')
    try {
      await document.fonts.load(`${FONT_WEIGHT} ${EM}px ${FONT_FAMILY}`, text)
    } catch {
      // system fonts: nothing to wait for
    }
    for (const c of chars) if (!this.cache.has(c)) this.cache.set(c, new TextGlyph(c, measure(c)))
  }

  get(char: string): GlyphSource {
    const g = this.cache.get(char)
    if (!g) throw new Error(`glyph not prepared: ${char}`)
    return g
  }
}
