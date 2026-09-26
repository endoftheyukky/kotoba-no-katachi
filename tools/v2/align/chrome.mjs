// Build time only: serve the repository with Vite and run tools/v2/align/render.mjs in headless Chrome
// through tools/verify/cdp.mjs (the same driver and browser as npm run verify).
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'

export async function renderRasters(chars, rastersPath, port = Number(process.env.PORT ?? 5198)) {
  const work = mkdtempSync(join(tmpdir(), 'kotoba-align-'))
  const charsPath = join(work, 'chars.json')
  writeFileSync(charsPath, JSON.stringify(chars))
  const server = await createServer({ server: { port, strictPort: true, host: '127.0.0.1', watch: null }, logLevel: 'error' })
  await server.listen()
  let out = ''
  const child = spawn(process.execPath, ['tools/verify/cdp.mjs', `http://127.0.0.1:${port}`, work, 'tools/v2/align/render.mjs'], {
    stdio: ['ignore', 'pipe', 'inherit'],
    env: { ...process.env, ALIGN_CHARS: charsPath, ALIGN_RASTERS: rastersPath },
  })
  child.stdout.on('data', (d) => (out += d))
  const code = await new Promise((resolve) => child.on('exit', (c) => resolve(c ?? 1)))
  await server.close()
  try {
    rmSync(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
  } catch {
    // left in the system's temporary directory
  }
  const report = JSON.parse(out || '{}')
  if (code !== 0 || report.errors?.length) throw new Error(`render failed (${code}): ${JSON.stringify(report.errors ?? out)}`)
  return report.log
}
