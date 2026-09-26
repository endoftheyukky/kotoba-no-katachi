// v2 Stage 1 (spec-1 §16): the types and the Niikuni benchmark fixtures, checked
// at run time — and v1 left exactly as it was. No generator runs here.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, test } from 'node:test'
import { CASES } from '../src/v2/fixtures/cases'
import type { BenchmarkCase, DiscoveryPattern } from '../src/v2/fixtures/types'
import { CONSTANTS, RESERVED_PHONOLOGICAL, RULE_ORDER, SPEC, TYPE_ORDER } from '../src/v2/spec'
import { l0, l1, SAMPLE_DISCOVERIES } from '../src/v2/types.check'
import {
  isReservedPhonological, isRuntimeDistance, isTodo, missingInDiscovery, missingInPattern, resonanceProblems, traceProvenance,
} from '../src/v2/validate'
import { VERSIONS as SHARE_VERSIONS, CURRENT as SHARE_CURRENT } from '../server/share'
import { GENERATORS } from '../src/archive/protocol'

const cases = CASES as readonly BenchmarkCase[]
const byTitle = new Map(cases.map((c) => [c.title, c]))

/** every Discovery pattern a case names: primary, secondary, candidates */
function patternsOf(c: BenchmarkCase): DiscoveryPattern[] {
  const out: DiscoveryPattern[] = []
  if (c.expect.primary.value) out.push(c.expect.primary.value)
  for (const e of c.expect.secondary ?? []) out.push(e.value)
  for (const e of c.expect.candidates ?? []) out.push(e.value)
  return out
}

describe('v2 fixtures: the benchmark as expected structure', () => {
  test('every case spec-1 asks for is there, once', () => {
    const benchmark = ['雨', '闇', '淋', '林', '州', '血', '囚', '辻', '悲']
    const control = ['海', '問', '田', '品', '森']
    const generalization = ['琳', '淡', '間', '聞', '回', '困', '日', '系', '机', '春']
    assert.equal(new Set(cases.map((c) => c.title)).size, cases.length, 'titles are unique')
    for (const [set, titles] of [['benchmark', benchmark], ['control', control], ['generalization', generalization]] as const) {
      for (const t of titles) assert.equal(byTitle.get(t)?.set, set, `${t} is a ${set} case`)
    }
    assert.equal(cases.length, benchmark.length + control.length + generalization.length)
  })

  test('every expected Discovery names the terms its type needs', () => {
    for (const c of cases) {
      for (const p of patternsOf(c)) assert.deepEqual(missingInPattern(p), [], `${c.title}: ${p.type}`)
    }
  })

  test('the Discoveries spec-1 §15.1 names are expected as written', () => {
    const primary = (t: string) => byTitle.get(t)!.expect.primary.value
    assert.deepEqual(primary('淋'), { type: 'addition', base: '林', delta: ['氵'], side: 'left', count: 1 })
    assert.deepEqual(byTitle.get('淋')!.expect.secondary?.[0].value, {
      type: 'nested', term: '林', holds: { type: 'internal_repetition', unit: '木', unitTier: 'character', n: 2, arrangement: '⿰', remainder: null },
    })
    assert.deepEqual(primary('雨'), { type: 'internal_repetition', unit: '丶', unitTier: 'stroke', n: 4, arrangement: '2x2', remainder: '冂' })
    assert.deepEqual(primary('闇'), { type: 'enclosure', container: '門', contained: '音', operator: '⿵' })
    assert.equal(primary('辻')?.type, 'partial_enclosure')
    assert.equal(byTitle.get('辻')!.expect.secondary?.[0].value.type, 'intersection')
    assert.equal(primary('州')?.type === 'addition' && primary('州')?.side, 'interleaved')
    // controls and generalisation: the same rules, the same kinds of answer
    assert.equal(primary('品')?.type, 'internal_repetition')
    assert.ok(byTitle.get('品')!.expect.notPrimary?.some((e) => e.value === 'addition'))
    assert.equal(primary('琳')?.type, primary('淋')?.type, '琳 and 淋 are the same type; not telling them apart is correct')
    assert.equal(primary('淡')?.type, 'addition')
    for (const t of ['日', '机', '春']) assert.equal(primary(t), null, `${t}: nothing passes its gates`)
  })

  test('every case is fixed by a person, against spec-1; none carries a weight, a score or a work to favour', () => {
    const forbidden = /score|weight|priority|boost|niikuni|poetic/i
    const walk = (v: unknown, path: string) => {
      if (v && typeof v === 'object') {
        for (const [k, x] of Object.entries(v)) {
          assert.ok(!forbidden.test(k), `${path}.${k}: no such field in a fixture`)
          walk(x, `${path}.${k}`)
        }
      }
    }
    for (const c of cases) {
      assert.equal(c.provenance.kind, 'human-benchmark')
      assert.equal(c.provenance.spec, SPEC)
      assert.deepEqual(Object.keys(c).sort(), ['expect', 'provenance', 'set', 'title', ...(c.reading ? ['reading'] : [])].sort())
      walk(c.expect, c.title)
      // expectations are patterns: they never carry what only a generated value has
      for (const p of patternsOf(c)) for (const k of ['id', 'evidence', 'basis', 'graphemes']) assert.ok(!(k in p), `${c.title}: a pattern has no ${k}`)
    }
  })

  test('an expectation that waits for a TODO names a TODO the spec has', () => {
    for (const c of cases) {
      const all = [c.expect.primary, ...(c.expect.secondary ?? []), ...(c.expect.candidates ?? []), ...(c.expect.notPrimary ?? []),
        ...(c.expect.resonance ?? []), ...(c.expect.noResonance ?? [])]
      for (const e of all) for (const t of e.when ?? []) assert.ok(isTodo(t), `${c.title}: ${t}`)
    }
  })
})

