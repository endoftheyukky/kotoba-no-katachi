// Minimal Chrome DevTools Protocol driver.
//
//   node tools/verify/cdp.mjs <base-url> <out-dir> <script.mjs>
//
// Opens headless Chrome (or Chromium), gives the script a few helpers to drive
// a page of the site served at <base-url>, and prints the script's result with
// any console errors as JSON. The browser is the one in $CHROME, or the usual
// install path for this platform. A script may return { exitCode } to fail.
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const base = process.argv[2]
// Chrome takes its profile directory as an absolute path
const out = resolve(process.argv[3])
mkdirSync(out, { recursive: true })
const chrome =
  process.env.CHROME ??
  {
    win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  }[process.platform] ??
  'google-chrome'
const port = 9333
const proc = spawn(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${join(out, 'prof-cdp')}`, 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let targets
for (let i = 0; i < 150; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.find((t) => t.type === 'page')) break } catch {}
  await sleep(200)
}
const page = targets.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r, { once: true }))
let id = 0
const pending = new Map()
const errors = []
ws.addEventListener('message', (m) => {
  const msg = JSON.parse(m.data)
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '))
  if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text)
  if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') errors.push(`${msg.params.entry.source}: ${msg.params.entry.text} ${msg.params.entry.url ?? ''}`)
})
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable')

const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true })).result?.result?.value
const until = async (expr, ms = 15000) => { for (let t = 0; t < ms; t += 100) { if (await evaluate(expr)) return true; await sleep(100) } return false }

const scenes = (await import(pathToFileURL(process.argv[4]).href)).default
const results = {}
// a script instead of scenes: it drives the page itself with these helpers
if (typeof scenes === 'function') {
  const load = async (url, w = 1280, h = 800) => {
    const mobile = w < 768
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile })
    await send('Emulation.setTouchEmulationEnabled', { enabled: mobile })
    await send('Page.navigate', { url: base + url })
    await sleep(300)
    await until(`document.readyState === 'complete' && document.body.dataset.state !== 'working' && document.fonts.status === 'loaded'`)
    await sleep(300)
  }
  const click = async (x, y) => {
    for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 })
    await sleep(150)
  }
  const at = async (sel) => evaluate(`(() => { const b = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2] })()`)
  const key = async (k, code = k, keyCode = 0, mods = 0) => {
    // Enter carries its character, as a real key does (buttons act on it)
    const down = k === 'Enter' ? { type: 'keyDown', text: '\r', unmodifiedText: '\r' } : { type: 'rawKeyDown' }
    await send('Input.dispatchKeyEvent', { ...down, key: k, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, modifiers: mods })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: keyCode, modifiers: mods })
    await sleep(150)
  }
  const shot = async (name) => {
    const s = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(out, `${name}.png`), Buffer.from(s.result.data, 'base64'))
  }
  const log = await scenes({ send, evaluate, until, sleep, load, click, at, key, shot })
  console.log(JSON.stringify({ log, errors }, null, 1))
  ws.close(); proc.kill(); process.exit(log?.exitCode ?? 0)
}
for (const s of scenes) {
  const [w, h] = s.size
  const mobile = w < 768
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: s.dpr ?? 1, mobile })
  await send('Emulation.setTouchEmulationEnabled', { enabled: mobile })
  if (s.url) {
    await send('Page.navigate', { url: base + s.url })
    await until(`document.readyState === 'complete' && document.body.dataset.state !== 'working' && document.fonts.status === 'loaded'`)
    await sleep(400)
  }
  if (s.run) results[s.name] = await evaluate(`(async () => { ${s.run} })()`)
  await sleep(s.wait ?? 300)
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(out, `${s.name}.png`), Buffer.from(shot.result.data, 'base64'))
}
console.log(JSON.stringify({ results, errors }, null, 1))
ws.close()
proc.kill()
process.exit(0)
