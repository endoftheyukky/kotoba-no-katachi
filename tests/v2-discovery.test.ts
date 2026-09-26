// v2 Stage 4 (spec-1 §16): Discovery candidates and Selection over structure-1 and align-1.
// The Stage 1 fixtures are read here only as expected values (R6); no generator code imports them.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, test } from 'node:test'
import type { GlyphRelation } from '../src/glyph/relation'
import { analyzeLanguage } from '../src/language/analysis'
import { normalizeTitle } from '../src/title'
import { alignIndex } from '../src/v2/align/lookup'
import type { AlignManifest, AlignShard } from '../src/v2/align/table'
import { discover, gates, select } from '../src/v2/discovery'
import type { DiscoveryInput } from '../src/v2/discovery/input'
import { CASES } from '../src/v2/fixtures/cases'
import type { BenchmarkCase, DiscoveryPattern, Expect } from '../src/v2/fixtures/types'
import { structureIndex } from '../src/v2/structure/lookup'
import type { StructureManifest, StructureShard } from '../src/v2/structure/table'
import type { Discovery } from '../src/v2/types/discovery'
import { missingInDiscovery } from '../src/v2/validate'

const root = join(import.meta.dirname, '..')
const load = <M extends { shards: { files: readonly { name: string }[] } }, S>(dir: string) => {
  const manifest = JSON.parse(readFileSync(join(root, dir, 'manifest.json'), 'utf8')) as M
  return { manifest, shards: manifest.shards.files.map((f) => JSON.parse(readFileSync(join(root, dir, f.name), 'utf8')) as S) }
}
const S = load<StructureManifest, StructureShard>('public/v2/structure-1')
const A = load<AlignManifest, AlignShard>('public/v2/align-1')
const structure = structureIndex(S.manifest, S.shards)
const align = alignIndex(A.manifest, A.shards)

const inputFor = (text: string, relations: readonly GlyphRelation[] = [], reading?: string): DiscoveryInput => {
  const input = normalizeTitle({ text, reading })
  if (typeof input === 'string') throw new Error(input)
  return { language: analyzeLanguage(input), structure, align, relations }
}
const run = (text: string, relations: readonly GlyphRelation[] = [], reading?: string) => {
  const input = inputFor(text, relations, reading)
  const ds = discover(input)
  return { input, ds, sel: select(ds, input), byId: new Map(ds.map((d) => [d.id, d])) }
}

/** does a generated Discovery match a person's pattern (type and terms) */
function matches(d: Discovery, p: DiscoveryPattern, all: ReadonlyMap<string, Discovery>): boolean {
  if (d.type !== p.type) return false
  switch (p.type) {
    case 'internal_repetition': {
      const x = d as Extract<Discovery, { type: 'internal_repetition' }>
      return x.unit.char === p.unit && x.unitTier === p.unitTier && x.n === p.n && x.arrangement === p.arrangement && (x.remainder?.char ?? null) === p.remainder
    }
    case 'addition': {
      const x = d as Extract<Discovery, { type: 'addition' }>
      return x.base.char === p.base && x.delta.map((t) => t.char).join('') === p.delta.join('') && x.side === p.side && x.count === p.count && (p.arrangement === undefined || x.arrangement === p.arrangement)
    }
    case 'enclosure': {
      const x = d as Extract<Discovery, { type: 'enclosure' }>
      return x.container.char === p.container && x.contained.char === p.contained && x.operator === p.operator
    }
    case 'partial_enclosure': {
      const x = d as Extract<Discovery, { type: 'partial_enclosure' }>
      return x.wrapper.char === p.wrapper && x.core.char === p.core && x.operator === p.operator
    }
    case 'composition': {
      const x = d as Extract<Discovery, { type: 'composition' }>
      return x.parts.map((t) => t.char).join('+') === p.parts.join('+') && x.operator === p.operator
    }
    case 'intersection': {
      const x = d as Extract<Discovery, { type: 'intersection' }>
      return x.within === p.within && x.strokes.map((s) => s.char).join('') === p.strokes.join('')
    }
    case 'nested': {
      const x = d as Extract<Discovery, { type: 'nested' }>
      const held = all.get(x.holds)
      return x.term === p.term && !!held && matches(held, p.holds, all)
    }
  }
}

