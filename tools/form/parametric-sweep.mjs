// titles × a swept parameter, drawn by the parametric generator
import { writeFileSync } from 'node:fs'
export default async function ({ evaluate, load }) {
  await load('/index.html', 1280, 800)
  const data = await evaluate(`(async () => { try {
    const C = await import('/src/poem/compose.ts'); const N = await import('/src/title.ts'); const R = await import('/src/render/png.ts')
    const titles = ${process.env.TITLES}, steps = ${process.env.STEPS}, cell = ${process.env.CELL ?? 200}
    const pad = 16, side = 120, head = 26
    const sheet = document.createElement('canvas')
    sheet.width = side + steps.length * (cell + pad) + pad
    sheet.height = head + titles.length * (cell + pad) + pad
    const ctx = sheet.getContext('2d')
    ctx.fillStyle = '#e4e4e4'; ctx.fillRect(0, 0, sheet.width, sheet.height)
    ctx.fillStyle = '#555'; ctx.font = '12px ui-monospace, Consolas, monospace'
    steps.forEach((s, i) => ctx.fillText(s.label, side + i * (cell + pad), 18))
    for (const [r, t] of titles.entries()) {
      const a = await C.analyze(N.normalizeTitle({ text: t.text, reading: t.reading }))
      const y = head + r * (cell + pad)
      ctx.fillStyle = '#333'; ctx.font = '13px "Noto Sans JP", sans-serif'
      ctx.fillText(t.text, pad, y + 20)
      for (const [i, s] of steps.entries()) {
        const c = C.compose(a, { parametric: "trace", ...(s.params ? { params: s.params } : {}), ...(s.material ? { material: s.material } : {}), ...(s.force ?? {}) })
        ctx.drawImage(R.renderCanvas(c.draft, a.glyphs, cell), side + i * (cell + pad), y)
      }
    }
    return sheet.toDataURL("image/png") } catch (e) { return "ERR " + String((e && e.stack) || e).slice(0, 500) }
  })()`)
  if (typeof data !== "string" || data.startsWith("ERR")) return data
  writeFileSync(process.env.OUT, Buffer.from(data.split(",")[1], "base64"))
  return 'ok'
}
