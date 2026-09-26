// scope-1: the characters structure-1 holds (spec-1 §11.3: jōyō, jinmeiyō and the characters the corpora need),
// frozen once, so that neither the build nor the runtime depends on a corpus.
//
//   npm run v2:scope -- --kanjidic <kanjidic2.xml.gz> --exploration <folder of the pre-v2 batches w00.json …>
//
// Only characters are kept — never a word, a title or a corpus text. Every character says where it
// came from: 'grade' (KANJIDIC2 grade 1–10), 'study' (src/study), 'exploration' (the pre-v2 exploration
// corpus, not published), 'fixture' (the Stage 1 benchmark titles: to be in the table, never as an answer).
// Text is taken as the site takes a title (NFC), and a character is a CJK ideograph.
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { CASES } from '../../src/v2/fixtures/cases.ts'
import { PINNED } from './structure.mjs'

export const SCOPE_VERSION = '1'
export const SCOPE_PATH = 'src/v2/structure/scope-1.json'
const STUDY = ['src/study/titles.ts', 'src/study/holdout.ts', 'src/study/probes.ts', 'src/study/difficult.ts']
const ORIGINS = ['grade', 'study', 'exploration', 'fixture']

const sha = (b) => createHash('sha256').update(b).digest('hex')
const ideographs = (s) => [...s.normalize('NFC')].filter((c) => /[㐀-鿿\u{20000}-\u{3ffff}豈-﫿]/u.test(c))
const byCodePoint = (a, b) => a.codePointAt(0) - b.codePointAt(0)
const arg = (name) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

export function makeScope(kanjidicPath, explorationDir) {
  const kdBuf = readFileSync(kanjidicPath)
  if (sha(kdBuf) !== PINNED.kanjidic) throw new Error('kanjidic2.xml.gz is not the pinned file')
  const kd = gunzipSync(kdBuf).toString('utf8')
  const from = new Map()
  const add = (c, origin) => {
    if (!from.has(c)) from.set(c, new Set())
    from.get(c).add(origin)
  }
  for (const m of kd.matchAll(/<character>([\s\S]*?)<\/character>/g)) {
    const lit = /<literal>(.*?)<\/literal>/.exec(m[1])[1]
    const g = /<grade>(\d+)<\/grade>/.exec(m[1])
    if (g && Number(g[1]) >= 1 && Number(g[1]) <= 10) add(lit, 'grade')
  }
  const studyFiles = STUDY.map((p) => {
    const text = readFileSync(p, 'utf8')
    for (const t of text.matchAll(/text: '([^']*)'/g)) ideographs(t[1]).forEach((c) => add(c, 'study'))
    return { path: p, sha256: sha(readFileSync(p)) }
  })
  const batches = readdirSync(explorationDir).filter((f) => /^w\d+\.json$/.test(f)).sort()
  const explorationHash = createHash('sha256')
  let words = 0
  for (const f of batches) {
    const buf = readFileSync(join(explorationDir, f))
    explorationHash.update(buf)
    for (const w of JSON.parse(buf.toString('utf8'))) {
      words++
      ideographs(typeof w === 'string' ? w : w.text).forEach((c) => add(c, 'exploration'))
    }
  }
  for (const c of CASES) ideographs(c.title).forEach((ch) => add(ch, 'fixture'))

  const chars = [...from.keys()].sort(byCodePoint)
  const lines = chars.map((c) => JSON.stringify([c, ORIGINS.filter((o) => from.get(c).has(o))]))
  const charsText = lines.join(',\n')
  const counts = Object.fromEntries(ORIGINS.map((o) => [o, chars.filter((c) => from.get(c).has(o)).length]))
  counts.onlyCorpus = chars.filter((c) => !from.get(c).has('grade')).length
  counts.total = chars.length
  const meta = {
    id: 'scope-1',
    spec: 'spec-1',
    version: SCOPE_VERSION,
    method: 'tools/v2/scope.mjs: CJK ideographs (U+3400–9FFF, U+20000–3FFFF, U+F900–FAFF) of NFC text; characters only, no words kept',
    sources: [
      { origin: 'grade', name: 'KANJIDIC2 grade 1–10', sha256: PINNED.kanjidic },
      { origin: 'study', name: 'the public title sets', files: studyFiles },
      { origin: 'exploration', name: 'the pre-v2 exploration corpus (not published)', batches: batches.length, words, sha256: explorationHash.digest('hex') },
      { origin: 'fixture', name: 'Stage 1 benchmark titles (membership only, never an answer)', path: 'src/v2/fixtures/cases.ts', sha256: sha(readFileSync('src/v2/fixtures/cases.ts')) },
    ],
    counts,
    order: 'code point',
    sha256: sha(charsText),
  }
  // the metadata on one line, then one character per line: [char, origins]
  const text = '{"meta":' + JSON.stringify(meta) + ',\n"chars":[\n' + charsText + '\n]}\n'
  return { text, meta }
}

if (process.argv[1]?.endsWith('scope.mjs')) {
  const kd = arg('--kanjidic')
  const ex = arg('--exploration')
  if (!kd || !ex) {
    console.error('usage: --kanjidic <kanjidic2.xml.gz> --exploration <folder of w00.json …>')
    process.exit(2)
  }
  const { text, meta } = makeScope(kd, ex)
  writeFileSync(SCOPE_PATH, text)
  console.log(JSON.stringify({ wrote: SCOPE_PATH, counts: meta.counts, sha256: meta.sha256 }))
}