/** spec-1 settles none of its TODOs: an expectation that waits on one is pending */
const settled = (e: Expect<unknown>) => !(e.when ?? []).length

/**
 * Where the published tables and spec-1's provisional constants give another answer than a person
 * expected. Each is kept visible with the measurement that decides it, never made to pass by a
 * per-character rule: 琳's 𤣩 holds 26.8% of the ink, over ADDITION_MAX_DELTA_SHARE (0.25, a
 * provisional value, TODO-4/5).
 */
const KNOWN: Readonly<Record<string, { check: (r: ReturnType<typeof run>) => void; why: string }>> = {
  琳: {
    why: 'addition 林+𤣩 stops at addition:delta-share (0.268 > 0.25)',
    check: (r) => {
      const add = r.ds.find((d) => d.type === 'addition') as Extract<Discovery, { type: 'addition' }>
      assert.ok(add.ink.deltaShare > 0.25)
      assert.deepEqual(gates(add, r.input), ['addition:delta-share'])
    },
  },
}

describe('Discovery: the benchmark, controls and generalisation (spec-1 §15.1; fixtures as expected values only)', () => {
  for (const c of CASES as readonly BenchmarkCase[]) {
    test(`${c.title}: ${c.set}`, () => {
      const r = run(c.title)
      const primary = r.sel.primary ? r.byId.get(r.sel.primary)! : null
      const known = KNOWN[c.title]
      const e = c.expect.primary
      if (known) known.check(r)
      else if (settled(e)) {
        if (e.value === null) assert.equal(r.sel.primary, null, `${c.title}: ${r.sel.primary}`)
        else assert.ok(primary && matches(primary, e.value, r.byId), `${c.title}: primary ${r.sel.primary}`)
      } else {
        // pending (TODO-11 unsettled): the expected candidate is found; which one leads waits on the origin data
        for (const cand of c.expect.candidates ?? []) assert.ok(r.ds.some((d) => matches(d, cand.value, r.byId)), `${c.title}: candidate`)
      }
      for (const s of c.expect.secondary ?? []) {
        if (!settled(s)) continue
        const found = r.ds.filter((d) => matches(d, s.value, r.byId))
        assert.ok(found.length > 0, `${c.title}: secondary ${JSON.stringify(s.value)} found`)
        if (primary) assert.ok(found.some((d) => r.sel.secondary.includes(d.id)), `${c.title}: ${found.map((d) => d.id)} is secondary to ${r.sel.primary}`)
      }
      for (const cand of c.expect.candidates ?? []) if (settled(cand)) assert.ok(r.ds.some((d) => matches(d, cand.value, r.byId)), `${c.title}: candidate ${JSON.stringify(cand.value)}`)
      for (const n of c.expect.notPrimary ?? []) if (settled(n)) assert.notEqual(primary?.type, n.value, `${c.title}: ${n.value} is not the primary`)
    })
  }

  test('the known deviations are exactly those listed (a new one fails here, a fixed one too)', () => {
    const off = (CASES as readonly BenchmarkCase[]).filter((c) => {
      const e = c.expect.primary
      if (!settled(e)) return false
      const r = run(c.title)
      const primary = r.sel.primary ? r.byId.get(r.sel.primary)! : null
      return e.value === null ? r.sel.primary !== null : !(primary && matches(primary, e.value, r.byId))
    })
    assert.deepEqual(off.map((c) => c.title), Object.keys(KNOWN))
  })
})

