// Development only: the v2 evaluation pages (spec-1 §16 stage 9: look at the pages, not only the tests).
//   node tools/v2/eval.mjs [out-dir]     default node_modules/.cache/v2-eval
// Serves the repository with Vite, composes the evaluation set in headless Chrome, writes each page, contact
// sheets with what decided each, and a summary. The benchmark lists here are for looking only; nothing in src/
// reads them.
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'vite'
import { STUDY_TITLES } from '../../src/study/titles.ts'
import { HOLDOUT_TITLES } from '../../src/study/holdout.ts'
import { PROBE_TITLES } from '../../src/study/probes.ts'
import { DIFFICULT_WORDS, EDGE_TITLES } from '../../src/study/difficult.ts'

const out = resolve(process.argv[2] ?? 'node_modules/.cache/v2-eval')
mkdirSync(out, { recursive: true })
const sets = {
  benchmark: [...'雨闇淋林州血囚辻悲'].map((text) => ({ text })),
  controls: [...'海問品森玉晶轟好男国閣日'].map((text) => ({ text })),
  boundary: [...'琳田回魁噴虜看'].map((text) => ({ text })),
  public: [...STUDY_TITLES, ...HOLDOUT_TITLES, ...PROBE_TITLES, ...DIFFICULT_WORDS, ...EDGE_TITLES].map((t) => ({ text: t.text, ...(t.reading ? { reading: t.reading } : {}) })),
}
const work = mkdtempSync(join(tmpdir(), 'kotoba-v2-eval-'))
writeFileSync(join(work, 'titles.json'), JSON.stringify(sets))
const port = Number(process.env.PORT ?? 5197)
const server = await createServer({ server: { port, strictPort: true, host: '127.0.0.1', watch: null }, logLevel: 'error' })
await server.listen()
const child = spawn(process.execPath, ['tools/verify/cdp.mjs', `http://127.0.0.1:${port}`, work, 'tools/v2/eval/render.mjs'], { stdio: 'inherit', env: { ...process.env, EVAL_TITLES: join(work, 'titles.json'), EVAL_OUT: out } })
const code = await new Promise((r) => child.on('exit', (c) => r(c ?? 1)))
await server.close()
try { rmSync(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }) } catch {}
process.exit(code)
