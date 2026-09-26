// Build time only: fits a share of align-1's entries (tools/v2/align.mjs runs several of these at once).
// Each entry depends only on its own structure and the rasters, so the table does not depend on how
// the characters were shared out.
import { parentPort, workerData } from 'node:worker_threads'
import { alignEntry } from '../../../src/v2/align/build/build.ts'
import { glyphOf } from '../../../src/v2/align/build/raster.ts'
import { readRasters } from './rasters.mjs'

const { rastersPath, entries } = workerData
const { measured } = readRasters(rastersPath)
const glyphs = new Map()
const glyph = (c) => {
  if (!glyphs.has(c)) {
    const m = measured.get(c)
    glyphs.set(c, m?.covered ? glyphOf(m) : null)
  }
  return glyphs.get(c)
}
const out = []
for (const e of entries) {
  const t = performance.now()
  out.push({ entry: alignEntry(e, glyph, (c) => measured.get(c)), ms: performance.now() - t })
}
parentPort.postMessage(out)