describe('Discovery: structure is the truth, align-1 an observation', () => {
  test('every Discovery is complete: terms, evidence traceable to a table or a v1 module, a basis', () => {
    for (const t of ['雨', '闇', '淋', '林', '州', '血', '囚', '辻', '悲', '森', '品', '海', '見えない', 'ころころ', '雨の中の雨']) {
      for (const d of run(t).ds) assert.deepEqual(missingInDiscovery(d), [], `${t}: ${d.id}`)
    }
  })

  test('a Discovery carries no page coordinate, size or score', () => {
    const banned = /"(score|rank|weight|x0|pageX|size|font)"/
    for (const t of ['淋', '雨', '闇']) for (const d of run(t).ds) assert.doesNotMatch(JSON.stringify(d), banned, d.id)
  })

  test('without any geometry the structural relations are still found (a character outside the face)', () => {
    const e = align.entry('娱')!
    assert.equal(e.status, 'whole-not-in-face')
    const s = structure.lookup('娱')
    assert.equal(s.status, 'found')
    const r = run('娱')
    assert.ok(r.ds.length > 0, 'candidates from the structure alone')
    for (const d of r.ds.filter((x) => x.type === 'addition')) {
      const failed = gates(d, r.input)
      assert.ok(failed.every((g) => /base-scale|base-aspect|delta-share|delta-pieces|side-agrees|delta-tier|not-same-unit|one-character/.test(g)), failed.join())
    }
  })

  test('an ink gate reads only an aligned placement: approximate or unavailable is "not observed", never "absent"', () => {
    // every addition whose base is not aligned fails all its ink gates and keeps its structural terms
    let n = 0
    for (const c of ['俄', '個', '値', '州', '淋', '其', '亭']) {
      const r = run(c)
      for (const d of r.ds) {
        if (d.type !== 'addition') continue
        const row = align.entry(c)?.rows.find((x) => x.depth === 1 && x.node.kind === 'leaf' && x.node.char === d.base.char)
        if (row?.status === 'aligned') continue
        n++
        const failed = gates(d, r.input)
        for (const g of ['addition:base-scale', 'addition:base-aspect', 'addition:delta-share', 'addition:delta-pieces', 'addition:side-agrees'] as const) assert.ok(failed.includes(g), `${c}: ${g}`)
      }
    }
    assert.ok(n > 0, 'some base is not aligned')
  })

  test('a repetition is read at the leaves first (雨: 丶×4 in a 2 × 2, not two pairs); two strokes are no candidate (心 皿)', () => {
    const rain = run('雨').ds.filter((d) => d.type === 'internal_repetition')
    assert.equal(rain.length, 1)
    assert.ok(rain[0].type === 'internal_repetition' && rain[0].unit.char === '丶' && rain[0].n === 4 && rain[0].arrangement === '2x2')
    for (const c of ['心', '皿']) assert.ok(!run(c).ds.some((d) => d.type === 'internal_repetition' && d.unitTier === 'stroke'), c)
  })

  test('a repetition\'s units stand where the ink shows them: 森\'s three 木, one above two', () => {
    const d = run('森').ds.find((x) => x.type === 'internal_repetition' && x.whole.char === '森')!
    assert.ok(d.type === 'internal_repetition')
    const o = d.groupGeometry.offsets
    assert.equal(o.length, 3)
    assert.equal(d.groupGeometry.across, 2)
    const [top, ...bottom] = [...o].sort((a, b) => a.y - b.y)
    assert.ok(bottom.every((b) => b.y > top.y + 20))
    assert.ok(d.evidence.some((e) => e.provenance.kind === 'table' && e.provenance.table === 'align-1' && (e.value ?? 0) === 3), 'three alike islands')
  })

  test('nothing is a normal result: 一 and 日 have no primary, and say why', () => {
    const one = run('一')
    assert.equal(one.ds.length, 0)
    assert.equal(one.sel.primary, null)
    assert.match(one.sel.none!.reason, /no candidate/)
    const sun = run('日')
    assert.equal(sun.sel.primary, null)
    assert.ok(sun.ds.length > 0 && sun.sel.rejected.every((r) => r.failed.length > 0))
  })
})

