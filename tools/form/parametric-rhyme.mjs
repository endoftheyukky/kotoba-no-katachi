// The set laid out by the structure each title has, so that a rhyme can be
// looked at: do the pages in a row lean the same way while staying different?
// env: RHYME (gain), OUT, CELL, PER_ROW
import { writeFileSync } from 'node:fs'
export default async function ({ evaluate, load }) {
  await load('/index.html', 1280, 800)
  const data = await evaluate(`(async () => { try {
    const C = await import('/src/poem/compose.ts'); const N = await import('/src/title.ts'); const R = await import('/src/render/png.ts')
    const T = await import('/src/study/titles.ts'); const H = await import('/src/study/holdout.ts')
    const titles = [...T.STUDY_TITLES, ...H.HOLDOUT_TITLES]
    const cell = ${process.env.CELL ?? 132}, perRow = ${process.env.PER_ROW ?? 9}, pad = 7, cap = 13, head = 22
    const made = []
    for (const t of titles) {
      const input = N.normalizeTitle({ text: t.text, reading: t.reading })
      if (typeof input === 'string') continue
      const a = await C.analyze(input)
      const c = C.compose(a, { parametric: 'auto', rhyme: ${process.env.RHYME ?? 'undefined'} })
      made.push({ text: t.text, motif: c.parametric.motif, strength: c.parametric.motifs[c.parametric.motif] ?? 0, canvas: R.renderCanvas(c.draft, a.glyphs, cell) })
    }
    const order = ['repetition', 'pairing', 'nesting', 'absence', 'articulation', 'echo', 'plain']
    const groups = order.map((m) => ({ m, rows: made.filter((x) => x.motif === m).sort((x, y) => y.strength - x.strength) })).filter((g) => g.rows.length)
    let lines = 0
    for (const g of groups) lines += Math.ceil(g.rows.length / perRow)
    const sheet = document.createElement('canvas')
    sheet.width = pad + perRow * (cell + pad)
    sheet.height = 26 + lines * (cell + cap + pad) + groups.length * head + pad
    const ctx = sheet.getContext('2d')
    ctx.fillStyle = '#e4e4e4'; ctx.fillRect(0, 0, sheet.width, sheet.height)
    ctx.fillStyle = '#444'; ctx.font = '13px ui-monospace, Consolas, monospace'
    ctx.fillText('the set by the structure each title has — rhyme ${process.env.RHYME ?? 'default'}', pad, 18)
    let y = 26
    for (const g of groups) {
      ctx.fillStyle = '#111'; ctx.font = '12px ui-monospace, Consolas, monospace'
      ctx.fillText(g.m + '  (' + g.rows.length + ')', pad, y + 14)
      y += head
      for (const [i, x] of g.rows.entries()) {
        const col = i % perRow
        if (col === 0 && i) y += cell + cap + pad
        ctx.drawImage(x.canvas, pad + col * (cell + pad), y)
        ctx.fillStyle = '#333'; ctx.font = '10px "Noto Sans JP", sans-serif'
        ctx.fillText(x.text.slice(0, 11), pad + col * (cell + pad), y + cell + 10)
      }
      y += cell + cap + pad
    }
    return sheet.toDataURL('image/png')
  } catch (e) { return 'ERR ' + String((e && e.stack) || e).slice(0, 400) } })()`)
  if (typeof data !== 'string' || data.startsWith('ERR')) return data
  writeFileSync(process.env.OUT, Buffer.from(data.split(',')[1], 'base64'))
  return 'ok'
}
