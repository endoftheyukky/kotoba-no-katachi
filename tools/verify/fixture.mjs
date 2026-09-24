// The public regression fixture: every published generator version drawn for
// every title of the public title sets (src/study/*.ts), each page reduced to
// the SHA-256 of its Draft — the generator's whole output, before rendering —
// and the invariant audit (src/poem/invariants.ts).
//
// Run through tools/verify/run.mjs (npm run verify), or by hand with a dev
// server:  node tools/verify/cdp.mjs <base-url> <profile-dir> tools/verify/fixture.mjs
//
//   MODE=check (default)  draw, compare with tools/verify/expected.json, exit 1 on any difference
//   MODE=write            draw and write tools/verify/expected.json
//
// No title in these sets was typed by a visitor to the site.
import { readFileSync, writeFileSync } from 'node:fs'

const EXPECTED = 'tools/verify/expected.json'
const VERSIONS = [{ id: 'v1', version: 1 }]

export default async function ({ evaluate, load }) {
  await load('/index.html', 1280, 800)
  const drawn = await evaluate(`(async () => {
    const C = await import('/src/poem/compose.ts')
    const N = await import('/src/title.ts')
    const G = await import('/src/poem/generators.ts')
    const I = await import('/src/poem/invariants.ts')
    const T = await import('/src/study/titles.ts')
    const H = await import('/src/study/holdout.ts')
    const P = await import('/src/study/probes.ts')
    const D = await import('/src/study/difficult.ts')
    const sets = [
      ['dev', T.STUDY_TITLES], ['holdout', H.HOLDOUT_TITLES], ['probe', P.PROBE_TITLES],
      ['words', D.DIFFICULT_WORDS], ['edges', D.EDGE_TITLES],
    ]
    const hex = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('')
    const r3 = (v) => Math.round(v * 1000) / 1000
    const pages = []
    const errors = []
    for (const [set, titles] of sets)
      for (const t of titles) {
        const input = N.normalizeTitle({ text: t.text, reading: t.reading })
        if (typeof input === 'string') { errors.push(set + ' ' + t.text + ': ' + input); continue }
        const page = { set, text: input.text, reading: input.reading ?? '' }
        for (const { id, version } of ${JSON.stringify(VERSIONS)}) {
          try {
            // analysed afresh for each version, as the site does for each page
            const a = await C.analyze(input)
            const c = await G.write(a, version)
            const marks = c.draft.marks
            const out = {
              sha256: await hex(JSON.stringify(marks)),
              marks: marks.length,
              sum: [r3(marks.reduce((s, k) => s + k.x, 0)), r3(marks.reduce((s, k) => s + k.y, 0)), r3(marks.reduce((s, k) => s + k.size, 0))],
            }
            const p = c.parametric
            out.invariants = I.soundness(a, marks, {
              repetition: c.primary.op === 'proliferation',
              absent: c.absent,
              alongCurve: (p.params.closure ?? 0) >= 0.35 || (p.params.rows ?? 1) > 1.05,
              left: p.withdrawn,
            })
            page[id] = out
          } catch (e) {
            errors.push(set + ' ' + t.text + ' ' + id + ': ' + String(e))
          }
        }
        pages.push(page)
      }
    return { browser: navigator.userAgent, pages, errors }
  })()`)

  if (!drawn || drawn.errors.length) return { exitCode: 1, errors: drawn?.errors ?? ['nothing was drawn'] }

  const fonts = Object.fromEntries(
    ['@fontsource/noto-sans-jp', '@fontsource/noto-serif-jp'].map((p) => [p, JSON.parse(readFileSync(`node_modules/${p}/package.json`, 'utf8')).version]),
  )
  const table = JSON.parse(readFileSync('public/semantic/axes-1/meta.json', 'utf8'))

  if (process.env.MODE === 'write') {
    const doc = {
      about:
        'Expected output of the published generator for the public title sets. sha256 is the SHA-256 of JSON.stringify(draft.marks). ' +
        'invariants: the audit, every count 0. Produced by tools/verify/fixture.mjs (MODE=write).',
      produced: { browser: drawn.browser, fonts, table: table.id, words: table.words },
      versions: VERSIONS.map((v) => v.id),
      pages: drawn.pages,
    }
    writeFileSync(EXPECTED, JSON.stringify(doc, null, 1) + '\n')
    return { wrote: EXPECTED, pages: drawn.pages.length }
  }

  const expected = JSON.parse(readFileSync(EXPECTED, 'utf8'))
  const known = new Map(expected.pages.map((p) => [`${p.text}\u0000${p.reading}`, p]))
  const differ = []
  const failing = []
  const same = Object.fromEntries(VERSIONS.map((v) => [v.id, 0]))
  for (const page of drawn.pages) {
    const want = known.get(`${page.text}\u0000${page.reading}`)
    for (const { id } of VERSIONS) {
      if (want?.[id]?.sha256 === page[id].sha256) same[id]++
      else differ.push({ text: page.text, reading: page.reading, version: id, expected: want?.[id] ? { marks: want[id].marks, sum: want[id].sum } : null, drawn: { marks: page[id].marks, sum: page[id].sum } })
    }
    for (const { id } of VERSIONS) {
      const inv = page[id].invariants
      if (Object.values(inv).some((n) => n > 0)) failing.push({ text: page.text, version: id, invariants: inv })
    }
  }
  const missing = expected.pages.length - drawn.pages.length
  const ok = !differ.length && !failing.length && missing === 0
  return {
    exitCode: ok ? 0 : 1,
    result: ok ? 'identical' : 'DIFFERENT',
    pages: drawn.pages.length,
    identical: same,
    differ,
    invariantFailures: failing,
    browser: drawn.browser,
    expectedBrowser: expected.produced.browser,
    fonts,
    expectedFonts: expected.produced.fonts,
  }
}
