// v2 Stage 6 (spec-1 §16): Constraints. Every constraint names the Discovery (and evidence) it keeps;
// none is made without one; the words and the sound only ever add auxiliary constraints.
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
import { leavesOf, resonanceIndex, resonate, type ResonanceManifest, type ResonanceShard } from '../src/v2/resonance'
import { structureIndex } from '../src/v2/structure/lookup'
import type { StructureManifest, StructureShard } from '../src/v2/structure/table'
import type { Constraint } from '../src/v2/types/constraints'

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

function through(text: string, reading?: string) {
  const t = normalizeTitle({ text, reading })
  if (typeof t === 'string') throw new Error(t)
  const input: DiscoveryInput = { language: analyzeLanguage(t), structure, align, relations: [] }
  const ds = discover(input)
  const sel = select(ds, input)
  const evidence = resonate(ds, sel, resonance, leaves, (g) => input.language.graphemes[g]?.char)
  return { input, ds, sel, evidence, set: constrain(ds, sel, evidence, input.language) }
}
const kinds = (cs: readonly Constraint[]) => cs.map((c) => c.kind)
const find = <K extends Constraint['kind']>(cs: readonly Constraint[], k: K) => cs.find((c): c is Extract<Constraint, { kind: K }> => c.kind === k)
const AUX = new Set(['sequence', 'split', 'recurrence'])

describe('Constraints: the benchmark translated by §6 (fixtures are not read)', () => {
  test('淋: an addition kept — the base is the field, the derived character differs, on the left, found not shown; its base\'s 木×2 gives the rhythm', () => {
    const { set } = through('淋')
    assert.equal(find(set.constraints, 'major')?.term, '林')
    assert.equal(find(set.constraints, 'difference')?.term, '淋')
    assert.equal(find(set.constraints, 'boundary-side')?.side, 'left')
    assert.equal(find(set.constraints, 'no-emphasis')?.term, '氵')
    assert.equal(find(set.constraints, 'visibility')?.target, 'hidden')
    assert.deepEqual([find(set.constraints, 'rhythm')?.n, find(set.constraints, 'rhythm')?.op], [2, '⿰'])
  })

  test('海: the delta is its radical\'s meaning (L0) — a band, seen at once', () => {
    const { set } = through('海')
    const zone = find(set.constraints, 'zone')!
    assert.equal(zone.term, '海')
    assert.ok(zone.because.evidence?.some((e) => e.startsWith('res:radical-meaning')))
    assert.equal(find(set.constraints, 'difference'), undefined)
    assert.equal(find(set.constraints, 'visibility')?.target, 'immediate')
  })

  test('州: three pieces between the strokes: interleave(3, row)', () => {
    const i = find(through('州').set.constraints, 'interleave')!
    assert.deepEqual([i.count, i.arrangement], [3, 'row'])
  })

  test('雨: a repetition kept — 丶 four times in a 2 × 2, the whole emerging where 冂 stands; its word\'s parts (L0) in the count\'s causes', () => {
    const cs = through('雨').set.constraints
    assert.deepEqual(kinds(cs).filter((k) => !AUX.has(k)), ['repeated', 'count', 'same-scale', 'whole-emerges', 'remainder-site'])
    assert.deepEqual([find(cs, 'count')!.n, find(cs, 'count')!.arrangement], [4, '2x2'])
    assert.ok(find(cs, 'count')!.because.evidence?.some((e) => e.startsWith('res:part-referent')))
    assert.equal(find(cs, 'remainder-site')!.remainder, '冂')
  })

  test('闇 and 囚 hold the page (CONTAINER, L1); 問 holds only itself (no evidence)', () => {
    for (const c of ['闇', '囚']) assert.equal(find(through(c).set.constraints, 'extent')?.scale, 'page', c)
    assert.equal(find(through('問').set.constraints, 'extent')?.scale, 'glyph')
  })

  test('辻: the wrapper\'s zone, the crossing of 十 (from the secondary), the whole at the interface', () => {
    const cs = through('辻').set.constraints
    assert.deepEqual([find(cs, 'wrapper-zone')?.term, find(cs, 'wrapper-zone')?.op], ['辶', '⿺'])
    assert.equal(find(cs, 'intersection')?.term, '十')
    assert.ok(find(cs, 'intersection')!.because.discovery.startsWith('intersection:'))
    assert.equal(find(cs, 'interface')?.term, '辻')
  })

  test('悲: two parts, stacked, with a seam', () => {
    const cs = through('悲').set.constraints
    assert.deepEqual(find(cs, 'regions')?.parts, ['非', '心'])
    assert.equal(find(cs, 'axis')?.op, '⿱')
    assert.equal(find(cs, 'separation')?.axis, 'horizontal')
  })
})

