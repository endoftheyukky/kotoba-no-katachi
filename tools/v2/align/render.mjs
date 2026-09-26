// Build time only: a script for tools/verify/cdp.mjs (run by tools/v2/align.mjs). Measures every character
// named in $ALIGN_CHARS on tools/v2/align/page.html and writes the rasters to $ALIGN_RASTERS
// (gzip, JSON lines: the render environment first, then one glyph per line, by code point).
import { readFileSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const BATCH = 200

export default async function ({ evaluate, load, send }) {
  const chars = JSON.parse(readFileSync(process.env.ALIGN_CHARS, 'utf8'))
  await load('/tools/v2/align/page.html', 800, 600)
  const version = (await send('Browser.getVersion')).result
  const commandLine = (await send('Browser.getBrowserCommandLine')).result?.arguments ?? null
  const lines = []
  for (let i = 0; i < chars.length; i += BATCH) {
    const got = await evaluate(`window.alignRender.measure(${JSON.stringify(chars.slice(i, i + BATCH))})`)
    if (!Array.isArray(got)) throw new Error(`measure failed at ${i}`)
    for (const g of got) lines.push(JSON.stringify(g))
  }
  const faces = await evaluate('window.alignRender.faces()')
  const head = JSON.stringify({ browser: version, commandLine, faces, measured: chars.length })
  writeFileSync(process.env.ALIGN_RASTERS, gzipSync(Buffer.from([head, ...lines].join('\n') + '\n'), { level: 9 }))
  return { measured: chars.length, uncovered: lines.filter((l) => l.includes('"covered":false')).length, browser: version?.product, fetched: faces?.fetched?.length }
}
