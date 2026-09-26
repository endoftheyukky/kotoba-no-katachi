// structure-1: the fixed table of character structure for generator v2 (spec-1 §2.2, §11.3).
//
//   npm run v2:structure -- --ids <IDS.TXT> --kanjidic <kanjidic2.xml.gz>          write public/v2/structure-1
//   npm run v2:structure -- --ids <IDS.TXT> --kanjidic <kanjidic2.xml.gz> --check  regenerate and compare, byte for byte
//
// The sources are not kept in the repository. They are fetched once by hand from
//   https://www.babelstone.co.uk/CJK/IDS.TXT          (BabelStone IDS; the file date and sha256 below)
//   http://www.edrdg.org/kanjidic/kanjidic2.xml.gz    (KANJIDIC2; only the grade 1–10 set is read)
// and must match the pinned sha256: another file is another table, and so another version.
// The runtime never reads them; it reads the shards written here.
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { buildEntries, readSource, shardTexts, SHARDS, TOOL_VERSION, FORMS } from '../../src/v2/structure/build/build.ts'
import { MAX_DEPTH } from '../../src/v2/structure/build/normalize.ts'
import { STROKES } from '../../src/v2/structure/build/ids.ts'
import { canonical } from '../../src/v2/structure/build/serialize.ts'

export const PINNED = {
  ids: 'cc2a0a97e6a51ed6ebe59870ef2af66e83f3c3c27387d79b4441bb2d791d78b1',
  kanjidic: 'aef74d1c86bad7ef03441e6c0ded48f0b0da3e2637e00bcc80f6e10488811c99',
}

const sha = (buf) => createHash('sha256').update(buf).digest('hex')
const arg = (name) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

/** the frozen scope: which characters the table holds (tools/v2/scope.mjs) */
export function readScope(scopePath) {
  const buf = readFileSync(scopePath)
  const text = buf.toString('utf8')
  const { meta, chars } = JSON.parse(text)
  const charsText = chars.map((x) => JSON.stringify(x)).join(',\n')
  if (sha(Buffer.from(charsText)) !== meta.sha256) throw new Error(`${scopePath}: its characters are not the ones its sha256 names`)
  for (let i = 1; i < chars.length; i++) if (chars[i - 1][0].codePointAt(0) >= chars[i][0].codePointAt(0)) throw new Error(`${scopePath}: not in code point order at ${chars[i][0]}`)
  return { meta, chars, fileSha256: sha(buf) }
}

