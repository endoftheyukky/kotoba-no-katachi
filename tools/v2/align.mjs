// align-1: where structure-1's components lie in the reading face, for generator v2 (spec-1 §2.1, §11.3, §16 Stage 3).
//
//   npm run v2:align                 measure the glyphs in headless Chrome, fit, write public/v2/align-1
//   npm run v2:align -- --check      the same, and compare with public/v2/align-1 byte for byte
//   npm run v2:align -- --reuse      fit from the rasters of the last render (node_modules/.cache/v2-align) instead of measuring again
//   CHROME=/path/to/chrome           the browser (as npm run verify)
//
// Inputs: structure-1 as published (its sha256 is checked), the reading face as bundled
// (@fontsource/noto-sans-jp, weight 500; its files are checked against the pinned hashes), and
// the browser's rendering of it through v1's own glyph measure. Nothing else: no KanjiVG, no
// benchmark fixture, no network. A different face, package version or measure is a different table.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { arch, cpus, platform, release } from 'node:os'
import { join } from 'node:path'
import { Worker } from 'node:worker_threads'
import { ALIGN } from '../../src/v2/align/constants.ts'
import { TOOL_VERSION } from '../../src/v2/align/build/build.ts'
import { GRID_R } from '../../src/v2/align/build/raster.ts'
import { canonical, shardText } from '../../src/v2/structure/build/serialize.ts'
import { renderRasters } from './align/chrome.mjs'
import { readRasters } from './align/rasters.mjs'

export const SHARDS = 64
const STRUCTURE = 'public/v2/structure-1'
const FONT_DIR = 'node_modules/@fontsource/noto-sans-jp'
const CACHE = 'node_modules/.cache/v2-align/rasters.jsonl.gz'

/** the reading face this table is for: another package version or other bytes is another table */
export const PINNED_FONT = {
  version: '5.3.0',
  css: '62a12f4748c9348bc97471efa3df6d9ea4bc3ec4706143b93a50cbf0e4c92920',
  files: '0d9b25aa757385550a41cba8b5f49abfa25d409479cceee9fba55798b1025e7c',
}

const sha = (b) => createHash('sha256').update(b).digest('hex')
const arg = (name) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const byCodePoint = (a, b) => a.codePointAt(0) - b.codePointAt(0)

/** structure-1 as published, after checking it is the table its manifest names */
export function readStructure(dir = STRUCTURE) {
  const manifestText = readFileSync(join(dir, 'manifest.json'), 'utf8')
  const manifest = JSON.parse(manifestText)
  const entries = []
  for (const f of manifest.shards.files) {
    const buf = readFileSync(join(dir, f.name))
    if (sha(buf) !== f.sha256) throw new Error(`structure-1: ${f.name} is not the file its manifest names`)
    entries.push(...Object.values(JSON.parse(buf.toString('utf8')).entries))
  }
  if (sha(manifest.shards.files.map((f) => f.sha256).join('')) !== manifest.sha256) throw new Error('structure-1: shard hashes do not make the table hash')
  entries.sort((a, b) => byCodePoint(a.char, b.char))
  return { manifest, entries }
}

/** the reading face as bundled, checked against the pins */
export function readFont(dir = FONT_DIR) {
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8')).packages['node_modules/@fontsource/noto-sans-jp']
  const css = readFileSync(join(dir, '500.css'))
  const names = readdirSync(join(dir, 'files')).filter((n) => /-500-normal\.woff2$/.test(n)).sort()
  const list = names.map((n) => `${n} ${sha(readFileSync(join(dir, 'files', n)))}`).join('\n')
  const font = {
    family: 'Noto Sans JP',
    weight: 500,
    style: 'normal',
    package: { name: pkg.name, version: pkg.version, integrity: lock.integrity, license: lock.license },
    css: { file: '500.css', sha256: sha(css) },
    files: { count: names.length, format: 'woff2', sha256: sha(list) },
  }
  const pin = [pkg.version === PINNED_FONT.version, !PINNED_FONT.css || font.css.sha256 === PINNED_FONT.css, !PINNED_FONT.files || font.files.sha256 === PINNED_FONT.files]
  if (pin.includes(false)) throw new Error(`the reading face is not the pinned one: ${JSON.stringify(font)} (a new face is a new table)`)
  return font
}

