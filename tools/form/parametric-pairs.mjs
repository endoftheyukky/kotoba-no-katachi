// compact before/after sheet: SET (dev|holdout|probe), PER_ROW titles per row, each as [v2c | v3] with a caption
import { writeFileSync } from 'node:fs'
export default async function ({ evaluate, load }) {
  await load('/index.html', 1280, 800)
  const data = await evaluate(`(async () => {
    const C = await import('/src/poem/compose.ts'); const N = await import('/src/title.ts'); const R = await import('/src/render/png.ts')
    const T = await import('/src/study/titles.ts'); const H = await import('/src/study/holdout.ts'); const P = await import('/src/study/probes.ts')
    const set = '${process.env.SET ?? 'dev'}'
    const titles = set === 'holdout' ? H.HOLDOUT_TITLES : set === 'probe' ? P.PROBE_TITLES : T.STUDY_TITLES
    const perRow = ${process.env.PER_ROW ?? 4}, cell = ${process.env.CELL ?? 190}, gap = 6, pad = 18, cap = 30
    const rows = Math.ceil(titles.length / perRow)
    const pairW = cell * 2 + gap
    const sheet = document.createElement('canvas')
    sheet.width = pad + perRow * (pairW + pad)
    sheet.height = 46 + rows * (cell + cap + pad) + pad
    const ctx = sheet.getContext('2d')
    ctx.fillStyle = '#e4e4e4'; ctx.fillRect(0, 0, sheet.width, sheet.height)
    ctx.fillStyle = '#444'; ctx.font = '14px ui-monospace, Consolas, monospace'
    ctx.fillText(set + ' set — each pair: v2c (left) | v4 parametric generator (right). Caption: anchor · operators taken (share of what the title asked)', pad, 26)
    for (const [i, t] of titles.entries()) {
      const input = N.normalizeTitle({ text: t.text, reading: t.reading })
      if (typeof input === 'string') continue
      const a = await C.analyze(input)
      const before = C.compose(a, { grammar: 'auto' })
      const after = C.compose(a, { parametric: "auto" })
      const x = pad + (i % perRow) * (pairW + pad)
      const y = 46 + Math.floor(i / perRow) * (cell + cap + pad)
      ctx.drawImage(R.renderCanvas(before.draft, a.glyphs, cell), x, y)
      ctx.drawImage(R.renderCanvas(after.draft, a.glyphs, cell), x + cell + gap, y)
      ctx.fillStyle = '#222'; ctx.font = '13px "Noto Sans JP", sans-serif'
      ctx.fillText(t.text + (t.reading ? '（' + t.reading + '）' : ''), x, y + cell + 14)
      const P = after.parametric; const M = P && P.material; const ops = P ? ('clo ' + P.params.closure.toFixed(2) + ' rows ' + P.params.rows.toFixed(1) + ' scale ' + P.paper.scale.toFixed(2) + ' off ' + P.paper.offset.toFixed(2) + ' hier ' + P.paper.hierarchy.toFixed(1)) + (M && M.density > 0.02 ? ' · mat ' + M.density.toFixed(2) + ' form/ring/page ' + [M.onForm, M.onRing, M.onPage].map((w) => (w / (M.onForm + M.onRing + M.onPage)).toFixed(1)).join('/') + ' ×' + P.grains : ' · no material') : ''
      ctx.fillStyle = '#666'; ctx.font = '10px ui-monospace, Consolas, monospace'
      ctx.fillText((before.spatial.id + '/' + before.spatial.mode + '+' + before.grammar.id).slice(0, 34) + '  ' + (ops || '— (stays)'), x, y + cell + 27)
    }
    return sheet.toDataURL('image/png')
  })()`)
  writeFileSync(process.env.OUT, Buffer.from(data.split(',')[1], 'base64'))
  return process.env.OUT
}
