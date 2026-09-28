// serif-ink-1: the writing face's fixed observations for the serif-aware typography (B3a), after Stage 11.
//
//   npm run v2:serif-ink                  on the canonical environment only: check it, measure Noto Serif JP 300 in
//                                         headless Chrome, fit, serialise, hash, write public/v2/serif-ink-1, check it
//   npm run v2:serif-ink -- --check       the same, and compare with public/v2/serif-ink-1 byte for byte (nothing written)
//   npm run v2:serif-ink -- --reuse       fit from the last render's rasters (node_modules/.cache/v2-serif-ink) instead
//                                         of measuring again (its environment is checked as a new render's is)
//   CHROME=/path/to/chrome                the browser (as npm run verify)
//
//   --noncanonical --out <dir>            anywhere else (a Cloud container, another OS or browser): the same steps,
//                                         written to <dir> outside public/ with "canonical": false, which the runtime
//                                         refuses. For checking the tool, never for publishing. --chars <text> limits
//                                         the domain to those characters (and the writing scan to them).
//
// The canonical environment (SwoN, 2026-09-27; as align-1 was made): Windows, Chrome / HeadlessChrome 153 through
// tools/verify/cdp.mjs, @fontsource/noto-serif-jp 5.3.0 at weight 300 (its files checked against the pins below),
// device pixel ratio 1. Anything else stops the command before a file is written.
//
// Inputs: structure-1 as published (its sha256 is checked), the writing face as bundled, the reading face as bundled
// (only where the serif draws a declared character empty: v1 writable), and the browser's rendering through v1's own
// measure. align-1 and resonance-1 are not read, only checked unchanged. Nothing else: no network, no fixture.
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { arch, cpus, platform, release, tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { Worker } from 'node:worker_threads'
import { createServer } from 'vite'
import { FACES } from '../../src/glyph/font.ts'
import { ALIGN } from '../../src/v2/align/constants.ts'
import { alignEntry, TOOL_VERSION as FIT_VERSION } from '../../src/v2/align/build/build.ts'
import { glyphOf } from '../../src/v2/align/build/raster.ts'
import { countStatus, declared, projectEntry, rangesOf, rasterOf } from '../../src/v2/serif/build/project.ts'
import { serifInkIndex } from '../../src/v2/serif/lookup.ts'
import { canonical, shardText } from '../../src/v2/structure/build/serialize.ts'
import { charsToMeasure, readFont as readReadingFont, readStructure, SHARDS } from './align.mjs'
import { readSerifRasters } from './serif-ink/rasters.mjs'

export const TOOL_VERSION = '1'
const OUT = 'public/v2/serif-ink-1'
const FONT_DIR = 'node_modules/@fontsource/noto-serif-jp'
const CACHE_DIR = 'node_modules/.cache/v2-serif-ink'

/** the canonical environment: the table is made here or not at all */
export const CANONICAL = { os: 'win32', browserMajor: 153, family: 'Noto Serif JP', weight: 300, package: '@fontsource/noto-serif-jp', version: '5.3.0', devicePixelRatio: 1 }

/** the writing face as bundled: another package version or other bytes is another table */
export const PINNED_SERIF = {
  version: '5.3.0',
  css: '7fb5bd021a3b8bee9ab546c703253ef786e603bc91c8a5262411aa84271d5e01',
  files: '178773268380dfc136af6ead9781202bd1c7b0ded2c9a70b8c9a0889d633687e',
}

/** the fixed tables as published: read (structure-1) or only checked unchanged (align-1, resonance-1), never written */
export const FIXED = {
  'structure-1': '9e60d412d42dc87f98673cf89e2ff17768eb5a01dff7ab9b640b3143b300b83f',
  'align-1': 'f5941ff8f686b47678bfe343e5de92c53bae2f39e36041db4d0d5b7432781720',
  'resonance-1': '5e445f42ff147b360e61606dde2c00bf0f094e3f9364268a14f2573799b3a5a8',
}

const sha = (b) => createHash('sha256').update(b).digest('hex')
const arg = (name) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const byCodePoint = (a, b) => a.codePointAt(0) - b.codePointAt(0)
const pad = (i) => `${String(i).padStart(2, '0')}.json`

/** a fixed table as published: every shard is the file its manifest names, and the shards make the table's sha256 */
export function tableSha(id, root = 'public/v2') {
  const dir = join(root, id)
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
  for (const f of manifest.shards.files) if (sha(readFileSync(join(dir, f.name))) !== f.sha256) throw new Error(`${id}: ${f.name} is not the file its manifest names`)
  const joined = sha(manifest.shards.files.map((f) => f.sha256).join(''))
  if (joined !== manifest.sha256) throw new Error(`${id}: its shards do not make its sha256`)
  return manifest.sha256
}

/** every fixed table as pinned (problems, empty when all hold) */
export function fixedTables(root = 'public/v2') {
  const problems = []
  for (const [id, want] of Object.entries(FIXED)) {
    try {
      const got = tableSha(id, root)
      if (got !== want) problems.push(`${id} is ${got}, not the published ${want}: fixed data is never regenerated`)
    } catch (e) {
      problems.push(String(e.message ?? e))
    }
  }
  return problems
}

/** the writing face as bundled, checked against the pins */
export function readSerifFont(dir = FONT_DIR) {
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8')).packages[`node_modules/${CANONICAL.package}`]
  const cssFile = `${CANONICAL.weight}.css`
  const css = readFileSync(join(dir, cssFile))
  const names = readdirSync(join(dir, 'files')).filter((n) => n.endsWith(`-${CANONICAL.weight}-normal.woff2`)).sort()
  const list = names.map((n) => `${n} ${sha(readFileSync(join(dir, 'files', n)))}`).join('\n')
  const font = {
    family: CANONICAL.family,
    weight: CANONICAL.weight,
    style: 'normal',
    package: { name: pkg.name, version: pkg.version, integrity: lock?.integrity ?? null, license: lock?.license ?? null },
    css: { file: cssFile, sha256: sha(css) },
    files: { count: names.length, format: 'woff2', sha256: sha(list) },
  }
  const problems = []
  if (pkg.name !== CANONICAL.package) problems.push(`the package is ${pkg.name}`)
  if (pkg.version !== PINNED_SERIF.version) problems.push(`${CANONICAL.package} is ${pkg.version}, not ${PINNED_SERIF.version}`)
  if (font.css.sha256 !== PINNED_SERIF.css) problems.push(`${cssFile} is not the pinned one (${font.css.sha256})`)
  if (font.files.sha256 !== PINNED_SERIF.files) problems.push(`the ${CANONICAL.weight} font files are not the pinned ones (${font.files.sha256})`)
  if (FACES.serif.name !== CANONICAL.family || FACES.serif.weight !== CANONICAL.weight) problems.push(`the site's writing face is ${FACES.serif.name} ${FACES.serif.weight}, not ${CANONICAL.family} ${CANONICAL.weight}`)
  if (problems.length) throw new Error(`the writing face is not the pinned one: ${problems.join('; ')} (a new face is a new table)`)
  return { font, css: css.toString('utf8') }
}

/**
 * Whether an environment is the canonical one (problems, empty when it is). `found`: the OS (node's platform), the
 * browser as it names itself (Browser.getVersion), and the page's device pixel ratio and declared faces.
 */
export function checkEnvironment(found) {
  const problems = []
  if (found.os !== CANONICAL.os) problems.push(`the OS is ${found.os}, not Windows (${CANONICAL.os})`)
  if (found.browser !== undefined) {
    const major = Number(/(?:Headless)?Chrome\/(\d+)\./.exec(found.browser ?? '')?.[1])
    if (major !== CANONICAL.browserMajor) problems.push(`the browser is ${found.browser}, not Chrome ${CANONICAL.browserMajor}`)
    if (!/HeadlessChrome\//.test(found.userAgent ?? '')) problems.push(`the browser is not headless Chrome (${found.userAgent})`)
    if (found.devicePixelRatio !== CANONICAL.devicePixelRatio) problems.push(`the device pixel ratio is ${found.devicePixelRatio}, not ${CANONICAL.devicePixelRatio}`)
    if (!(found.declared > 0) || found.loaded !== found.declared) problems.push(`the page declared ${found.declared} faces of ${CANONICAL.family} ${CANONICAL.weight} and loaded ${found.loaded}`)
  }
  return problems
}

async function renderSerif(chars, scan, rastersPath, port = Number(process.env.PORT ?? 5199)) {
  const work = mkdtempSync(join(tmpdir(), 'kotoba-serif-ink-'))
  writeFileSync(join(work, 'chars.json'), JSON.stringify(chars))
  writeFileSync(join(work, 'scan.json'), JSON.stringify(scan))
  const server = await createServer({ server: { port, strictPort: true, host: '127.0.0.1', watch: null }, logLevel: 'error' })
  await server.listen()
  let out = ''
  const child = spawn(process.execPath, ['tools/verify/cdp.mjs', `http://127.0.0.1:${port}`, work, 'tools/v2/serif-ink/render.mjs'], {
    stdio: ['ignore', 'pipe', 'inherit'],
    env: { ...process.env, SERIF_CHARS: join(work, 'chars.json'), SERIF_WRITING: join(work, 'scan.json'), SERIF_RASTERS: rastersPath },
  })
  child.stdout.on('data', (d) => (out += d))
  const code = await new Promise((r) => child.on('exit', (c) => r(c ?? 1)))
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

async function fitAll(entries, rastersPath, workers) {
  const buckets = Array.from({ length: workers }, () => [])
  entries.forEach((e, i) => buckets[i % workers].push(e))
  const results = await Promise.all(
    buckets.map(
      (b) =>
        new Promise((res, rej) => {
          const w = new Worker(new URL('./serif-ink/worker.mjs', import.meta.url), { workerData: { rastersPath, entries: b } })
          w.once('message', res)
          w.once('error', rej)
        }),
    ),
  )
  return results.flat()
}

const RULES = {
  responsibility: 'structure-1 says what exists; align-1 where it stands in the reading face (Noto Sans JP 500); serif-ink-1 only what the writing face (Noto Serif JP 300) draws. A row is keyed by structure-1\'s tree and never says a component exists; serif-ink-1 is not a structure source and changes no Discovery, Selection or Plan',
  domain: 'every structure-1 entry (the characters align-1 has entries for), fitted or not; a character outside it is not observed in the serif, and B3a keeps its structure in the reading face',
  measure: 'v1 src/glyph/metrics.ts measure, unchanged, in the writing face (200 px per em on a 600 px canvas; box alpha > 8; ink alpha > 127; density: alpha over the em square), in headless Chrome, as the site measures',
  fit: 'align-1\'s own builder (src/v2/align/build alignEntry) with align-1\'s constants unchanged (calibrated on Noto Sans JP 500), run on the writing face\'s rasters of the entry and of every component structure-1 names; islands, alike and crossings are not read',
  projection: 'kept: the v1 measure of the glyph (half, density), the whole as the fit records it (only a fitted entry has one, as in align-1), and each direct leaf row (depth 1): path, index, node, operator, status and reasons, transform, box, ink (explained, precision, lift, shared), confidence, and the residual\'s share, box, centroid and pieces\' centroids. Not kept: nested and subtree rows, islands, alike, crossings, unexplained ink, regions (src/v2/serif/build/project.ts)',
  raster: 'the v1 ink raster (alpha > 127) of every entry the writing face draws, one bit per pixel, row-major, base64; entry.raster is the sha256 of the raster record\'s canonical text (the glyph\'s fingerprint). v1 relate reads it for the serif relation between two of a title\'s characters',
  writing: 'v1 poem/face.ts writable for every code point the face\'s CSS declares (blank space excepted): unwritable when the serif draws it empty and the reading face draws ink; emptyInBoth when neither draws ink (v1 counts it written)',
  order: 'entries and rasters by code point in 64 shards each (code point mod 64); rows in the tree\'s path order',
  canonical: 'made on Windows in Chrome / HeadlessChrome 153 with @fontsource/noto-serif-jp 5.3.0 at weight 300 (pinned bytes), device pixel ratio 1; anything else is refused before a file is written, or marked canonical: false (never read at run time)',
}

/** serif-ink-1's files from the rasters of a render: pure given the rasters and structure-1 */
export async function build({ canonicalRun, reuse = false, only = null, workers = Math.max(1, cpus().length - 2), log = () => {} } = {}) {
  const t0 = performance.now()
  const problems = []
  // 1. the environment, before anything is measured
  const nodeEnv = { os: platform(), arch: arch(), release: release(), node: process.version }
  if (canonicalRun) problems.push(...checkEnvironment({ os: nodeEnv.os }))
  // 2. the fixed tables, unchanged; the faces, pinned
  problems.push(...fixedTables())
  let serif
  let reading
  try {
    serif = readSerifFont()
  } catch (e) {
    problems.push(String(e.message ?? e))
  }
  try {
    reading = readReadingFont()
  } catch (e) {
    problems.push(String(e.message ?? e))
  }
  if (problems.length) throw Object.assign(new Error(`stopped before measuring:\n  ${problems.join('\n  ')}`), { problems })
  const structure = readStructure()
  const inDomain = only ? structure.entries.filter((e) => only.has(e.char)) : structure.entries
  if (only && canonicalRun) throw new Error('--chars is for a non-canonical check of the tool only')
  const fitChars = charsToMeasure(inDomain)
  const declaredCps = declared(serif.css)
  const scan = declaredCps.map((c) => String.fromCodePoint(c)).filter((c) => c.trim() && (!only || only.has(c)))
  // 3. the render (v1 measure in headless Chrome)
  mkdirSync(CACHE_DIR, { recursive: true })
  const cache = join(CACHE_DIR, only ? 'rasters-partial.jsonl.gz' : 'rasters.jsonl.gz')
  const tr = performance.now()
  if (!reuse || !existsSync(cache)) {
    log(`measuring ${fitChars.length} glyphs and scanning ${scan.length} declared code points in the writing face …`)
    await renderSerif(fitChars, scan, cache)
  }
  const renderMs = performance.now() - tr
  const rasters = readSerifRasters(cache)
  const head = rasters.head
  const found = {
    os: nodeEnv.os,
    arch: nodeEnv.arch,
    node: nodeEnv.node,
    browser: head.browser?.product ?? '',
    userAgent: head.browser?.userAgent ?? '',
    devicePixelRatio: head.faces?.dpr,
    declared: head.faces?.serif?.declared,
    loaded: head.faces?.serif?.loaded,
  }
  const envProblems = checkEnvironment(found)
  if (canonicalRun && envProblems.length) throw Object.assign(new Error(`not the canonical environment:\n  ${envProblems.join('\n  ')}`), { problems: envProblems })
  const missing = fitChars.filter((c) => !rasters.measured.has(c))
  if (missing.length) throw new Error(`the rasters lack ${missing.join('')}: render again`)
  if (rasters.writing.length !== scan.length || rasters.writing.some((w, i) => w.c !== scan[i])) throw new Error('the writing scan is not the declared code points: render again')
  // 4. the fit (align-1's builder on the serif's rasters), projected
  log(`fitting ${inDomain.length} entries on ${workers} workers …`)
  const tf = performance.now()
  const fitted = await fitAll(inDomain, cache, workers)
  const fitMs = performance.now() - tf
  const rasterRecords = new Map()
  const entries = new Map()
  for (const f of fitted) {
    const c = f.entry.char
    const m = rasters.measured.get(c)
    const r = rasterOf(m)
    if (r) rasterRecords.set(c, r)
    entries.set(c, projectEntry(f.entry, m, r ? sha(canonical(r)) : undefined))
  }
  // 5. canonical serialisation: shards by code point mod 64, keys sorted, one entry per line
  const shardsOf = (map) => Array.from({ length: SHARDS }, (_, i) => [pad(i), shardText(new Map([...map].filter(([c]) => c.codePointAt(0) % SHARDS === i)))])
  const entryShards = shardsOf(entries)
  const rasterShards = shardsOf(rasterRecords)
  const fileOf = (dir, [name, text]) => ({ name: `${dir}/${name}`, entries: [...text.matchAll(/^"/gm)].length, bytes: Buffer.byteLength(text), sha256: sha(Buffer.from(text)) })
  const entryFiles = entryShards.map((s) => fileOf('entries', s))
  const rasterFiles = rasterShards.map((s) => fileOf('rasters', s))
  const unwritable = rasters.writing.filter((w) => w.serif === 0 && w.sans === 1).map((w) => w.c).sort(byCodePoint)
  const emptyInBoth = rasters.writing.filter((w) => w.serif === 0 && w.sans !== 1).map((w) => w.c).sort(byCodePoint)
  const writing = { ranges: rangesOf(declaredCps), codePoints: declaredCps.length, measured: scan.length, unwritable, emptyInBoth }
  const writingText = canonical(writing) + '\n'
  const writingFile = { file: 'writing.json', bytes: Buffer.byteLength(writingText), sha256: sha(Buffer.from(writingText)), codePoints: writing.codePoints, unwritable: unwritable.length, emptyInBoth: emptyInBoth.length }
  const counts = countStatus(entries.values())
  // 6. hashes and the manifest
  const cdp = readFileSync('tools/verify/cdp.mjs', 'utf8')
  const flags = [...(/spawn\(chrome, \[([^\]]*)\]/.exec(cdp)?.[1] ?? '').matchAll(/'(--[a-z-]+(?:=[a-z]+)?)'/g)].map((m) => m[1])
  const fitSources = ['build.ts', 'fit.ts', 'raster.ts', 'regions.ts', 'residual.ts', 'ink.ts'].map((f) => `${f} ${sha(readFileSync(join('src/v2/align/build', f)))}`).join('\n')
  const canonicalOk = canonicalRun && !envProblems.length
  const manifest = {
    id: 'serif-ink-1',
    spec: 'spec-1',
    schema: 1,
    canonical: canonicalOk,
    generator: {
      tool: 'tools/v2/serif-ink.mjs',
      version: TOOL_VERSION,
      fit: { module: 'src/v2/align/build', version: FIT_VERSION, sha256: sha(fitSources) },
      project: { module: 'src/v2/serif/build/project.ts', sha256: sha(readFileSync('src/v2/serif/build/project.ts')) },
    },
    face: 'serif-ink-1 holds for this face only: another font, package version, weight, measure or browser is a new table (serif-ink-2 …)',
    font: { ...serif.font, fetched: head.faces?.fetched ?? [] },
    readingFont: reading,
    render: {
      browser: { product: head.browser?.product ?? '', revision: head.browser?.revision ?? '', userAgent: head.browser?.userAgent ?? '', jsVersion: head.browser?.jsVersion ?? '' },
      launcher: { file: 'tools/verify/cdp.mjs', sha256: sha(cdp), flags },
      page: { file: 'tools/v2/serif-ink/page.ts', sha256: sha(readFileSync('tools/v2/serif-ink/page.ts')) },
      measure: { module: 'src/glyph/metrics.ts', sha256: sha(readFileSync('src/glyph/metrics.ts')), pxPerEm: 200, canvas: 600, ink: 'alpha > 127', box: 'alpha > 8' },
      devicePixelRatio: head.faces?.dpr,
      antialiasing: 'canvas 2D fillText, the browser\'s default (greyscale) antialiasing, software rendering (--disable-gpu)',
      platform: { os: `${nodeEnv.os} ${nodeEnv.release}`, arch: nodeEnv.arch },
      rasters: { glyphs: rasters.measured.size, notInFace: [...rasters.measured.values()].filter((m) => !m.covered).map((m) => m.c), sha256: rasters.sha256, writing: rasters.writingSha256 },
    },
    environment: {
      required: { os: 'Windows (win32)', browser: `Chrome / HeadlessChrome ${CANONICAL.browserMajor}`, font: `${CANONICAL.package} ${CANONICAL.version}`, weight: CANONICAL.weight, devicePixelRatio: CANONICAL.devicePixelRatio },
      found: { os: `${nodeEnv.os} ${nodeEnv.release}`, arch: nodeEnv.arch, node: nodeEnv.node, browser: found.browser, userAgent: found.userAgent, devicePixelRatio: found.devicePixelRatio },
      ...(envProblems.length ? { problems: envProblems } : {}),
    },
    inputs: {
      structure: { id: 'structure-1', sha256: structure.manifest.sha256 },
      unchanged: [{ id: 'align-1', sha256: FIXED['align-1'] }, { id: 'resonance-1', sha256: FIXED['resonance-1'] }],
    },
    constants: ALIGN,
    rules: RULES,
    serialization: 'src/v2/structure/build/serialize.ts: object keys sorted by UTF-16 code unit, no whitespace inside an entry, one entry per line, entries by code point; numbers as JSON.stringify writes them; UTF-8, LF',
    domain: { of: only ? `structure-1 entries among --chars (${[...only].join('')})` : 'every structure-1 entry', entries: entries.size, rasters: rasterRecords.size },
    shards: { count: SHARDS, of: 'code point mod 64', entries: entryFiles, rasters: rasterFiles },
    writing: writingFile,
    status: counts.status,
    rows: counts.rows,
    sha256: sha([...entryFiles, ...rasterFiles].map((f) => f.sha256).join('') + writingFile.sha256),
  }
  const files = new Map([...entryShards.map(([n, t]) => [`entries/${n}`, t]), ...rasterShards.map(([n, t]) => [`rasters/${n}`, t])])
  files.set('writing.json', writingText)
  files.set('manifest.json', canonical(manifest) + '\n')
  files.set('NOTICE.txt', [
    'serif-ink-1 — what the writing face draws, for the serif-aware typography (B3a) of generator v2 of ことばのかたち.',
    '',
    'Made by tools/v2/serif-ink.mjs from:',
    `  structure-1 (public/v2/structure-1, sha256 ${structure.manifest.sha256}), itself made from BabelStone IDS and KANJIDIC2 (see its NOTICE).`,
    `  Noto Serif JP 300 (${serif.font.package.name} ${serif.font.package.version}), SIL Open Font License 1.1, as measured in ${found.browser}.`,
    `  Noto Sans JP 500 (${reading.package.name} ${reading.package.version}), SIL Open Font License 1.1, only where the serif draws a declared character empty.`,
    '    The table holds measurements of the faces (sizes, positions, ink rasters at 200 px per em), not their outlines.',
    '',
  ].join('\n'))
  const times = fitted.map((f) => f.ms).sort((a, b) => a - b)
  const timing = { renderMs: Math.round(renderMs), fitWallMs: Math.round(fitMs), perEntryMs: { median: Math.round(times[times.length >> 1] ?? 0), max: Math.round(times[times.length - 1] ?? 0) }, workers, totalMs: Math.round(performance.now() - t0) }
  return { files, manifest, timing, structure, rasters, inDomain }
}

/** the self-check of a written table (problems, empty when it holds) and what it found */
export function selfCheck(dir, { structure, rasters, inDomain }) {
  const problems = []
  const read = (f) => readFileSync(join(dir, f))
  const manifest = JSON.parse(read('manifest.json').toString('utf8'))
  // hashes: every file is the one the manifest names, and they make the table's sha256
  const files = [...manifest.shards.entries, ...manifest.shards.rasters]
  for (const f of files) if (sha(read(f.name)) !== f.sha256) problems.push(`${f.name} is not the file the manifest names`)
  if (sha(read(manifest.writing.file)) !== manifest.writing.sha256) problems.push('writing.json is not the file the manifest names')
  if (sha(files.map((f) => f.sha256).join('') + manifest.writing.sha256) !== manifest.sha256) problems.push('the files do not make the table\'s sha256')
  // canonical serialisation: every file is the canonical text of what it holds
  for (const f of files) {
    const text = read(f.name).toString('utf8')
    const parsed = JSON.parse(text)
    if (shardText(new Map(Object.entries(parsed.entries))) !== text) problems.push(`${f.name} is not canonical`)
  }
  if (canonical(JSON.parse(read('manifest.json').toString('utf8'))) + '\n' !== read('manifest.json').toString('utf8')) problems.push('manifest.json is not canonical')
  // the runtime loader reads it (a non-canonical check table is read as if it were, in memory only)
  const shardsOf = (list) => list.map((f) => JSON.parse(read(f.name).toString('utf8')))
  const writing = JSON.parse(read('writing.json').toString('utf8'))
  let index
  try {
    index = serifInkIndex({ ...manifest, canonical: true }, shardsOf(manifest.shards.entries), shardsOf(manifest.shards.rasters), writing)
  } catch (e) {
    problems.push(`the runtime loader refuses it: ${e.message}`)
  }
  // not a structure source: every row is a direct leaf of structure-1's tree, and every direct leaf has its row
  let rows = 0
  let rasterChecked = 0
  for (const e of inDomain) {
    const got = index?.entry(e.char)
    if (!got) {
      problems.push(`${e.char}: no entry`)
      continue
    }
    const tree = e.structure?.tree
    const leaves = tree?.kind === 'op' ? tree.children.map((c, i) => ({ path: String(i), index: i, c })).filter((x) => x.c.kind === 'leaf') : []
    const want = got.status === 'fitted' || got.status === 'whole-not-in-face' ? leaves : []
    if (got.rows.length !== want.length || got.rows.some((r, i) => r.path !== want[i].path || r.index !== want[i].index || r.node.char !== want[i].c.char || r.depth !== 1))
      problems.push(`${e.char}: its rows are not structure-1's direct leaves`)
    rows += got.rows.length
    // fingerprints: the raster read back is the raster measured
    const m = rasters.measured.get(e.char)
    const r = rasterOf(m)
    if (!!r !== !!got.raster) problems.push(`${e.char}: a raster ${r ? 'measured but not kept' : 'kept but not measured'}`)
    if (r && sha(canonical(r)) !== got.raster) problems.push(`${e.char}: its fingerprint is not its raster's`)
    if (r) {
      const g = index.glyph(e.char)
      if (!g || g.ink.w !== r.w || g.ink.h !== r.h) problems.push(`${e.char}: the loader's raster is not the measured one`)
      rasterChecked++
    }
  }
  // the writing record: the declared code points, as the CSS declares them
  const declaredCps = declared(readSerifFont().css)
  if (JSON.stringify(rangesOf(declaredCps)) !== JSON.stringify(writing.ranges)) problems.push('writing.ranges are not the ranges the face declares')
  // determinism: the fit of a sample, run again here, gives the same entries
  const glyphs = new Map()
  const glyph = (c) => {
    if (!glyphs.has(c)) {
      const m = rasters.measured.get(c)
      glyphs.set(c, m?.covered ? glyphOf(m) : null)
    }
    return glyphs.get(c)
  }
  const sample = inDomain.filter((_, i) => i % 97 === 0)
  for (const e of sample) {
    const m = rasters.measured.get(e.char)
    const r = rasterOf(m)
    const again = projectEntry(alignEntry(e, glyph, () => undefined), m, r ? sha(canonical(r)) : undefined)
    if (canonical(again) !== canonical(index?.entry(e.char))) problems.push(`${e.char}: fitted again, a different entry`)
  }
  // the fixed tables are as they were
  problems.push(...fixedTables())
  // how far the serif's rows are from align-1's (a table that repeats align-1 would be no observation of the serif)
  const align = new Map()
  const am = JSON.parse(readFileSync('public/v2/align-1/manifest.json', 'utf8'))
  let same = 0
  let compared = 0
  const need = new Set(inDomain.map((e) => e.char))
  for (const f of am.shards.files) {
    const s = JSON.parse(readFileSync(join('public/v2/align-1', f.name), 'utf8'))
    for (const [c, e] of Object.entries(s.entries)) if (need.has(c)) align.set(c, e)
  }
  for (const e of inDomain) {
    const a = align.get(e.char)
    const f = index?.entry(e.char)
    if (!a || !f) continue
    for (const r of f.rows) {
      const ar = a.rows.find((x) => x.path === r.path)
      if (!ar?.box || !r.box) continue
      compared++
      if (canonical(ar.box) === canonical(r.box) && canonical(ar.transform) === canonical(r.transform)) same++
    }
  }
  return { problems, found: { entries: inDomain.length, rows, rasters: rasterChecked, determinismSample: sample.length, rowsComparedWithAlign1: compared, rowsIdenticalToAlign1: same } }
}

async function main() {
  const noncanonical = process.argv.includes('--noncanonical')
  const check = process.argv.includes('--check')
  const out = resolve(arg('--out') ?? OUT)
  const pub = resolve('public')
  if (noncanonical && (!arg('--out') || !relative(pub, out).startsWith('..'))) throw new Error('--noncanonical writes only with --out, to a directory outside public/')
  if (!noncanonical && out !== resolve(OUT)) throw new Error(`the canonical table is written to ${OUT} only`)
  const only = arg('--chars') ? new Set([...arg('--chars')]) : null
  if (only && !noncanonical) throw new Error('--chars is for a non-canonical check only')
  const log = (s) => process.stderr.write(`${s}\n`)
  const built = await build({ canonicalRun: !noncanonical, reuse: process.argv.includes('--reuse'), only, workers: arg('--workers') ? Number(arg('--workers')) : undefined, log })
  const { files, manifest, timing } = built
  // written beside the destination first, checked, then put in place: a table that fails its check is never left
  mkdirSync(dirname(out), { recursive: true })
  const stage = mkdtempSync(join(dirname(out), '.serif-ink-'))
  for (const [name, text] of files) {
    mkdirSync(dirname(join(stage, name)), { recursive: true })
    writeFileSync(join(stage, name), text)
  }
  log('checking what was written …')
  const checked = selfCheck(stage, built)
  const summary = { canonical: manifest.canonical, entries: manifest.domain.entries, rasters: manifest.domain.rasters, status: manifest.status, rows: manifest.rows, writing: { codePoints: manifest.writing.codePoints, unwritable: manifest.writing.unwritable, emptyInBoth: manifest.writing.emptyInBoth }, sha256: manifest.sha256, rastersSha256: manifest.render.rasters.sha256, browser: manifest.render.browser.product, selfCheck: checked, timing }
  if (checked.problems.length) {
    rmSync(stage, { recursive: true, force: true })
    console.log(JSON.stringify({ ...summary, wrote: null }, null, 1))
    throw new Error(`the self-check failed:\n  ${checked.problems.slice(0, 40).join('\n  ')}`)
  }
  if (check) {
    const differ = []
    for (const [name] of files) {
      const p = join(out, name)
      if (!existsSync(p) || !readFileSync(p).equals(readFileSync(join(stage, name)))) differ.push(name)
    }
    rmSync(stage, { recursive: true, force: true })
    console.log(JSON.stringify({ ...summary, check: out, differ }, null, 1))
    process.exit(differ.length ? 1 : 0)
  }
  if (existsSync(out)) rmSync(out, { recursive: true, force: true })
  renameSync(stage, out)
  console.log(JSON.stringify({ ...summary, wrote: relative(process.cwd(), out) }, null, 1))
}

if (process.argv[1]?.endsWith('serif-ink.mjs')) {
  main().catch((e) => {
    console.error(`\nserif-ink-1: ${e.message}`)
    process.exit(1)
  })
}
