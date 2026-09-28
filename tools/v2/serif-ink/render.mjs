// Build time only: a script for tools/verify/cdp.mjs (run by tools/v2/serif-ink.mjs). Measures every character named
// in $SERIF_CHARS and every code point named in $SERIF_WRITING on tools/v2/serif-ink/page.html, and writes them to
// $SERIF_RASTERS (gzip, JSON lines: the render environment first, then one glyph per line, then one writing record
// per line, each list in the order given).
import { readFileSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const BATCH = 200
const SCAN = 500

export default async function ({ evaluate, load, send }) {
  const chars = JSON.parse(readFileSync(process.env.SERIF_CHARS, 'utf8'))
  const scan = JSON.parse(readFileSync(process.env.SERIF_WRITING, 'utf8'))
  await load('/tools/v2/serif-ink/page.html', 800, 600)
  const version = (await send('Browser.getVersion')).result
  const commandLine = (await send('Browser.getBrowserCommandLine')).result?.arguments ?? null
  const glyphs = []
  for (let i = 0; i < chars.length; i += BATCH) {
    const got = await evaluate(`window.serifInkRender.glyphs(${JSON.stringify(chars.slice(i, i + BATCH))})`)
    if (!Array.isArray(got)) throw new Error(`measure failed at ${i}`)
    for (const g of got) glyphs.push(JSON.stringify(g))
  }
  const writing = []
  for (let i = 0; i < scan.length; i += SCAN) {
    const got = await evaluate(`window.serifInkRender.writing(${JSON.stringify(scan.slice(i, i + SCAN))})`)
    if (!Array.isArray(got)) throw new Error(`writing scan failed at ${i}`)
    for (const g of got) writing.push(JSON.stringify(g))
  }
  const faces = await evaluate('window.serifInkRender.faces()')
  const head = JSON.stringify({ browser: version, commandLine, faces, measured: chars.length, scanned: scan.length })
  writeFileSync(process.env.SERIF_RASTERS, gzipSync(Buffer.from([head, ...glyphs, '--writing--', ...writing].join('\n') + '\n'), { level: 9 }))
  return { measured: chars.length, scanned: scan.length, browser: version?.product, fetched: faces?.fetched?.length }
}
