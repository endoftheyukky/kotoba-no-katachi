// Build time only: the rasters written by tools/v2/align/render.mjs, and their fingerprint.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

export function readRasters(path) {
  const lines = gunzipSync(readFileSync(path)).toString('utf8').trim().split('\n')
  const head = JSON.parse(lines[0])
  const measured = new Map()
  for (const l of lines.slice(1)) {
    const m = JSON.parse(l)
    measured.set(m.c, m)
  }
  // what was measured, as measured: independent of the browser's own version string
  const sha256 = createHash('sha256').update(lines.slice(1).join('\n')).digest('hex')
  return { head, measured, sha256 }
}
