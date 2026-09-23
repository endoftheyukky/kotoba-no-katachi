// Meaning off | meaning on: the same generator (v3), each title drawn without
// its meaning and with it, side by side, with the act that led the page.
// env: SET (difficult | dev | holdout | edges), OUT, PER_ROW, CELL
import { writeFileSync } from 'node:fs'
export default async function ({ evaluate, load }) {
  await load('/index.html', 1280, 800)
  const data = await evaluate(`(async () => { try {
    const C = await import('/src/poem/compose.ts'); const N = await import('/src/title.ts'); const R = await import('/src/render/png.ts')
    const L = await import('/src/language/semantic/load.ts')
    const T = await import('/src/study/titles.ts'); const H = await import('/src/study/holdout.ts'); const D = await import('/src/study/difficult.ts')
    const set = '${process.env.SET ?? 'difficult'}'
    const titles = set === 'dev' ? T.STUDY_TITLES : set === 'holdout' ? H.HOLDOUT_TITLES : set === 'edges' ? D.EDGE_TITLES : D.DIFFICULT_WORDS
    const perRow = ${process.env.PER_ROW ?? 4}, cell = ${process.env.CELL ?? 180}, gap = 6, pad = 18, cap = 30
    const rows = Math.ceil(titles.length / perRow)
    const pairW = cell * 2 + gap
    const sheet = document.createElement('canvas')
    sheet.width = pad + perRow * (pairW + pad)
    sheet.height = 46 + rows * (cell + cap + pad) + pad
    const ctx = sheet.getContext('2d')
    ctx.fillStyle = '#e4e4e4'; ctx.fillRect(0, 0, sheet.width, sheet.height)
    ctx.fillStyle = '#444'; ctx.font = '14px ui-monospace, Consolas, monospace'
    ctx.fillText(set + ' — each pair: meaning off (left) | meaning on (right), same generator (v3). Caption: the act that leads the page', pad, 26)
    for (const [i, t] of titles.entries()) {
      const input = N.normalizeTitle({ text: t.text, reading: t.reading })
      if (typeof input === 'string') continue
      const a = await C.analyze(input)
      const off = C.compose(a, { parametric: 'auto', meaning: null })
      const meaning = await L.readMeaning(input.text)
      const on = C.compose(a, { parametric: 'auto', meaning })
      const x = pad + (i % perRow) * (pairW + pad)
      const y = 46 + Math.floor(i / perRow) * (cell + cap + pad)
      ctx.drawImage(R.renderCanvas(off.draft, a.glyphs, cell), x, y)
      ctx.drawImage(R.renderCanvas(on.draft, a.glyphs, cell), x + cell + gap, y)
      ctx.fillStyle = '#222'; ctx.font = '13px "Noto Sans JP", sans-serif'
      ctx.fillText(t.text, x, y + cell + 14)
      const lead = (p) => (p.params.acts && p.params.acts.leader && p.params.acts.lead > 0.12 ? p.params.acts.leader : '—')
      ctx.fillStyle = '#666'; ctx.font = '10px ui-monospace, Consolas, monospace'
      ctx.fillText('off: ' + lead(off.parametric) + '   on: ' + lead(on.parametric), x, y + cell + 27)
    }
    return sheet.toDataURL('image/png')
  } catch (e) { return 'ERR ' + String((e && e.stack) || e).slice(0, 400) } })()`)
  if (typeof data !== 'string' || data.startsWith('ERR')) return data
  writeFileSync(process.env.OUT, Buffer.from(data.split(',')[1], 'base64'))
  return 'ok'
}