/** every character to measure: the table's characters and every component with a code point */
export function charsToMeasure(entries) {
  const set = new Set()
  const walk = (n) => {
    if (n.kind === 'op') n.children.forEach(walk)
    else if (n.tier !== 'unknown') set.add(n.char)
  }
  for (const e of entries) {
    set.add(e.char)
    if (e.structure) walk(e.structure.tree)
  }
  return [...set].sort(byCodePoint)
}

async function fitAll(entries, rastersPath, workers) {
  const buckets = Array.from({ length: workers }, () => [])
  // interleaved, so every worker gets a like share of large and small characters
  entries.forEach((e, i) => buckets[i % workers].push(e))
  const results = await Promise.all(
    buckets.map(
      (b) =>
        new Promise((resolve, reject) => {
          const w = new Worker(new URL('./align/worker.mjs', import.meta.url), { workerData: { rastersPath, entries: b } })
          w.once('message', resolve)
          w.once('error', reject)
        }),
    ),
  )
  return results.flat()
}

const RULES = {
  existence: 'structure-1 says what exists; a row says where and how well, never whether. A poor fit is approximate, not absent.',
  glyph: 'a leaf is placed as the glyph of its own code point in the reading face (氵 as 氵, 囗 as 囗); a code point the face does not have, or an unencoded component, is unavailable: no other character stands in for it',
  transform: 'x\' = x·sx + dx, y\' = y·sy + dy, from the component\'s em space (its ink centre at the origin) into the whole\'s (v1 measure, EM = 100); sx and sy apart',
  regions: `each child is searched only in the region its operator gives it inside its parent's region. ⿰⿲ side by side and ⿱⿳ stacked: the parent is cut at each of SPLITS (a component one level down: SPLITS_NESTED; deeper: SPLITS_DEEP), each child in its part widened by SPLIT_MARGIN across a cut (a stroke: SPLIT_MARGIN_STROKE); ⿴ surround and inside, ⿵ open below, ⿶ open above, ⿷ open right, ⿸ from the upper left, ⿹ from the upper right, ⿺ from the lower left (a wrapper that is one glyph spans WRAPPER_MIN of the parent, the enclosed child keeps INSET / INNER_FROM away from the wrapping sides); ⿻ overlay. The character's own children reach its edges (ANCHOR)`,
  search: `per leaf and region: every box on a grid of twice COARSE_STEP (every fourth ink cell, FIRST_TOLERANCE), the best climbed at COARSE_STEP (COARSE_TOLERANCE), the SEEDS best climbed at 2, 1 and 0.5 em with every ink cell (TOLERANCE); score = placed ink on the whole's ink − OFF_COST × placed ink off it`,
  joint: `top down: a node tries each way its operator cuts its region, fits each child in its part and keeps its CANDIDATES best combinations of its children's best; value = the whole's ink explained, each cell worth what its strongest claimant makes it (a stroke STROKE_WEIGHT, else 1), − OFF_COST × ink off − OVERLAP_COST × ink two leaves both claim (not under ⿻) − SEAM_COST × the ink each cut runs through; a combination that breaks its operator (order along a split, the enclosed inside its wrapper, the anchors) only when none keeps it`,
  reconsider: `then RECONSIDER sweeps: each leaf searched again with the ink its siblings explain counted against it, in its region and (when every part around it is placed) its parent's whole region; a new place only when the joint value rises; then each leaf nudged while the others hold still`,
  subtree: 'a node that is a subtree has no glyph of its own: its box is the union of its placed parts; its status follows from theirs',
  residual: 'the whole\'s ink minus the component grown by one cell (v1 relate), in 8-connected pieces; a piece under SLIVER of the whole is a misfit\'s sliver; each piece\'s side is where its centroid lies against the component\'s box; interleaved: a row or column of pieces with the component\'s ink between each two',
  unexplainedInRegion: 'an unavailable leaf: the whole\'s ink in its region that no placed component explains (ink, not a stand-in glyph)',
  status: `aligned: precision ≥ PRECISION_MIN, lift ≥ LIFT_MIN, no scale at its limit, ambiguity ≤ AMBIGUITY_MAX, its operator kept, not a stroke, no sibling left unplaced; otherwise approximate, with every reason; unavailable: no glyph of its own in the face, unencoded, or no room in its region within the scale limits (a subtree: no part placed)`,
  confidence: `lift × (1 − ambiguity); ambiguity = 1 − (what the joint fit loses when the component moves to its best rival place ÷ what it explains) ÷ AMBIGUITY_SPAN, the rival searched in its region with its own and its siblings' ink taken; a subtree takes its least sure part. It says how sure the geometry is, not whether the component exists`,
  order: 'entries by code point in 64 shards (code point mod 64); rows in the tree\'s path order (pre-order)',
}

