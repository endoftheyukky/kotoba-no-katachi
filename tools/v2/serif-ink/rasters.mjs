// Build time only: the rasters written by tools/v2/serif-ink/render.mjs, and their fingerprints.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

export function readSerifRasters(path) {
  const lines = gunzipSync(readFileSync(path)).toString('utf8').trim().split('\n')
  const head = JSON.parse(lines[0])
  const cut = lines.indexOf('--writing--')
  const glyphLines = lines.slice(1, cut)
  const writingLines = lines.slice(cut + 1)
  const measured = new Map()
  for (const l of glyphLines) {
    const m = JSON.parse(l)
    measured.set(m.c, m)
  }
  const writing = writingLines.map((l) => JSON.parse(l))
  // what was measured, as measured: independent of the browser's own version string
  const sha256 = createHash('sha256').update(glyphLines.join('\n')).digest('hex')
  const writingSha256 = createHash('sha256').update(writingLines.join('\n')).digest('hex')
  return { head, measured, writing, sha256, writingSha256 }
}
