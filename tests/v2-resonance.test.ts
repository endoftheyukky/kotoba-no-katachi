// v2 Stage 5 (spec-1 §16): resonance-1 and Semantic Resonance. L0 / L1 only, typed, never a score.
// The Stage 1 fixtures are read here only as expected values (R6).
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, test } from 'node:test'
import { analyzeLanguage } from '../src/language/analysis'
import { normalizeTitle } from '../src/title'
import { alignIndex } from '../src/v2/align/lookup'
import type { AlignManifest, AlignShard } from '../src/v2/align/table'
import { discover, select } from '../src/v2/discovery'
import type { DiscoveryInput } from '../src/v2/discovery/input'
import { CASES } from '../src/v2/fixtures/cases'
import type { BenchmarkCase, Expect, ResonancePattern } from '../src/v2/fixtures/types'
import { leavesOf, resonanceIndex, resonate, type ResonanceManifest, type ResonanceShard } from '../src/v2/resonance'
import { shardText } from '../src/v2/structure/build/serialize'
import { structureIndex } from '../src/v2/structure/lookup'
import type { StructureManifest, StructureShard } from '../src/v2/structure/table'
import type { SemanticEvidence } from '../src/v2/types/resonance'
import { isRuntimeDistance } from '../src/v2/validate'

const root = join(import.meta.dirname, '..')
const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex')
const load = <M extends { shards: { files: readonly { name: string }[] } }, S>(dir: string) => {
  const manifest = JSON.parse(readFileSync(join(root, dir, 'manifest.json'), 'utf8')) as M
  const files = manifest.shards.files.map((f) => readFileSync(join(root, dir, f.name)))
  return { manifest, files, shards: files.map((b) => JSON.parse(b.toString('utf8')) as S) }
}
const S = load<StructureManifest, StructureShard>('public/v2/structure-1')
const A = load<AlignManifest, AlignShard>('public/v2/align-1')
const R = load<ResonanceManifest, ResonanceShard>('public/v2/resonance-1')
const structure = structureIndex(S.manifest, S.shards)
const align = alignIndex(A.manifest, A.shards)
const index = resonanceIndex(R.manifest, R.shards)
const leaves = leavesOf(structure)

const run = (text: string) => {
  const t = normalizeTitle({ text })
  if (typeof t === 'string') throw new Error(t)
  const input: DiscoveryInput = { language: analyzeLanguage(t), structure, align, relations: [] }
  const ds = discover(input)
  const sel = select(ds, input)
  const own = (g: number) => input.language.graphemes[g]?.char
  return { input, ds, sel, evidence: resonate(ds, sel, index, leaves, own) }
}

const termsOf = (e: SemanticEvidence): string[] => {
  switch (e.type) {
    case 'part-referent': return [e.whole, e.unit]
    case 'component-whole': return [e.whole, ...e.components]
    case 'radical-meaning': return [e.whole, e.meaning]
    case 'origin': return [e.char]
    case 'schema': return e.distance === 'L1' ? [e.char, e.schema] : [e.char, e.concept]
    case 'lexical-candidate': return [e.char, e.component]
  }
}
const matches = (e: SemanticEvidence, p: ResonancePattern) => e.type === p.type && e.distance === p.distance && e.origin === p.origin && JSON.stringify(termsOf(e)) === JSON.stringify(p.terms)
const settled = (e: Expect<unknown>) => !(e.when ?? []).length

describe('resonance-1: the table as published', () => {
  test('every shard is the file the manifest names; the table hash is of the shard hashes', () => {
    assert.equal(R.manifest.id, 'resonance-1')
    R.manifest.shards.files.forEach((f, i) => {
      assert.equal(R.files[i].length, f.bytes, f.name)
      assert.equal(sha(R.files[i]), f.sha256, f.name)
    })
    assert.equal(sha(R.manifest.shards.files.map((f) => f.sha256).join('')), R.manifest.sha256)
  })

  test('the Python writer and the TypeScript canonical form agree byte for byte', () => {
    R.shards.forEach((s, i) => assert.equal(shardText(new Map(Object.entries(s.entries))), R.files[i].toString('utf8'), R.manifest.shards.files[i].name))
  })

  test('its sources are fixed files, pinned; character-origin types wait on TODO-11; nothing past L1', () => {
    const [wn, chive, scope, st] = R.manifest.sources
    assert.equal(wn.name, 'Japanese WordNet')
    assert.equal(chive.sha256, '885c7db3b8cd8ad1311ac32eafc874007f45010791b3c1f1e934a2aa0c7d22b0', 'chiVe v1.3 mc90 as spec-1 §11.3 pins it')
    assert.equal(scope.sha256, sha(readFileSync(join(root, 'src/v2/structure/scope-1.json'))))
    assert.equal(st.sha256, S.manifest.sha256)
    assert.deepEqual([...R.manifest.pending.types], ['origin', 'component-whole', 'lexical-candidate'])
    assert.deepEqual([...R.manifest.active], ['CONTAINER', 'MULTITUDE'])
    for (const s of R.shards)
      for (const r of Object.values(s.entries)) {
        assert.ok(!r.schema || Object.keys(r.schema).every((k) => k === 'CONTAINER' || k === 'MULTITUDE'), `${r.char}: only the active schemas`)
        for (const p of [...(r.partReferent ?? []), ...(r.radicalMeaning ?? []), ...(r.schemaDirect ?? [])]) assert.ok(p.path.length >= 1 && p.path.length <= 2, `${r.char}: one or two links`)
      }
    assert.doesNotMatch(readFileSync(join(root, 'public/v2/resonance-1/manifest.json'), 'utf8'), /[A-Z]:\\\\|\/Users\/|\/home\//, 'no personal paths')
  })

  const sources = process.env.V2_RESONANCE_SOURCES
  test('the same sources give the same table, byte for byte (python, several minutes)', { skip: sources ? false : 'set V2_RESONANCE_SOURCES to the folder holding wnjpn.db.gz and chive-1.3-mc90.tar.gz' }, () => {
    const r = spawnSync('python', ['tools/v2/resonance.py', '--wordnet', join(sources!, 'wnjpn.db.gz'), '--chive', join(sources!, 'chive-1.3-mc90.tar.gz'), '--check'], { cwd: root, encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } })
    assert.equal(r.status, 0, r.stdout + r.stderr)
    assert.deepEqual(JSON.parse(r.stdout.trim().split('\n').pop()!).differ, [])
  })
})