describe('Discovery: words, sound and the title\'s characters together', () => {
  test('lexical and phonological Discoveries come from v1\'s readings and are never the primary', () => {
    const neg = run('見えない')
    assert.ok(neg.ds.some((d) => d.type === 'negation') && neg.ds.some((d) => d.type === 'inflection'))
    const kk = run('ころころ')
    assert.ok(kk.ds.some((d) => d.type === 'reduplication') && kk.ds.some((d) => d.type === 'echo'))
    assert.ok(run('雨の中の雨', [], 'あめのなかのあめ').ds.some((d) => d.type === 'mirror'))
    for (const r of [neg, kk]) {
      for (const d of r.ds) if (d.level === 'lexical' || d.level === 'phonological') assert.deepEqual(gates(d, r.input), ['type:not-primary-capable'])
    }
  })

  test('a relation between two written characters (v1 relate) is an inter-character Discovery, with its gates', () => {
    const rel = (score: number): GlyphRelation => ({ kind: 'containment', origin: 'title', inner: '川', outer: '州', score, containment: score, overlap: 0.9, dx: 0, dy: 0, scale: 1, residue: { share: 0.28, pieces: [], box: { x: 0, y: 0, w: 0, h: 0 }, centroid: { x: 0, y: 0 }, substance: 1 } })
    const strong = run('川州', [rel(0.9)])
    const d = strong.ds.find((x) => x.type === 'inter_containment')!
    assert.ok(d && d.type === 'inter_containment' && d.inner.char === '川' && d.outer.char === '州')
    assert.deepEqual(gates(d, strong.input), [])
    const weak = run('川州', [rel(0.4)])
    assert.deepEqual(gates(weak.ds.find((x) => x.type === 'inter_containment')!, weak.input), ['inter:relation-threshold'])
  })

  test('the order of types decides between characters of one title (§4.3), never a score', () => {
    const r = run('悲淋')
    assert.equal(r.sel.primary, 'addition:1:林+氵')
  })
})

describe('Discovery: determinism and isolation', () => {
  test('the same title gives the same Discoveries and the same selection, in a canonical order', () => {
    for (const t of ['淋', '雨の中の雨', '森林', '辻']) {
      const a = run(t)
      const b = run(t)
      assert.equal(JSON.stringify(a.ds), JSON.stringify(b.ds))
      assert.equal(JSON.stringify(a.sel), JSON.stringify(b.sel))
      assert.equal(new Set(a.ds.map((d) => d.id)).size, a.ds.length, 'ids are unique')
    }
  })

  test('every character of the scope runs: a Discovery list and a selection, no throw', () => {
    const scope = (JSON.parse(readFileSync(join(root, 'src/v2/structure/scope-1.json'), 'utf8')) as { chars: [string, string[]][] }).chars
    let primaries = 0
    for (const [c] of scope) {
      const r = run(c)
      if (r.sel.primary) primaries++
      for (const d of r.ds) assert.equal(missingInDiscovery(d).length, 0, `${c}: ${d.id}`)
    }
    assert.ok(primaries > 0)
  })

  test('Discovery reads no fixture, no KanjiVG, no build code', () => {
    const dir = join(root, 'src/v2/discovery')
    const files = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? files(join(d, f)) : [join(d, f)]))
    for (const f of files(dir)) {
      const text = readFileSync(f, 'utf8')
      const rel = relative(root, f)
      assert.ok(!/from ['"][^'"]*fixtures/.test(text), `${rel} imports a fixture`)
      assert.ok(!/from ['"][^'"]*\/build\//.test(text), `${rel} imports build code`)
      assert.ok(!/kanjivg|align-eval/i.test(text), `${rel} names KanjiVG`)
    }
  })
})
