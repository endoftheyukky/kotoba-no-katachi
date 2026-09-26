// v2 Stage 7 (spec-1 §16): SpatialPlan. Rules compile constraints into primitives; the choice is §7.3's
// order (unmotivated, satisfied, RULE_ORDER), never a score; the words never replace a structure.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { analyzeLanguage } from '../src/language/analysis'
import { normalizeTitle } from '../src/title'
import { alignIndex } from '../src/v2/align/lookup'
import type { AlignManifest, AlignShard } from '../src/v2/align/table'
import { constrain } from '../src/v2/constraints'
import { discover, select } from '../src/v2/discovery'
import type { DiscoveryInput } from '../src/v2/discovery/input'
import { plan, selectPlan } from '../src/v2/plan'
import { leavesOf, resonanceIndex, resonate, type ResonanceManifest, type ResonanceShard } from '../src/v2/resonance'
import { RULE_ORDER } from '../src/v2/spec'
import { structureIndex } from '../src/v2/structure/lookup'
import type { StructureManifest, StructureShard } from '../src/v2/structure/table'

const root = join(import.meta.dirname, '..')
const load = <M extends { shards: { files: readonly { name: string }[] } }, S>(dir: string) => {
  const manifest = JSON.parse(readFileSync(join(root, dir, 'manifest.json'), 'utf8')) as M
  return { manifest, shards: manifest.shards.files.map((f) => JSON.parse(readFileSync(join(root, dir, f.name), 'utf8')) as S) }
}
const S = load<StructureManifest, StructureShard>('public/v2/structure-1')
const A = load<AlignManifest, AlignShard>('public/v2/align-1')
const R = load<ResonanceManifest, ResonanceShard>('public/v2/resonance-1')
const structure = structureIndex(S.manifest, S.shards)
const align = alignIndex(A.manifest, A.shards)
const resonance = resonanceIndex(R.manifest, R.shards)
const leaves = leavesOf(structure)

function planned(text: string, reading?: string) {
  const t = normalizeTitle({ text, reading })
  if (typeof t === 'string') throw new Error(t)
  const input: DiscoveryInput = { language: analyzeLanguage(t), structure, align, relations: [] }
  const ds = discover(input)
  const sel = select(ds, input)
  const evidence = resonate(ds, sel, resonance, leaves, (g) => input.language.graphemes[g]?.char)
  const set = constrain(ds, sel, evidence, input.language)
  const primary = sel.primary ? ds.find((d) => d.id === sel.primary)! : null
  return { set, p: plan(set.constraints, primary, input.language.graphemes) }
}

describe('SpatialPlan: §15.2\'s rules for the benchmark', () => {
  const expected: Record<string, string> = {
    淋: 'FieldSingleton', 海: 'RegionSplit', 血: 'FieldSingleton', 州: 'FieldInterleave', 闇: 'NestedRegions', 囚: 'NestedRegions',
    問: 'GlyphItself', 辻: 'CrossRoads', 悲: 'Separation', 雨: 'WholeEmerges', 林: 'WholeEmerges', 森: 'WholeEmerges', 品: 'WholeEmerges',
  }
  for (const [c, rule] of Object.entries(expected)) test(`${c}: ${rule}`, () => assert.equal(planned(c).p.plan.rule, rule))

  test('淋 闇 辻 雨 have more than one candidate (§16 stage 7), all kept', () => {
    for (const c of ['淋', '闇', '辻', '雨']) assert.ok(planned(c).p.selection.candidates.length >= 2, c)
  })
})

describe('SpatialPlan: the grammar and its order', () => {
  const titles = ['淋', '海', '州', '闇', '問', '辻', '悲', '雨', '林', '森', '品', '十', '見えない', 'ころころ', '雨の中の雨', '月', '川または州']

  test('a plan keeps only constraints that exist, names what it adds unasked, and is chosen by §7.3\'s order', () => {
    for (const t of titles) {
      const { set, p } = planned(t)
      const ids = new Set(set.constraints.map((c) => c.id))
      for (const c of p.selection.candidates) for (const s of c.satisfied) assert.ok(ids.has(s), `${t}: ${c.rule} → ${s}`)
      const rank = (r: string) => (RULE_ORDER as readonly string[]).indexOf(r)
      const sorted = [...p.selection.candidates].sort((a, b) => a.unmotivated.length - b.unmotivated.length || b.satisfied.length - a.satisfied.length || rank(a.rule) - rank(b.rule))
      assert.equal(p.plan.rule, sorted[0].rule, t)
      assert.equal(selectPlan(p.selection.candidates).rule, p.plan.rule)
      assert.deepEqual(p.plan.unmotivated, [], `${t}: the chosen plan adds nothing unasked`)
    }
  })

  test('nothing found: Absent, and nothing else is made up', () => {
    const { set, p } = planned('月')
    assert.equal(set.constraints.length, 0)
    assert.equal(p.plan.rule, 'Absent')
    assert.equal(p.selection.candidates.length, 1)
  })

  test('the words never replace a structure: Sequence only where no structural constraint is; the rest of a longer title stands beside', () => {
    const rain = planned('雨の中の雨', 'あめのなかのあめ')
    assert.equal(rain.p.plan.rule, 'WholeEmerges')
    assert.ok(!rain.p.selection.candidates.some((c) => c.rule === 'Sequence'))
    assert.deepEqual([...rain.p.rest], [1, 2, 3, 4])
    const neg = planned('見えない')
    assert.equal(neg.p.plan.rule, 'Sequence')
    assert.deepEqual([...neg.p.rest], [])
  })

  test('ScaleTransfer is a candidate for character units only (never 雨\'s dots), and WholeEmerges is the default (TODO-3)', () => {
    assert.ok(!planned('雨').p.selection.candidates.some((c) => c.rule === 'ScaleTransfer'))
    for (const c of ['林', '森', '品']) {
      const p = planned(c).p
      assert.ok(p.selection.candidates.some((x) => x.rule === 'ScaleTransfer'), c)
      assert.equal(p.plan.rule, 'WholeEmerges', c)
    }
  })

  test('the same title gives the same plan and candidates', () => {
    for (const t of titles) assert.equal(JSON.stringify(planned(t).p), JSON.stringify(planned(t).p), t)
  })

  test('the plan code reads no fixture', () => {
    for (const f of readdirSync(join(root, 'src/v2/plan'))) assert.ok(!/fixtures/.test(readFileSync(join(root, 'src/v2/plan', f), 'utf8')), f)
  })
})
