/**
 * A contact sheet as one image (development only, not part of the work).
 *
 * Every page is drawn with the same renderer as the PNG export, so what the
 * sheet shows is what a reader would save. Each page sits on a grey ground,
 * with its title and the way it was held written small underneath.
 */
import { analyze, compose, SPACES, type Force } from '../poem/compose'
import { renderCanvas } from '../render/png'
import { normalizeTitle } from '../title'
import type { StudyTitle } from './titles'

export interface SheetOptions {
  /** pages per row */
  cols?: number
  /** px per page */
  cell?: number
  /** draw every title under this force (review only) */
  force?: Force
  /** a caption line under each page */
  label?: boolean
}

/**
 * One row per title, one column per way of drawing it, all at one size: the
 * v2 comparison (a composition, with or without a mark grammar).
 */
export async function contactMatrix(
  titles: readonly StudyTitle[],
  columns: { label: string; force: Force }[],
  cell = 240,
): Promise<HTMLCanvasElement> {
  const pad = Math.round(cell * 0.08)
  const head = Math.round(cell * 0.14)
  const side = Math.round(cell * 0.55)
  const sheet = document.createElement('canvas')
  sheet.width = side + columns.length * (cell + pad) + pad
  sheet.height = head + titles.length * (cell + pad) + pad
  const ctx = sheet.getContext('2d')!
  ctx.fillStyle = '#e4e4e4'
  ctx.fillRect(0, 0, sheet.width, sheet.height)
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#555'
  ctx.font = `${Math.round(head * 0.42)}px ui-monospace, Consolas, monospace`
  columns.forEach((c, i) => ctx.fillText(c.label, side + i * (cell + pad), pad * 0.6))
  for (const [r, t] of titles.entries()) {
    const input = normalizeTitle({ text: t.text, reading: t.reading })
    if (typeof input === 'string') continue
    const a = await analyze(input)
    const y = head + r * (cell + pad)
    ctx.fillStyle = '#333'
    ctx.font = `${Math.round(cell * 0.09)}px "Noto Sans JP", sans-serif`
    ctx.fillText(t.text, pad, y + 4)
    for (const [i, col] of columns.entries()) {
      const c = compose(a, col.force)
      const page = renderCanvas(c.draft, a.glyphs, cell)
      const x = side + i * (cell + pad)
      ctx.drawImage(page, x, y)
      // a way that found nothing to act on is marked, so it is not mistaken for one that did
      if (col.force.grammar && c.grammar.id === 'uniform') {
        ctx.fillStyle = '#b00'
        ctx.font = `${Math.round(cell * 0.05)}px ui-monospace, Consolas, monospace`
        ctx.fillText('— 該当なし —', x + 6, y + cell - cell * 0.08)
      }
    }
  }
  return sheet
}

export async function contactSheet(titles: readonly StudyTitle[], o: SheetOptions = {}): Promise<HTMLCanvasElement> {
  const cols = o.cols ?? 7
  const cell = o.cell ?? 260
  const pad = Math.round(cell * 0.08)
  const caption = o.label === false ? 0 : Math.round(cell * 0.16)
  const rows = Math.ceil(titles.length / cols)
  const sheet = document.createElement('canvas')
  sheet.width = cols * (cell + pad) + pad
  sheet.height = rows * (cell + caption + pad) + pad
  const ctx = sheet.getContext('2d')!
  ctx.fillStyle = '#e4e4e4'
  ctx.fillRect(0, 0, sheet.width, sheet.height)

  for (const [i, t] of titles.entries()) {
    const input = normalizeTitle({ text: t.text, reading: t.reading })
    if (typeof input === 'string') continue
    const a = await analyze(input)
    const c = compose(a, o.force ?? {})
    const page = renderCanvas(c.draft, a.glyphs, cell)
    const x = pad + (i % cols) * (cell + pad)
    const y = pad + Math.floor(i / cols) * (cell + caption + pad)
    ctx.drawImage(page, x, y)
    if (!caption) continue
    const space = SPACES.find((s) => s.id === c.spatial.id)?.title ?? c.spatial.id
    ctx.fillStyle = '#333'
    ctx.font = `${Math.round(caption * 0.42)}px "Noto Sans JP", sans-serif`
    ctx.textBaseline = 'top'
    ctx.fillText(t.text, x, y + cell + caption * 0.1)
    ctx.fillStyle = '#888'
    ctx.font = `${Math.round(caption * 0.32)}px ui-monospace, Consolas, monospace`
    ctx.fillText(`${space}/${c.spatial.mode}`, x, y + cell + caption * 0.58)
  }
  return sheet
}
