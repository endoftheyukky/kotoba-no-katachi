// The archive's snapshot limits (src/archive/svg.ts) against real pages: every
// published generator version drawn for every title of the public title sets,
// rendered as the page renders it, made canonical as the page sends it, and
// checked with checkSVG as the server checks it. Prints the largest measure of
// each kind, so the limits can be read against what the work draws.
//
// Run through tools/verify/run.mjs (npm run verify:snapshots). Exit 1 if any
// real page is refused. SAMPLES=<dir> also writes the largest page of each
// version among the public titles there (the unit tests use them).
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export default async function ({ evaluate, load }) {
  await load('/index.html', 1280, 800)
  const drawn = await evaluate(`(async () => {
    const C = await import('/src/poem/compose.ts')
    const N = await import('/src/title.ts')
    const G = await import('/src/poem/generators.ts')
    const R = await import('/src/render/svg.ts')
    const S = await import('/src/archive/svg.ts')
    const T = await import('/src/study/titles.ts')
    const H = await import('/src/study/holdout.ts')
    const P = await import('/src/study/probes.ts')
    const D = await import('/src/study/difficult.ts')
    // and the longest titles the page takes (16 characters), written here to reach the largest pages
    const longest = ['ロロロロロロロロロロロロロロロロ', '森森森森森森森森森森森森森森森森', '迷路迷路迷路迷路迷路迷路迷路迷路', '子供の城のなかの子供の城のなかの',
      'さかさまのさかさまのさかさまの森', '雨雨雨雨雨雨雨雨雨雨雨雨雨雨雨雨', '鬱鬱鬱鬱鬱鬱鬱鬱鬱鬱鬱鬱鬱鬱鬱鬱', 'あいうえおかきくけこさしすせそた',
      '見えない見えない見えない見えない', '一 二 三 四 五 六 七 八', '欠けた月の欠けた月の欠けた月の欠', '々々々々々々々々々々々々々々々々',
      '顳顬顳顬顳顬顳顬顳顬顳顬顳顬顳顬', '走れ走れ走れ走れ走れ走れ走れ走れ', 'ころころころころころころころころ', '白い犬と黒い犬と白い犬と黒い犬と',
      // the largest pages found: a kanji written sixteen times
      '絵絵絵絵絵絵絵絵絵絵絵絵絵絵絵絵', '夜夜夜夜夜夜夜夜夜夜夜夜夜夜夜夜', '感感感感感感感感感感感感感感感感',
    ].map((text) => ({ text, longest: true }))
    const titles = [T.STUDY_TITLES, H.HOLDOUT_TITLES, P.PROBE_TITLES, D.DIFFICULT_WORDS, D.EDGE_TITLES, longest].flat()
    const host = document.createElement('div')
    host.style.cssText = 'position:absolute;left:-9999px;width:500px;height:500px'
    document.body.append(host)
    const pages = []
    const errors = []
    for (const t of titles) {
      const input = N.normalizeTitle({ text: t.text, reading: t.reading })
      if (typeof input === 'string') { errors.push(t.text + ': ' + input); continue }
      for (const version of G.VERSIONS) {
        try {
          const a = await C.analyze(input)
          const c = await G.write(a, version)
          host.replaceChildren()
          const stage = R.renderSVG(host, c.draft, a.glyphs)
          const svg = S.canonicalSVG(stage.svg.outerHTML)
          pages.push({ text: input.text, reading: input.reading ?? '', version, longest: !!t.longest, svg, verdict: S.checkSVG(svg), measure: S.measureSVG ? S.measureSVG(svg) : null })
        } catch (e) {
          errors.push(t.text + ' v' + version + ': ' + String(e))
        }
      }
    }
    host.remove()
    return { pages, errors, limits: S.SNAPSHOT_LIMITS ?? { MAX_SVG: S.MAX_SVG } }
  })()`)

  if (!drawn || drawn.errors.length) return { exitCode: 1, errors: drawn?.errors ?? ['nothing was drawn'] }

  const refused = drawn.pages.filter((p) => p.verdict !== true).map((p) => ({ text: p.text, reading: p.reading, version: p.version, verdict: p.verdict }))
  const largest = {}
  const keys = drawn.pages[0].measure ? Object.keys(drawn.pages[0].measure) : []
  for (const k of ['length', ...keys]) {
    const value = (p) => (k === 'length' ? p.svg.length : p.measure[k])
    const top = drawn.pages.reduce((a, b) => (value(b) > value(a) ? b : a))
    largest[k] = { value: value(top), text: top.text, version: top.version }
  }
  // HASHES=<file>: the SHA-256 of every page's snapshot, to compare two builds byte for byte
  if (process.env.HASHES) {
    const { createHash } = await import('node:crypto')
    const lines = drawn.pages.map((p) => `${p.version}\t${p.text}\t${p.reading}\t${createHash('sha256').update(p.svg).digest('hex')}`)
    writeFileSync(process.env.HASHES, lines.join('\n') + '\n')
  }
  if (process.env.SAMPLES) {
    mkdirSync(process.env.SAMPLES, { recursive: true })
    for (const v of new Set(drawn.pages.map((p) => p.version))) {
      const top = drawn.pages.filter((p) => p.version === v && !p.longest).reduce((a, b) => (b.svg.length > a.svg.length ? b : a))
      writeFileSync(join(process.env.SAMPLES, `largest-v${v}.svg`), top.svg)
    }
  }
  return { exitCode: refused.length ? 1 : 0, pages: drawn.pages.length, refused, largest, limits: drawn.limits }
}