describe('Semantic Resonance: the benchmark\'s evidence (fixtures as expected values only)', () => {
  for (const c of CASES as readonly BenchmarkCase[]) {
    const want = [...(c.expect.resonance ?? [])].filter(settled)
    const none = [...(c.expect.noResonance ?? [])].filter(settled)
    if (!want.length && !none.length) continue
    test(`${c.title}`, () => {
      const { evidence } = run(c.title)
      for (const w of want) assert.ok(evidence.some((e) => matches(e, w.value)), `${c.title}: ${JSON.stringify(w.value)} in ${JSON.stringify(evidence.map((e) => [e.type, e.distance, ...termsOf(e)]))}`)
      for (const n of none) assert.ok(!evidence.some((e) => e.type === n.value), `${c.title}: no ${n.value}`)
    })
  }
})

describe('Semantic Resonance: typed, L0 / L1 only, and never a condition of a Discovery', () => {
  const titles = ['雨', '闇', '淋', '林', '州', '血', '囚', '辻', '悲', '海', '問', '森', '品', '間', '的', '机', '田']

  test('every piece of evidence is L0 or L1, names its row in resonance-1, and carries no score', () => {
    for (const t of titles)
      for (const e of run(t).evidence) {
        assert.ok(isRuntimeDistance(e.distance), `${t}: ${e.id}`)
        assert.deepEqual(e.provenance.kind === 'table' && e.provenance.table, 'resonance-1')
        assert.ok(e.type !== 'origin' && e.type !== 'component-whole' && e.type !== 'lexical-candidate', `${t}: ${e.type} waits on TODO-11`)
        assert.doesNotMatch(JSON.stringify(e), /"(score|weight|similarity)"/)
        if (e.type === 'schema' && e.distance === 'L1') assert.ok(e.percentile >= 90)
      }
  })

  test('L1 only in its two pairs: an enclosure with CONTAINER, a repetition of characters with MULTITUDE', () => {
    for (const t of titles) {
      const r = run(t)
      for (const e of r.evidence) {
        if (e.type !== 'schema' || e.distance !== 'L1') continue
        const d = r.ds.find((x) => (x.id === r.sel.primary || r.sel.secondary.includes(x.id)) && (e.structure === 'enclosure' ? x.type === 'enclosure' : x.type === 'internal_repetition' && x.unitTier === 'character'))
        assert.ok(d, `${t}: ${e.id} has its structure`)
        assert.equal(e.schema, e.structure === 'enclosure' ? 'CONTAINER' : 'MULTITUDE')
      }
    }
    // 問 is an enclosure too, but its word does not stand high on CONTAINER: no L1
    assert.ok(!run('問').evidence.some((e) => e.type === 'schema'))
  })

  test('a Discovery stands without evidence: the selection is the same with or without it', () => {
    for (const t of titles) {
      const r = run(t)
      assert.equal(JSON.stringify(select(r.ds, r.input, r.evidence)), JSON.stringify(r.sel), t)
    }
    // and a title with no evidence at all still has its Discovery
    const m = run('悲')
    assert.equal(m.evidence.length, 0)
    assert.ok(m.sel.primary)
  })

  test('no association is made up: 淋 gets 林 has-member 木, and nothing of tears or loneliness', () => {
    const e = run('淋').evidence
    assert.ok(e.some((x) => x.type === 'part-referent' && x.whole === '林' && x.unit === '木'))
    assert.doesNotMatch(JSON.stringify(e), /涙|孤独|寂|さびし/)
  })

  test('the same title gives the same evidence', () => {
    for (const t of titles) assert.equal(JSON.stringify(run(t).evidence), JSON.stringify(run(t).evidence))
  })

  test('the resonance code reads no fixture, no model and no axes', () => {
    const dir = join(root, 'src/v2/resonance')
    for (const f of readdirSync(dir).filter((x) => statSync(join(dir, x)).isFile())) {
      const text = readFileSync(join(dir, f), 'utf8')
      assert.ok(!/from ['"][^'"]*fixtures/.test(text), relative(root, join(dir, f)))
      assert.ok(!/from ['"][^'"]*(semantic|axes)/.test(text), `${f} reads the axes`)
      assert.ok(!/fetch\(|anthropic|openai|llm/i.test(text.replace(/\/\*[\s\S]*?\*\//g, '')), `${f} calls a model`)
    }
  })
})
