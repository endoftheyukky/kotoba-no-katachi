// The nine 作例 on the blank page: each drawn by the published generator
// through the site's own path (analyze → poem/generators.write(…, 1) →
// render/png.renderCanvas, the renderer 保存 uses), written to
// public/examples/v1/, with a manifest of what each one is. The same paper,
// larger, on the site's ground, is the link image of that poem's address
// (public/og/v1/, 1200 × 630; see docs/site.md). The site's own link image
// (public/ogp.png) is drawn here too: the page of the work's own name.
//
// The thumbnails are the poems, not pictures of them: `CHECK=1` draws them
// again and compares the drafts and the images with the manifest, so that a
// thumbnail can never drift from the page its link opens.
//
// usage (with a dev server running, e.g. `npx vite --port 5175`):
//   node tools/verify/cdp.mjs http://127.0.0.1:5175 <shots-dir> tools/examples/make.mjs
//   CHECK=1 node tools/verify/cdp.mjs … tools/examples/make.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'

export const EXAMPLES = [
  { text: '森', file: 'mori' },
  { text: '孤独', file: 'kodoku' },
  { text: '雨の中の雨', file: 'ame-no-naka-no-ame' },
  { text: '余白', file: 'yohaku' },
  { text: '見えない', file: 'mienai' },
  { text: '群衆', file: 'gunshu' },
  { text: 'ささやき', file: 'sasayaki' },
  { text: '境界', file: 'kyokai' },
  { text: '記憶', file: 'kioku' },
]
const PX = 360
const OUT = 'public/examples/v1'
/**
 * the site's own link image (public/ogp.png): the work reading its own name —
 * the page of 「ことばのかたち」 (the same page /?title=ことばのかたち&v=1 draws),
 * one paper in the middle of the ground, as the site shows a poem. Nothing else:
 * the card's own title already says the name the paper is made of.
 */
const SITE = { file: 'public/ogp.png', w: 1200, h: 630, papers: [{ text: 'ことばのかたち', s: 570 }] }
/** the link image: the paper, square, on the ground, with the sheet's own faint shadow — nothing added */
const OG = { dir: 'public/og/v1', w: 1200, h: 630, paper: 540 }
const MANIFEST = 'tools/examples/manifest.json'

export default async function ({ evaluate, load }) {
  await load('/index.html', 1280, 800)
  const made = await evaluate(`(async () => {
    const C = await import('/src/poem/compose.ts'); const N = await import('/src/title.ts')
    const G = await import('/src/poem/generators.ts'); const R = await import('/src/render/png.ts')
    const out = []
    for (const e of ${JSON.stringify(EXAMPLES)}) {
      const input = N.normalizeTitle({ text: e.text })
      const a = await C.analyze(input)
      const c = await G.write(a, 1)
      const canvas = R.renderCanvas(c.draft, a.glyphs, ${PX})
      const og = document.createElement('canvas')
      og.width = ${OG.w}; og.height = ${OG.h}
      const g = og.getContext('2d')
      g.fillStyle = '#e8e6e1'; g.fillRect(0, 0, og.width, og.height)
      const s = ${OG.paper}, x = (og.width - s) / 2, y = (og.height - s) / 2
      g.save(); g.shadowColor = 'rgba(40, 36, 28, 0.07)'; g.shadowBlur = 24; g.shadowOffsetY = 6
      g.fillStyle = '#fff'; g.fillRect(x, y, s, s); g.restore()
      g.drawImage(R.renderCanvas(c.draft, a.glyphs, s), x, y)
      out.push({ ...e, draft: JSON.stringify(c.draft.marks), png: canvas.toDataURL('image/png'), og: og.toDataURL('image/png') })
    }
    const site = document.createElement('canvas')
    site.width = ${SITE.w}; site.height = ${SITE.h}
    const g = site.getContext('2d')
    g.fillStyle = '#e8e6e1'; g.fillRect(0, 0, site.width, site.height)
    for (const p of ${JSON.stringify(SITE.papers)}) {
      const a = await C.analyze(N.normalizeTitle({ text: p.text }))
      const c = await G.write(a, 1)
      const s = p.s, x = p.x ?? (site.width - s) / 2, y = p.y ?? (site.height - s) / 2
      g.save(); g.shadowColor = 'rgba(40, 36, 28, 0.07)'; g.shadowBlur = 24; g.shadowOffsetY = 6
      g.fillStyle = '#fff'; g.fillRect(x, y, s, s); g.restore()
      g.drawImage(R.renderCanvas(c.draft, a.glyphs, s), x, y)
    }
    return { list: out, site: site.toDataURL('image/png') }
  })()`)
  const siteImage = Buffer.from(made.site.split(',')[1], 'base64')
  const sha = (s) => createHash('sha256').update(s).digest('hex')
  const rows = made.list.map((m) => {
    const png = Buffer.from(m.png.split(',')[1], 'base64')
    const og = Buffer.from(m.og.split(',')[1], 'base64')
    return { text: m.text, v: 1, file: `${m.file}.png`, px: PX, draft: sha(m.draft), png: sha(png), bytes: png.length, og: sha(og), data: png, ogData: og }
  })
  if (process.env.CHECK) {
    const known = JSON.parse(readFileSync(MANIFEST, 'utf8'))
    return rows.map((r) => {
      const k = known.find((x) => x.text === r.text)
      const onDisk = sha(readFileSync(`${OUT}/${r.file}`))
      const ogOnDisk = sha(readFileSync(`${OG.dir}/${r.file}`))
      return { text: r.text, draft: k?.draft === r.draft, png: k?.png === r.png, file: onDisk === k?.png, og: k?.og === r.og && ogOnDisk === k?.og }
    }).concat([{ text: SITE.file, png: sha(readFileSync(SITE.file)) === sha(siteImage) }])
  }
  mkdirSync(OUT, { recursive: true })
  mkdirSync(OG.dir, { recursive: true })
  for (const r of rows) {
    writeFileSync(`${OUT}/${r.file}`, r.data)
    writeFileSync(`${OG.dir}/${r.file}`, r.ogData)
  }
  writeFileSync(SITE.file, siteImage)
  const manifest = rows.map(({ data, ogData, ...r }) => r)
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + '\n')
  return manifest
}
