/**
 * A glyph placed on the page.
 *
 *   root   page space   — may be clipped by a page-space window
 *   body   transform    — position, rotation, scale (em → page)
 *   local  em space     — may be clipped by em-space regions (fragments)
 *   drawing             — from the GlyphSource
 *
 * One figure can be: normal text, a cropped glyph (crop), a glyph seen through
 * a window (put it in a clipped group), or a fragment (fragment → two figures
 * sharing one source, each keeping one side of a cut).
 */
import { EM } from './font'
import type { Axis } from './metrics'
import type { GlyphSource } from './source'
import type { Rect, Stage } from '../render/stage'

export interface Placement {
  x: number
  y: number
  /** em size in page units */
  size: number
  rotate?: number
  /** displacement in the glyph's own em space (applied after rotation and scale) */
  shift?: { x: number; y: number }
}

const f = (v: number) => v.toFixed(2)
const FAR = EM * 4

export class GlyphFigure {
  readonly root: SVGGElement
  private body: SVGGElement
  private local: SVGGElement
  private transform = ''
  private visible = true

  constructor(
    private stage: Stage,
    readonly source: GlyphSource,
    parent: Element = stage.layer,
  ) {
    this.root = stage.el('g', {}, parent)
    this.body = stage.el('g', {}, this.root)
    this.local = stage.el('g', {}, this.body)
    source.draw(this.local)
  }

  place(p: Placement): this {
    const k = p.size / EM
    let t = `translate(${f(p.x)} ${f(p.y)}) rotate(${f(p.rotate ?? 0)}) scale(${k.toFixed(4)})`
    if (p.shift) t += ` translate(${f(p.shift.x)} ${f(p.shift.y)})`
    if (t !== this.transform) {
      this.body.setAttribute('transform', t)
      this.transform = t
    }
    return this
  }

  show(v: boolean): this {
    if (v !== this.visible) {
      this.root.setAttribute('display', v ? 'inline' : 'none')
      this.visible = v
    }
    return this
  }

  /** Keep only the given regions of the glyph (em units, ink centre = origin). */
  crop(rects: Rect[] | null): this {
    if (!rects) this.local.removeAttribute('clip-path')
    else this.local.setAttribute('clip-path', this.stage.clip(rects).url)
    return this
  }

  /**
   * Cut the glyph along a line through its own em space.
   * Returns [left|top, right|bottom] as new figures, hidden.
   */
  fragment(axis: Axis, at: number): [GlyphFigure, GlyphFigure] {
    const parent = this.root.parentElement ?? this.stage.layer
    const a = new GlyphFigure(this.stage, this.source, parent).show(false)
    const b = new GlyphFigure(this.stage, this.source, parent).show(false)
    if (axis === 'x') {
      a.crop([{ x: -FAR, y: -FAR, w: FAR + at, h: FAR * 2 }])
      b.crop([{ x: at, y: -FAR, w: FAR - at, h: FAR * 2 }])
    } else {
      a.crop([{ x: -FAR, y: -FAR, w: FAR * 2, h: FAR + at }])
      b.crop([{ x: -FAR, y: at, w: FAR * 2, h: FAR - at }])
    }
    return [a, b]
  }
}
