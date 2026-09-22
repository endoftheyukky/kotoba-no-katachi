#!/usr/bin/env node
/**
 * The admin password, set without it ever leaving this terminal.
 *
 *   npm run admin:password   asks for a password (hidden, twice), and puts two
 *                            Cloudflare secrets on the Pages project:
 *                              ADMIN_PASSWORD_HASH  PBKDF2-SHA256 of it (salted)
 *                              SESSION_SECRET       new random bytes (ends old sessions)
 *                            then offers to redeploy the current build (dist/)
 *                            so that they take effect.
 *   npm run admin:local      the same for `npm run dev:archive`: writes .dev.vars
 *                            (git-ignored) with a random local password, shown once.
 *
 * The password itself is stored nowhere: not in the repository, not on
 * Cloudflare, not in any file.
 */
import { execSync, spawn } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { pbkdf2Sync, randomBytes } from 'node:crypto'
import readline from 'node:readline'

const PROJECT = 'kotoba-no-katachi'
/** the Workers free plan allows ~10 ms of CPU per request; 10 000 rounds take ~4 ms */
const ITERATIONS = 10_000
const MIN_LENGTH = 12

const hashOf = (password) => {
  const salt = randomBytes(16)
  const hash = pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256')
  return `pbkdf2:sha256:${ITERATIONS}:${salt.toString('base64')}:${hash.toString('base64')}`
}
const sessionSecret = () => randomBytes(32).toString('base64')

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    if (hidden) {
      rl._writeToOutput = (s) => {
        if (s.includes(question)) rl.output.write(question)
      }
    }
    rl.question(question, (answer) => {
      rl.close()
      if (hidden) process.stdout.write('\n')
      resolve(answer)
    })
  })
}

function putSecret(name, value) {
  return new Promise((resolve, reject) => {
    const p = spawn('npx', ['--yes', 'wrangler@4', 'pages', 'secret', 'put', name, '--project-name', PROJECT], {
      shell: true,
      stdio: ['pipe', 'inherit', 'inherit'],
    })
    p.stdin.end(value)
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`wrangler exited with ${code}`))))
  })
}

if (process.argv.includes('--local')) {
  const password = randomBytes(12).toString('base64url')
  writeFileSync('.dev.vars', `# local only (git-ignored): npm run admin:local\nADMIN_PASSWORD_HASH="${hashOf(password)}"\nSESSION_SECRET="${sessionSecret()}"\n`)
  console.log(`.dev.vars written. Local admin password (for http://localhost:8788/admin only): ${password}`)
  process.exit(0)
}

console.log(`Admin password for ${PROJECT}.pages.dev/admin — at least ${MIN_LENGTH} characters. It is not shown and not stored.`)
const first = await ask('Password: ', true)
if (first.length < MIN_LENGTH) {
  console.error(`Too short: at least ${MIN_LENGTH} characters.`)
  process.exit(1)
}
const again = await ask('Again:    ', true)
if (again !== first) {
  console.error('The two did not match. Nothing was changed.')
  process.exit(1)
}

await putSecret('ADMIN_PASSWORD_HASH', hashOf(first))
await putSecret('SESSION_SECRET', sessionSecret())
console.log('Both secrets are set on Cloudflare.')

if (!existsSync('dist/admin/index.html') || !existsSync('dist/_routes.json')) {
  console.log('No build in dist/. Build and deploy (docs/archive.md) for the password to take effect.')
  process.exit(0)
}
const yes = (await ask('Redeploy the current build now so the password takes effect? [Y/n] ')).trim().toLowerCase()
if (yes && yes !== 'y' && yes !== 'yes') {
  console.log('Not redeployed. The password takes effect with the next deploy.')
  process.exit(0)
}
const commit = execSync('git rev-parse HEAD').toString().trim()
const deploy = spawn(
  'npx',
  ['--yes', 'wrangler@4', 'pages', 'deploy', 'dist', '--project-name', PROJECT, '--branch', 'release', '--commit-hash', commit, '--commit-dirty=true'],
  { shell: true, stdio: 'inherit' },
)
deploy.on('exit', (code) => {
  if (code === 0) console.log(`Done. Log in at https://${PROJECT}.pages.dev/admin/`)
  process.exit(code ?? 1)
})
