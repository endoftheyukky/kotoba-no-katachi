// v2 Stage 10 (spec-1 §16): the runtime Observation. A title reads only the shards of the fixed tables it
// reaches; the page it gives is the page the whole tables give. Offline data is read, never recomputed.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { analyzeLanguage } from '../src/language/analysis'
import { DIFFICULT_WORDS, EDGE_TITLES } from '../src/study/difficult'
import { HOLDOUT_TITLES } from '../src/study/holdout'
import { PROBE_TITLES } from '../src/study/probes'
import { STUDY_TITLES } from '../src/study/titles'
import { normalizeTitle } from '../src/title'
import { alignIndex } from '../src/v2/align/lookup'
import type { AlignManifest, AlignShard } from '../src/v2/align/table'
import { axesOf, composeV2 } from '../src/v2/compose'
import { observe } from '../src/v2/observation'
import { tablesFor } from '../src/v2/observation/tables'
import { resonanceIndex, type ResonanceManifest, type ResonanceShard } from '../src/v2/resonance'
import { structureIndex } from '../src/v2/structure/lookup'
import type { StructureManifest, StructureShard } from '../src/v2/structure/table'
import { axesTable, fileSource, root } from './v2-node'

const load = <M extends { shards: { files: readonly { name: string }[] } }, S>(dir: string) => {
  const manifest = JSON.parse(readFileSync(join(root, dir, 'manifest.json'), 'utf8')) as M
  return { manifest, shards: manifest.shards.files.map((f) => JSON.parse(readFileSync(join(root, dir, f.name), 'utf8')) as S) }
}
const S = load<StructureManifest, StructureShard>('public/v2/structure-1')
const A = load<AlignManifest, AlignShard>('public/v2/align-1')
const R = load<ResonanceManifest, ResonanceShard>('public/v2/resonance-1')
const whole = { structure: structureIndex(S.manifest, S.shards), align: alignIndex(A.manifest, A.shards), resonance: resonanceIndex(R.manifest, R.shards) }

const PUBLIC = [...STUDY_TITLES, ...HOLDOUT_TITLES, ...PROBE_TITLES, ...DIFFICULT_WORDS, ...EDGE_TITLES].map((t) => ({ text: t.text, reading: t.reading }))
const TITLES = [...PUBLIC, ...[...'雨闇淋林州血囚辻悲海問品森玉晶轟好男国閣日琳田回'].map((text) => ({ text, reading: undefined }))]

async function both(text: string, reading?: string) {
  const input = normalizeTitle({ text, reading })
  if (typeof input === 'string') throw new Error(input)
  const language = analyzeLanguage(input)
  const src = fileSource()
  const tables = await tablesFor(language.graphemes.map((g) => g.char), src)
  const axes = axesOf(input.text, axesTable)
  const part = observe({ input, language, titleRelations: [], axes, tables })
  const full = observe({ input, language, titleRelations: [], axes, tables: { ...tables, ...whole } })
  return { part, full, reads: src.reads }
}

describe('runtime Observation', () => {
  test('every public title and the benchmark: the page from the shards the title reached is the page from the whole tables', async () => {
    for (const t of TITLES) {
      const { part, full } = await both(t.text, t.reading)
      assert.equal(JSON.stringify(composeV2(part)), JSON.stringify(composeV2(full)), t.text)
    }
  })

  test('a title reads few shards: its characters and their components, followed down', async () => {
    const { part, reads } = await both('淋')
    assert.ok(part.tables.chars.includes('林') && part.tables.chars.includes('木'), 'the components, followed down')
    const align = reads.filter((r) => r.startsWith('align-1')).length
    assert.ok(align <= part.tables.chars.length, 'no shard beyond the characters reached')
    assert.ok(align < A.manifest.shards.count / 4, `${align} of ${A.manifest.shards.count}`)
  })

  test('a shard the title did not read cannot answer', async () => {
    const { part } = await both('淋')
    const other = [...'一二三四五六七八九十百千万円'].find((c) => !part.tables.read['structure-1'].includes(c.codePointAt(0)! % S.manifest.shards.count))!
    assert.throws(() => part.tables.structure.lookup(other), /was not read/)
  })

  test('the observation names the tables it read by id and sha256', async () => {
    const { part } = await both('森')
    assert.equal(part.data['align-1'].sha256, A.manifest.sha256)
    assert.equal(part.data['structure-1'].sha256, S.manifest.sha256)
    assert.equal(part.data['resonance-1'].sha256, R.manifest.sha256)
    assert.ok(part.ink.get('森')?.ink, 'the ink of the whole, as align-1 has it')
    assert.ok(part.structure.get('森'), 'its structure')
  })

  test('the runtime reads the tables as published: no table is built or changed at run time', () => {
    const src = ['src/v2/runtime.ts', 'src/v2/observation/index.ts', 'src/v2/observation/tables.ts'].map((f) => readFileSync(join(root, f), 'utf8')).join('\n')
    assert.ok(!/tools\/v2|build\/|fixtures|Math\.random/.test(src))
    // align-1 is Stage 3's, untouched
    const files = readdirSync(join(root, 'public/v2/align-1'))
    assert.equal(files.filter((f) => f.endsWith('.json') && f !== 'manifest.json').length, A.manifest.shards.count)
  })
})
