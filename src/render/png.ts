/**
 * The page as an image. Drawn directly with the bundled font into a canvas
 * (an SVG rasterised as an image could not reach the web font), mark by mark,
 * with the same transforms, crops and subtractions as the SVG.
 */
import { EM, INK, PAPER } from '../glyph/font'
import { REMOVAL_MARGIN } from '../glyph/relation'
import type { GlyphLibrary } from '../glyph/source'
import type { Draft, Mark } from '../poem/types'
import { PAGE } from './stage'

export function renderCanvas(draft: Draft, glyphs: GlyphLibrary, px = 2048): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = px
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, px, px)
  const scratch = document.createElement('canvas')
  scratch.width = scratch.height = px
  const sctx = scratch.getContext('2d')!
  const k = px / PAGE

  const toEm = (c: CanvasRenderingContext2D, m: Mark) => {
    c.setTransform(k, 0, 0, k, 0, 0)
    c.translate(m.x, m.y)
    c.rotate(((m.rotate ?? 0) * Math.PI) / 180)
    c.scale(m.size / EM, m.size / EM)
    if (m.shift) c.translate(m.shift.x, m.shift.y)
    if (m.keep) {
      c.beginPath()
      for (const r of m.keep) c.rect(r.x, r.y, r.w, r.h)
      c.clip()
    }
  }

  for (const m of draft.marks) {
    const glyph = glyphs.get(m.char)
    if (!m.minus) {
      ctx.save()
      toEm(ctx, m)
      glyph.paint(ctx, { color: INK })
      ctx.restore()
      continue
    }
    // subtraction: draw alone, remove the other glyph, then lay onto the page
    sctx.setTransform(1, 0, 0, 1, 0, 0)
    sctx.clearRect(0, 0, px, px)
    sctx.save()
    toEm(sctx, m)
    glyph.paint(sctx, { color: INK })
    sctx.globalCompositeOperation = 'destination-out'
    sctx.translate(m.minus.dx, m.minus.dy)
    sctx.scale(m.minus.scale, m.minus.scale)
    glyphs.get(m.minus.char).paint(sctx, { color: INK, spread: (2 * REMOVAL_MARGIN) / m.minus.scale })
    sctx.restore()
    ctx.drawImage(scratch, 0, 0)
  }
  return canvas
}

export function downloadPNG(canvas: HTMLCanvasElement, name: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${name}.png`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }, 'image/png')
}
