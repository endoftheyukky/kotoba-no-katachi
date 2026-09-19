import { GlyphFigure } from '../glyph/figure'
import { REMOVAL_MARGIN } from '../glyph/relation'
import type { GlyphLibrary } from '../glyph/source'
import type { Draft } from '../poem/types'
import { Stage } from './stage'

/** Draw a page on screen. */
export function renderSVG(host: HTMLElement, draft: Draft, glyphs: GlyphLibrary): Stage {
  const stage = new Stage(host)
  for (const m of draft.marks) {
    const fig = new GlyphFigure(stage, glyphs.get(m.char)).place(m)
    if (m.keep) fig.crop(m.keep)
    if (m.minus)
      fig.subtract({
        source: glyphs.get(m.minus.char),
        dx: m.minus.dx,
        dy: m.minus.dy,
        scale: m.minus.scale,
        spread: 2 * REMOVAL_MARGIN,
      })
  }
  return stage
}
