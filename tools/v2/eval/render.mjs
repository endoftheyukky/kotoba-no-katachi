// Development only: a script for tools/verify/cdp.mjs (run by tools/v2/eval.mjs). Composes, draws and checks the
// titles in $EVAL_TITLES on tools/v2/eval/page.html and writes pages, contact sheets and a summary to $EVAL_OUT.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export default async function ({ evaluate, load }) {
  const sets = JSON.parse(readFileSync(process.env.EVAL_TITLES, 'utf8'))
  const out = process.env.EVAL_OUT
  mkdirSync(join(out, 'pages'), { recursive: true })
  await load('/tools/v2/eval/page.html', 1200, 900)
  const summary = {}
  for (const [name, titles] of Object.entries(sets)) {
    const res = []
    for (let i = 0; i < titles.length; i += 20) {
      const got = await evaluate(`window.v2eval.run(${JSON.stringify(titles.slice(i, i + 20))}, ${name === 'public' ? 360 : 600})`)
      res.push(...got)
    }
    res.forEach((r, i) => { if (r.png) writeFileSync(join(out, 'pages', `${name}-${String(i).padStart(3, '0')}-${r.text.replace(/[\/:*?"<>|！？!? 、。]/g, '_').slice(0, 12)}.png`), Buffer.from(r.png.split(',')[1], 'base64')) })
    const per = name === 'public' ? 44 : 24
    for (let s = 0; s * per < res.length; s++) {
      const url = await evaluate(`window.v2eval.sheet(${JSON.stringify(res.slice(s * per, (s + 1) * per).map((r) => ({ ...r })))}, ${name === 'public' ? 8 : 6}, ${name === 'public' ? 220 : 300})`)
      writeFileSync(join(out, `sheet-${name}-${s}.png`), Buffer.from(url.split(',')[1], 'base64'))
    }
    summary[name] = res.map(({ png, draft, ...r }) => r)
    writeFileSync(join(out, `drafts-${name}.json`), JSON.stringify(res.map((r) => ({ text: r.text, marks: r.draft?.marks ?? null }))))
  }
  writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 1))
  return { sets: Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, v.length])) }
}
