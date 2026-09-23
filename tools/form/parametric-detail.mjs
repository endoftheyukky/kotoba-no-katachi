// A few pages drawn large, each with what it was read to mean and what the
// acts did — to look at one page closely, not at the series.
// env: TITLES (JSON [{text, reading?}]), OUT, MEANING (1 to read meaning), CELL, FORCE
import { writeFileSync } from 'node:fs'
export default async function ({ evaluate, load }) {
  await load('/index.html', 1280, 800)
  const data = await evaluate(`(async () => { try {
    const C = await import('/src/poem/compose.ts'); const N = await import('/src/title.ts'); const R = await import('/src/render/png.ts')
    const SEM = await import('/src/language/semantic/axes.ts')
    const table = ${process.env.MEANING ? 'SEM.parseTable("proto", await (await fetch("/semantic-proto/axes.tsv")).text())' : 'null'}
    const titles = ${process.env.TITLES}
    const force = ${process.env.FORCE ?? '{"parametric":"auto"}'}
    const cell = ${process.env.CELL ?? 360}, pad = 12, text = 150, perRow = ${process.env.PER_ROW ?? 3}
    const rows = Math.ceil(titles.length / perRow)
    const sheet = document.createElement('canvas')
    sheet.width = pad + perRow * (cell + pad)
    sheet.height = pad + rows * (cell + text + pad)
    const ctx = sheet.getContext('2d')
    ctx.fillStyle = '#e4e4e4'; ctx.fillRect(0, 0, sheet.width, sheet.height)
    for (const [i, t] of titles.entries()) {
      const a = await C.analyze(N.normalizeTitle({ text: t.text, reading: t.reading }))
      const meaning = table ? SEM.meaningOf(t.text, table) : null
      const c = C.compose(a, meaning ? { ...force, meaning } : force)
      const x = pad + (i % perRow) * (cell + pad)
      const y = pad + Math.floor(i / perRow) * (cell + text + pad)
      ctx.drawImage(R.renderCanvas(c.draft, a.glyphs, cell), x, y)
      ctx.fillStyle = '#111'; ctx.font = '14px "Noto Sans JP", sans-serif'
      ctx.fillText(t.text, x, y + cell + 16)
      ctx.fillStyle = '#555'; ctx.font = '10px "Noto Sans JP", ui-monospace, monospace'
      const lines = []
      if (meaning) lines.push(Object.entries(meaning.axes).map(([k, v]) => k.slice(0, 5) + (v >= 0 ? '+' : '') + v.toFixed(2)).join(' ') + '  cov ' + meaning.coverage.toFixed(2))
      const p = c.parametric
      if (p) {
        lines.push('scale ' + p.paper.scale.toFixed(3) + ' off ' + p.paper.offset.toFixed(2) + ' rows ' + p.params.rows.toFixed(1) + ' hier ' + p.paper.hierarchy.toFixed(1) + ' grains ' + p.grains)
        for (const g of p.grounds.slice(-6)) lines.push(g)
      }
      lines.forEach((l, j) => ctx.fillText(l.slice(0, 64), x, y + cell + 32 + j * 13))
    }
    return sheet.toDataURL('image/png')
  } catch (e) { return 'ERR ' + String((e && e.stack) || e).slice(0, 500) } })()`)
  if (typeof data !== 'string' || data.startsWith('ERR')) return data
  writeFileSync(process.env.OUT, Buffer.from(data.split(',')[1], 'base64'))
  return 'ok'
}
