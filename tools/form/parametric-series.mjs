// One sheet of the whole set under one force, to be looked at as a series.
// env: FORCE (JSON), OUT, PER_ROW, CELL, SETS (dev,holdout,probe)
import { writeFileSync } from 'node:fs'
export default async function ({ evaluate, load }) {
  await load('/index.html', 1280, 800)
  const data = await evaluate(`(async () => {
    const C = await import('/src/poem/compose.ts'); const N = await import('/src/title.ts'); const R = await import('/src/render/png.ts')
    const T = await import('/src/study/titles.ts'); const H = await import('/src/study/holdout.ts'); const P = await import('/src/study/probes.ts')
    const sets = '${process.env.SETS ?? 'dev,holdout'}'.split(',')
    const titles = [
      ...(sets.includes('dev') ? T.STUDY_TITLES : []),
      ...(sets.includes('holdout') ? H.HOLDOUT_TITLES : []),
      ...(sets.includes('probe') ? P.PROBE_TITLES : []),
    ]
    const force = ${process.env.FORCE ?? '{"grammar":"auto"}'}
    const perRow = ${process.env.PER_ROW ?? 8}, cell = ${process.env.CELL ?? 150}, pad = 8, cap = 16
    const rows = Math.ceil(titles.length / perRow)
    const sheet = document.createElement('canvas')
    sheet.width = pad + perRow * (cell + pad)
    sheet.height = 30 + rows * (cell + cap + pad) + pad
    const ctx = sheet.getContext('2d')
    ctx.fillStyle = '#e4e4e4'; ctx.fillRect(0, 0, sheet.width, sheet.height)
    ctx.fillStyle = '#444'; ctx.font = '13px ui-monospace, Consolas, monospace'
    ctx.fillText('${process.env.LABEL ?? ''}' + '  (' + titles.length + ' titles)', pad, 20)
    for (const [i, t] of titles.entries()) {
      const input = N.normalizeTitle({ text: t.text, reading: t.reading })
      if (typeof input === 'string') continue
      const a = await C.analyze(input)
      const c = C.compose(a, force)
      const x = pad + (i % perRow) * (cell + pad)
      const y = 30 + Math.floor(i / perRow) * (cell + cap + pad)
      ctx.drawImage(R.renderCanvas(c.draft, a.glyphs, cell), x, y)
      ctx.fillStyle = '#333'; ctx.font = '11px "Noto Sans JP", sans-serif'
      ctx.fillText(t.text.slice(0, 12), x, y + cell + 12)
    }
    return sheet.toDataURL('image/png')
  })()`)
  writeFileSync(process.env.OUT, Buffer.from(data.split(',')[1], 'base64'))
  return process.env.OUT
}