/** the table, from the two source files and the frozen scope; returns { files: Map(name → text) } */
export function generate(idsPath, kanjidicPath, scopePath = 'src/v2/structure/scope-1.json') {
  const idsBuf = readFileSync(idsPath)
  const kdBuf = readFileSync(kanjidicPath)
  const idsSha = sha(idsBuf)
  const kdSha = sha(kdBuf)
  if (idsSha !== PINNED.ids) throw new Error(`IDS.TXT sha256 ${idsSha} is not the pinned ${PINNED.ids}`)
  if (kdSha !== PINNED.kanjidic) throw new Error(`kanjidic2.xml.gz sha256 ${kdSha} is not the pinned ${PINNED.kanjidic}`)
  const idsText = idsBuf.toString('utf8')
  const kd = gunzipSync(kdBuf).toString('utf8')
  const header = (tag, text) => (new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(text) ?? [])[1] ?? ''
  const idsHeader = (label) => (new RegExp(`^# ${label}: (.*)$`, 'm').exec(idsText) ?? [])[1]?.trim() ?? ''

  // the standalone characters: KANJIDIC2 grade 1–10 (jōyō 1–8, jinmeiyō 9–10)
  const graded = new Set()
  for (const m of kd.matchAll(/<character>([\s\S]*?)<\/character>/g)) {
    const lit = /<literal>(.*?)<\/literal>/.exec(m[1])[1]
    const g = /<grade>(\d+)<\/grade>/.exec(m[1])
    if (g && Number(g[1]) >= 1 && Number(g[1]) <= 10) graded.add(lit)
  }
  // the characters the table holds: the frozen scope (grade 1–10 ∪ the corpora ∪ the benchmark titles)
  const scope = readScope(scopePath)
  const scopeGraded = scope.chars.filter(([, o]) => o.includes('grade')).map(([c]) => c)
  if (scopeGraded.length !== graded.size || scopeGraded.some((c) => !graded.has(c))) throw new Error('scope-1: its grade set is not KANJIDIC2 grade 1–10')
  const include = scope.chars.map(([c]) => c)
  const source = readSource(idsText)
  const entries = buildEntries({ source, graded, include })
  // in the scope, and nothing in the source: not in the table, and said so
  const absent = include.filter((c) => !entries.has(c))
  const shards = shardTexts(entries)

  const status = { decomposed: 0, atomic: 0, 'unsupported-operator': 0, malformed: 0 }
  for (const e of entries.values()) status[e.status]++
  const files = []
  for (const [name, text] of shards) files.push({ name, entries: [...text.matchAll(/^"/gm)].length, bytes: Buffer.byteLength(text), sha256: sha(Buffer.from(text)) })
  const manifest = {
    id: 'structure-1',
    spec: 'spec-1',
    generator: { tool: 'tools/v2/structure.mjs', version: TOOL_VERSION },
    sources: [
      {
        name: 'BabelStone IDS', url: 'https://www.babelstone.co.uk/CJK/IDS.TXT',
        version: { 'File Date': idsHeader('File Date'), 'Unicode Version': idsHeader('Unicode Version'), 'Total entries': idsHeader('Total entries') },
        sha256: idsSha, use: 'the structure: every regional IDS, the Japanese one selected',
      },
      {
        name: 'KANJIDIC2', url: 'http://www.edrdg.org/kanjidic/kanjidic2.xml.gz',
        version: { file_version: header('file_version', kd), database_version: header('database_version', kd), date_of_creation: header('date_of_creation', kd) },
        sha256: kdSha, use: 'the set of standalone characters (grade 1–10): the character tier',
      },
      {
        name: 'scope-1', url: 'src/v2/structure/scope-1.json',
        version: { version: scope.meta.version, characters: String(scope.chars.length), charactersSha256: scope.meta.sha256 },
        sha256: scope.fileSha256, use: 'which characters the table holds: grade 1–10, the study and exploration corpora, the benchmark titles',
      },
    ],
    coverage: 'scope-1 (grade 1–10 ∪ corpus characters ∪ benchmark titles); a character of the scope the source has no IDS for is not in the table and is listed in absent',
    selection: 'a character\'s own structure: an IDS whose plain source letters include J, else one whose bracketed (virtual) letters include [J], else all; a component opened inside another character: [J], else J, else all. Within the pool: parses before not, fewest unencoded components, fewest tokens, IDS by code point, source letters. An unencoded component is never overwritten: another region\'s IDS of the same shape is recorded beside it (supplements, nearest region first: JTHKGVPUSBMX).',
    normalization: {
      maxDepth: MAX_DEPTH,
      rules: [
        'a component (no reading of its own) opens into its own selected structure',
        'a character or a variant is kept whole (the runtime view sees through it only to read a homogeneous repetition)',
        'strokes appear only where the data writes them',
        'a component never opens into itself (cycle-stop), nor deeper than maxDepth (depth-stop)',
      ],
    },
    tiers: {
      character: 'KANJIDIC2 grade 1–10, and 囗 (written as 口); inside a character 一 is a stroke',
      stroke: [...STROKES, 'U+31C0–U+31EF'],
      variant: 'a form listed in forms as variant-of',
      component: 'any other encoded component',
      unknown: '{nn}: an unencoded component',
    },
    forms: FORMS,
    shards: { count: SHARDS, of: 'code point mod 16', files },
    entries: entries.size,
    status,
    absent,
    sha256: sha(Buffer.from(files.map((f) => f.sha256).join(''))),
  }
  const out = new Map(shards)
  out.set('manifest.json', canonical(manifest) + '\n')
  out.set('NOTICE.txt', [
    'structure-1 — the structure of characters for generator v2 of ことばのかたち.',
    '',
    'Made by tools/v2/structure.mjs from:',
    `  BabelStone IDS (Andrew West), ${manifest.sources[0].url}, File Date ${manifest.sources[0].version['File Date']}, sha256 ${idsSha}.`,
    '    The file states that IDS sequences, as a collection of facts, are not eligible for copyright protection.',
    `  KANJIDIC2 (Electronic Dictionary Research and Development Group), ${manifest.sources[1].url},`,
    `    database_version ${manifest.sources[1].version.database_version}, sha256 ${kdSha}; used under the EDRDG licence`,
    '    (Creative Commons Attribution-ShareAlike 4.0): only the set of characters of grade 1–10 is read,',
    '    to decide which characters count as standalone characters.',
    `  scope-1 (src/v2/structure/scope-1.json, version ${scope.meta.version}): the characters the table holds.`,
    '',
  ].join('\n'))
  return { files: out, manifest }
}

const main = import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/').replace(/^\//, '')}` || process.argv[1]?.endsWith('structure.mjs')
if (main) {
  const ids = arg('--ids')
  const kanjidic = arg('--kanjidic')
  const outDir = arg('--out') ?? 'public/v2/structure-1'
  if (!ids || !kanjidic) {
    console.error('usage: --ids <IDS.TXT> --kanjidic <kanjidic2.xml.gz> [--scope scope-1.json] [--out dir] [--check]')
    process.exit(2)
  }
  const { files, manifest } = generate(ids, kanjidic, arg('--scope'))
  if (process.argv.includes('--check')) {
    const differ = []
    for (const [name, text] of files) {
      const p = join(outDir, name)
      if (!existsSync(p) || !readFileSync(p).equals(Buffer.from(text))) differ.push(name)
    }
    console.log(JSON.stringify({ check: outDir, files: files.size, differ, sha256: manifest.sha256 }))
    process.exit(differ.length ? 1 : 0)
  }
  mkdirSync(outDir, { recursive: true })
  for (const [name, text] of files) writeFileSync(join(outDir, name), text)
  console.log(JSON.stringify({ wrote: outDir, entries: manifest.entries, status: manifest.status, sha256: manifest.sha256 }))
}