describe('Constraints: every one has a cause, none is made up', () => {
  const titles = ['淋', '雨', '闇', '囚', '辻', '悲', '海', '問', '森', '品', '州', '血', '見えない', 'ころころ', '雨の中の雨', '川または州', '人と入', '月', 'あ']

  test('every constraint names a Discovery of the title, and only evidence that was found', () => {
    for (const t of titles) {
      const { ds, evidence, set } = through(t)
      const ids = new Set(ds.map((d) => d.id))
      const evs = new Set(evidence.map((e) => e.id))
      for (const c of set.constraints) {
        assert.ok(ids.has(c.because.discovery), `${t}: ${c.id} → ${c.because.discovery}`)
        for (const e of c.because.evidence ?? []) assert.ok(evs.has(e as never), `${t}: ${c.id} → ${e}`)
        assert.ok(c.why.length > 0)
      }
      assert.equal(new Set(set.constraints.map((c) => c.id)).size, set.constraints.length, `${t}: ids unique`)
    }
  })

  test('no Discovery, no constraint: a title with nothing found has none, and that is not an error', () => {
    for (const t of ['月', 'あ']) {
      const { sel, set } = through(t)
      assert.equal(sel.primary, null)
      assert.deepEqual(set.constraints, [], t)
    }
  })

  test('the words and the sound add only auxiliary constraints, never a structure\'s', () => {
    for (const t of titles) {
      const { ds, set } = through(t)
      for (const c of set.constraints) {
        const d = ds.find((x) => x.id === c.because.discovery)!
        if (d.level === 'lexical' || d.level === 'phonological') assert.ok(AUX.has(c.kind), `${t}: ${c.id}`)
        else assert.ok(!AUX.has(c.kind) || c.kind === 'sequence', `${t}: ${c.id}`)
      }
    }
    const neg = through('見えない').set.constraints
    assert.ok(neg.some((c) => c.kind === 'split' && c.by === 'negation'))
    assert.ok(through('ころころ').set.constraints.some((c) => c.kind === 'recurrence'))
  })

  test('a relation between two written characters is kept as an addition would be (川 ⊂ 州)', () => {
    const t = normalizeTitle({ text: '川州' })
    if (typeof t === 'string') throw new Error(t)
    const input: DiscoveryInput = {
      language: analyzeLanguage(t), structure, align,
      relations: [{ kind: 'containment', origin: 'title', inner: '川', outer: '州', score: 0.9, containment: 0.9, overlap: 0.95, dx: 0, dy: 0, scale: 1, residue: { share: 0.28, pieces: [], box: { x: -40, y: -15, w: 80, h: 16 }, centroid: { x: -4, y: -7 }, substance: 1 } }],
    }
    const ds = discover(input)
    const sel = select(ds, input)
    const set = constrain(ds, sel, [], input.language)
    const p = ds.find((d) => d.id === sel.primary)
    if (p?.type === 'inter_containment') {
      assert.equal(find(set.constraints, 'major')?.term, '川')
      assert.equal(find(set.constraints, 'difference')?.term, '州')
      assert.ok(find(set.constraints, 'interleave') || find(set.constraints, 'boundary-side'))
    }
  })

  test('the same title gives the same constraints', () => {
    for (const t of titles) assert.equal(JSON.stringify(through(t).set), JSON.stringify(through(t).set), t)
  })

  test('every character of the scope runs; each primary gives at least one constraint', () => {
    const scope = (JSON.parse(readFileSync(join(root, 'src/v2/structure/scope-1.json'), 'utf8')) as { chars: [string, string[]][] }).chars
    for (const [c] of scope) {
      const { sel, set } = through(c)
      if (sel.primary) assert.ok(set.constraints.length > 0, c)
    }
  })

  test('the constraint code reads no fixture and no axes', () => {
    const dir = join(root, 'src/v2/constraints')
    for (const f of readdirSync(dir)) {
      const text = readFileSync(join(dir, f), 'utf8')
      assert.ok(!/from ['"][^'"]*fixtures/.test(text), f)
      assert.ok(!/from ['"][^'"]*semantic/.test(text), f)
    }
  })
})
