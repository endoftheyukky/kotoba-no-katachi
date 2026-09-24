// npm run verify — serve the repository with Vite, draw the public regression
// fixture in headless Chrome (tools/verify/fixture.mjs), compare it with
// tools/verify/expected.json, and exit 1 on any difference.
//
//   npm run verify             check
//   npm run verify:write       rewrite expected.json (only when a new version is published)
//   npm run verify:snapshots   check the same pages' snapshots against the archive's limits (tools/verify/snapshots.mjs)
//   CHROME=/path/to/chrome     the browser to use (default: the usual install path)
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'

const port = Number(process.env.PORT ?? 5199)
// the browser's profile lives outside the repository, where the dev server does not watch
const profile = mkdtempSync(join(tmpdir(), 'kotoba-verify-'))
const server = await createServer({ server: { port, strictPort: true, host: '127.0.0.1', watch: null }, logLevel: 'error' })
await server.listen()
// npm run verify:snapshots draws the same pages to check the archive's snapshot limits instead
const script = process.argv.includes('snapshots') ? 'tools/verify/snapshots.mjs' : 'tools/verify/fixture.mjs'
const child = spawn(process.execPath, ['tools/verify/cdp.mjs', `http://127.0.0.1:${port}`, profile, script], {
  stdio: 'inherit',
  env: { ...process.env, MODE: process.argv.includes('--write') ? 'write' : 'check' },
})
const code = await new Promise((resolve) => child.on('exit', (c) => resolve(c ?? 1)))
await server.close()
// the browser may still hold its profile for a moment after it is closed
try {
  rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
} catch {
  // left in the system's temporary directory
}
process.exit(code)
