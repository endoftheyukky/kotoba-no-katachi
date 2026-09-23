/**
 * The page: a square sheet of PAGE × PAGE units, centred in the window.
 * Its edge crops like the edge of paper — a glyph that exceeds it is cut.
 */
export const PAGE = 1000
export const CENTRE = PAGE / 2

const NS = 'http://www.w3.org/2000/svg'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

type Attrs = Record<string, string | number>

/** clip ids must be unique in the document: several pages can share it */
let ids = 0

export class Stage {
  readonly svg: SVGSVGElement
  readonly defs: SVGDefsElement
  /** everything drawn on the page goes here */
  readonly layer: SVGGElement

  constructor(host: HTMLElement) {
    this.svg = this.el('svg', {
      viewBox: `0 0 ${PAGE} ${PAGE}`,
      preserveAspectRatio: 'xMidYMid meet',
      'text-rendering': 'geometricPrecision',
    })
    this.defs = this.el('defs', {}, this.svg)
    const page = this.clip([{ x: 0, y: 0, w: PAGE, h: PAGE }])
    this.layer = this.el('g', { 'clip-path': page.url }, this.svg)
    host.replaceChildren(this.svg)
  }

  el<K extends keyof SVGElementTagNameMap>(name: K, attrs: Attrs = {}, parent?: Element): SVGElementTagNameMap[K] {
    const node = document.createElementNS(NS, name)
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v))
    parent?.appendChild(node)
    return node
  }

  /**
   * A clip made of rectangles, expressed in the user space of whichever
   * element references it. Returns the rects so they can be moved over time.
   */
  clip(rects: Rect[]): { url: string; rects: SVGRectElement[] } {
    const id = `c${ids++}`
    const cp = this.el('clipPath', { id, clipPathUnits: 'userSpaceOnUse' }, this.defs)
    const els = rects.map((r) => this.el('rect', { x: r.x, y: r.y, width: r.w, height: r.h }, cp))
    return { url: `url(#${id})`, rects: els }
  }

  /**
   * A subtractive mask in the user space of the element that uses it:
   * everything is kept except what is drawn into `cut`.
   */
  mask(extent: number): { url: string; cut: SVGGElement } {
    const id = `m${ids++}`
    const box = { x: -extent, y: -extent, width: 2 * extent, height: 2 * extent }
    const m = this.el('mask', { id, maskUnits: 'userSpaceOnUse', maskContentUnits: 'userSpaceOnUse', ...box }, this.defs)
    this.el('rect', { ...box, fill: '#fff' }, m)
    const cut = this.el('g', {}, m)
    return { url: `url(#${id})`, cut }
  }
}
