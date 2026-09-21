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