export async function generate({ reuse = false, workers = Math.max(1, cpus().length - 2) } = {}) {
  const t0 = performance.now()
  const structure = readStructure()
  const font = readFont()
  const chars = charsToMeasure(structure.entries)
  mkdirSync('node_modules/.cache/v2-align', { recursive: true })
  const tr = performance.now()
  if (!reuse || !existsSync(CACHE)) await renderRasters(chars, CACHE)
  const renderMs = performance.now() - tr
  const rasters = readRasters(CACHE)
  const missing = chars.filter((c) => !rasters.measured.has(c))
  if (missing.length) throw new Error(`the rasters lack ${missing.join('')}: render again`)
  const tf = performance.now()
  const fitted = await fitAll(structure.entries, CACHE, workers)
  const fitMs = performance.now() - tf
  const entries = new Map(fitted.map((f) => [f.entry.char, f.entry]))
  const shards = []
  for (let i = 0; i < SHARDS; i++) {
    const m = new Map([...entries].filter(([c]) => c.codePointAt(0) % SHARDS === i))
    shards.push([`${String(i).padStart(2, '0')}.json`, shardText(m)])
  }
  const status = { fitted: 0, atomic: 0, 'no-structure': 0, 'whole-not-in-face': 0 }
  const rows = { direct: { aligned: 0, approximate: 0, unavailable: 0 }, nested: { aligned: 0, approximate: 0, unavailable: 0 } }
  for (const e of entries.values()) {
    status[e.status]++
    for (const r of e.rows) rows[r.depth === 1 ? 'direct' : 'nested'][r.status]++
  }
  const files = shards.map(([name, text]) => ({ name, entries: [...text.matchAll(/^"/gm)].length, bytes: Buffer.byteLength(text), sha256: sha(Buffer.from(text)) }))
  const cdp = readFileSync('tools/verify/cdp.mjs', 'utf8')
  const flags = [...(/spawn\(chrome, \[([^\]]*)\]/.exec(cdp)?.[1] ?? '').matchAll(/'(--[a-z-]+(?:=[a-z]+)?)'/g)].map((m) => m[1])
  const browser = rasters.head.browser
  const manifest = {
    id: 'align-1',
    spec: 'spec-1',
    generator: { tool: 'tools/v2/align.mjs', version: TOOL_VERSION },
    face: 'align-1 holds for this face only: another font, package version, weight or measure is a new table (align-2 …)',
    font: { ...font, fetched: rasters.head.faces.fetched },
    render: {
      browser: { product: browser.product, revision: browser.revision, userAgent: browser.userAgent, jsVersion: browser.jsVersion },
      launcher: { file: 'tools/verify/cdp.mjs', sha256: sha(cdp), flags },
      page: { file: 'tools/v2/align/page.ts', sha256: sha(readFileSync('tools/v2/align/page.ts')) },
      measure: { module: 'src/glyph/metrics.ts', sha256: sha(readFileSync('src/glyph/metrics.ts')), pxPerEm: 200, canvas: 600, ink: 'alpha > 127', box: 'alpha > 8' },
      devicePixelRatio: rasters.head.faces.dpr,
      antialiasing: 'canvas 2D fillText, the browser\'s default (greyscale) antialiasing, software rendering (--disable-gpu)',
      platform: { os: `${platform()} ${release()}`, arch: arch() },
      rasters: { glyphs: rasters.measured.size, notInFace: [...rasters.measured.values()].filter((m) => !m.covered).map((m) => m.c), sha256: rasters.sha256 },
    },
    structure: { id: 'structure-1', sha256: structure.manifest.sha256 },
    grid: { cell: 1, radius: GRID_R, inkCell: 'a 1 em cell is ink when at least half of it is (v1 raster pixels, alpha > 127)' },
    constants: ALIGN,
    rules: RULES,
    shards: { count: SHARDS, of: 'code point mod 64', files },
    entries: entries.size,
    status,
    rows,
    sha256: sha(files.map((f) => f.sha256).join('')),
  }
  const out = new Map(shards)
  out.set('manifest.json', canonical(manifest) + '\n')
  out.set('NOTICE.txt', [
    'align-1 — where the components of structure-1 lie in the reading face, for generator v2 of ことばのかたち.',
    '',
    'Made by tools/v2/align.mjs from:',
    `  structure-1 (public/v2/structure-1, sha256 ${structure.manifest.sha256}), itself made from BabelStone IDS and KANJIDIC2 (see its NOTICE).`,
    `  Noto Sans JP 500 (${font.package.name} ${font.package.version}), SIL Open Font License 1.1, as measured in ${browser.product}.`,
    '    The table holds measurements of the face (positions, scales, shares of ink), not its outlines.',
    '',
  ].join('\n'))
  const times = fitted.map((f) => f.ms).sort((a, b) => a - b)
  const timing = {
    renderMs: Math.round(renderMs),
    fitWallMs: Math.round(fitMs),
    fitCpuMs: Math.round(times.reduce((s, v) => s + v, 0)),
    perEntryMs: { median: Math.round(times[times.length >> 1]), p95: Math.round(times[Math.floor(times.length * 0.95)]), max: Math.round(times[times.length - 1]) },
    workers,
    totalMs: Math.round(performance.now() - t0),
  }
  return { files: out, manifest, timing }
}

if (process.argv[1]?.endsWith('align.mjs')) {
  const outDir = arg('--out') ?? 'public/v2/align-1'
  const { files, manifest, timing } = await generate({ reuse: process.argv.includes('--reuse'), workers: arg('--workers') ? Number(arg('--workers')) : undefined })
  if (process.argv.includes('--check')) {
    const differ = []
    for (const [name, text] of files) {
      const p = join(outDir, name)
      if (!existsSync(p) || !readFileSync(p).equals(Buffer.from(text))) differ.push(name)
    }
    console.log(JSON.stringify({ check: outDir, files: files.size, differ, sha256: manifest.sha256, rasters: manifest.render.rasters.sha256, timing }))
    process.exit(differ.length ? 1 : 0)
  }
  mkdirSync(outDir, { recursive: true })
  for (const [name, text] of files) writeFileSync(join(outDir, name), text)
  console.log(JSON.stringify({ wrote: outDir, entries: manifest.entries, status: manifest.status, rows: manifest.rows, sha256: manifest.sha256, rasters: manifest.render.rasters.sha256, timing }))
}