describe('v2 resonance: L0 / L1 at run time, L2 / L3 only as what is left out', () => {
  test('every expected resonance is L0 or L1, from a known origin in resonance-1', () => {
    for (const c of cases) for (const e of c.expect.resonance ?? []) assert.deepEqual(resonanceProblems(e.value), [], `${c.title}: ${e.value.type}`)
  })

  test('excluded associations are L2 or L3, never run-time distances', () => {
    let n = 0
    for (const c of cases) for (const x of c.expect.excluded ?? []) {
      assert.ok(!isRuntimeDistance(x.distance), `${c.title}: ${x.from} → ${x.to}`)
      n++
    }
    assert.ok(n > 0, 'the benchmark names at least one thing a page must not claim')
  })

  test('machine-shaped evidence is L0 / L1 and traceable to its table', () => {
    for (const r of [l0, l1]) {
      assert.deepEqual(resonanceProblems(r), [])
      assert.equal(traceProvenance(r.provenance), `table resonance-1 [${r.provenance.kind === 'table' ? r.provenance.key : ''}]`)
    }
  })
})

describe('v2 Discovery values: terms, evidence, basis, provenance', () => {
  test('a generated Discovery keeps its terms, evidence and basis, and every evidence can be followed to its source', () => {
    for (const d of SAMPLE_DISCOVERIES) {
      assert.deepEqual(missingInDiscovery(d), [], d.id)
      for (const e of d.evidence) assert.ok(traceProvenance(e.provenance), `${d.id}: ${e.id}`)
    }
    const trail = SAMPLE_DISCOVERIES[0].evidence.map((e) => traceProvenance(e.provenance))
    assert.deepEqual(trail, ['table structure-1 [淋]', 'table align-1 [淋]', `const ADDITION_MAX_DELTA_SHARE = ${CONSTANTS.ADDITION_MAX_DELTA_SHARE.value}`])
  })

  test('a source the spec does not know cannot be followed', () => {
    assert.equal(traceProvenance({ kind: 'table', table: 'kanjivg' as never, key: '淋' }), null)
    assert.equal(traceProvenance({ kind: 'rule', rule: 'guess:淋' as never }), null)
    assert.equal(traceProvenance({ kind: 'table', table: 'structure-1', key: '' }), null)
  })

  test('the reserved sound types are named, and refused until TODO-6', () => {
    for (const t of RESERVED_PHONOLOGICAL) assert.ok(isReservedPhonological(t))
    const reserved = { ...SAMPLE_DISCOVERIES[2], type: 'homophony' as const }
    assert.ok(missingInDiscovery(reserved).some((m) => m.includes('reserved')))
  })

  test('the spec\'s orders are complete', () => {
    assert.deepEqual([...TYPE_ORDER], ['addition', 'internal_repetition', 'inter_containment', 'inter_similarity', 'enclosure', 'composition', 'partial_enclosure', 'intersection'])
    assert.equal(RULE_ORDER.length, 12)
    assert.equal(RULE_ORDER[RULE_ORDER.length - 1], 'Absent')
  })
})

describe('v1 is untouched', () => {
  const root = join(import.meta.dirname, '..')
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f)
      return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : []
    })

  test('the published versions are still v1 only, and v1 is still current', () => {
    assert.deepEqual([...SHARE_VERSIONS], [1])
    assert.equal(SHARE_CURRENT, 1)
    assert.deepEqual([...GENERATORS], ['v1'])
    const generators = readFileSync(join(root, 'src/poem/generators.ts'), 'utf8')
    assert.match(generators, /export const VERSIONS = \[1\] as const/)
    assert.match(generators, /export const CURRENT: Version = 1/)
  })

  test('v1\'s regression fixture is byte for byte what it was', () => {
    const hash = createHash('sha256').update(readFileSync(join(root, 'tools/verify/expected.json'))).digest('hex')
    assert.equal(hash, 'e249ad7df45bdb2e02a7ee3fc7d62acdc0953e268931b896050d4e9d790a1956')
  })

  test('nothing outside src/v2 imports it', () => {
    for (const f of [...files(join(root, 'src')), ...files(join(root, 'server'))]) {
      if (relative(root, f).replace(/\\/g, '/').startsWith('src/v2/')) continue
      assert.ok(!/from ['"][^'"]*\/v2\//.test(readFileSync(f, 'utf8')), `${relative(root, f)} imports v2`)
    }
  })

  test('no v2 code reads the benchmark\'s expected values (R6: the benchmark is not a teacher)', () => {
    for (const f of files(join(root, 'src/v2'))) {
      const rel = relative(root, f).replace(/\\/g, '/')
      if (rel.startsWith('src/v2/fixtures/')) continue
      assert.ok(!/(from|import)\s*\(?\s*['"][^'"]*fixtures\/cases['"]/.test(readFileSync(f, 'utf8')), `${rel} imports the benchmark's cases`)
    }
  })
})
