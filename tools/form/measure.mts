// Measure dumped drafts (drafts.mjs) in node, with the repository's own measure module.
// node --import ./tools/form/ts-register.mjs tools/form/measure.mts <drafts.json> <profiles.json>
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const [src, out] = process.argv.slice(2)
const repo = fileURLToPath(new URL('../..', import.meta.url))
const { measureForm } = await import(pathToFileURL(`${repo}/src/poem/form/measure.ts`).href)
const pages = JSON.parse(readFileSync(src, 'utf8')).log.filter((p: any) => !p.error)
const t0 = performance.now()
const log = pages.map((p: any) => {
  const marks = p.marks.map((k: any) => ({
    char: k.c,
    x: k.x,
    y: k.y,
    size: k.s,
    rotate: k.r,
    keep: k.keep,
    minus: k.minus ? { char: '', dx: 0, dy: 0, scale: 1 } : undefined,
    role: k.role,
    grapheme: k.g,
    context: !!k.ctx,
  }))
  const f = measureForm(marks)
  const { marks: _, ...rest } = p
  return { ...rest, profile: f.profile, extra: f.extra }
})
writeFileSync(out, JSON.stringify({ log }))
console.log(`${log.length} pages measured in ${(performance.now() - t0).toFixed(0)} ms`)
