// render a contact matrix (titles × forces) with the repo's own renderer, save as PNG
// env: TITLES (JSON [{text,reading?}]), COLUMNS (JSON [{label, force}]), CELL, OUT
import { writeFileSync } from 'node:fs'
export default async function ({ evaluate, load }) {
  await load('/index.html', 1280, 800)
  const data = await evaluate(`(async () => {
    const S = await import('/src/study/sheet.ts')
    const canvas = await S.contactMatrix(${process.env.TITLES}.map((t) => ({ note: '', ...t })), ${process.env.COLUMNS}, ${process.env.CELL ?? 240})
    return canvas.toDataURL('image/png')
  })()`)
  writeFileSync(process.env.OUT, Buffer.from(data.split(',')[1], 'base64'))
  return process.env.OUT
}
