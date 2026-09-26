// v2 Stage 2 (spec-1 §16): structure-1, the fixed table of character structure, and the
// runtime lookup over it. The Stage 1 fixtures are read here only as expected values.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, test } from 'node:test'
import { CASES } from '../src/v2/fixtures/cases'
import type { BenchmarkCase } from '../src/v2/fixtures/types'
import { structureIndex, type StructureLookup } from '../src/v2/structure/lookup'
import type { StructureManifest, StructureShard, RegionalIds } from '../src/v2/structure/table'
import { homogeneous, idsOf, repeatedSubtrees } from '../src/v2/structure/view'
import { normalize } from '../src/v2/structure/build/normalize'
import { canonicalOrder, select } from '../src/v2/structure/build/select'
import { shardText } from '../src/v2/structure/build/serialize'
import type { IdsNode } from '../src/v2/types/structure'

const root = join(import.meta.dirname, '..')
const dir = join(root, 'public/v2/structure-1')
const manifestText = readFileSync(join(dir, 'manifest.json'), 'utf8')
const manifest = JSON.parse(manifestText) as StructureManifest
const shardFiles = manifest.shards.files.map((f) => readFileSync(join(dir, f.name)))
const shards = shardFiles.map((b) => JSON.parse(b.toString('utf8')) as StructureShard)
const index = structureIndex(manifest, shards)
const look = (c: string) => index.lookup(c)
const found = (c: string) => {
  const r = look(c)
  assert.equal(r.status, 'found', `${c}: ${r.status}`)
  return r as Extract<StructureLookup, { status: 'found' }>
}
const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex')

describe('structure-1: the table as published', () => {
  test('every shard is the file the manifest names, by size and sha256; the table hash is of the shard hashes', () => {
    assert.equal(manifest.id, 'structure-1')
    assert.equal(manifest.shards.files.length, manifest.shards.count)
    manifest.shards.files.forEach((f, i) => {
      assert.equal(shardFiles[i].length, f.bytes, f.name)
      assert.equal(sha(shardFiles[i]), f.sha256, f.name)
      assert.equal(Object.keys(shards[i].entries).length, f.entries, f.name)
    })
    assert.equal(sha(manifest.shards.files.map((f) => f.sha256).join('')), manifest.sha256)
    const total = shards.reduce((s, x) => s + Object.keys(x.entries).length, 0)
    assert.equal(total, manifest.entries)
    assert.equal(Object.values(manifest.status).reduce((a, b) => a + b, 0), total)
  })

  test('the sources are recorded: where from, which version, which bytes', () => {
    const [ids, kd, scope] = manifest.sources
    assert.equal(scope.name, 'scope-1')
    assert.equal(scope.sha256, sha(readFileSync(join(root, 'src/v2/structure/scope-1.json'))))
    assert.equal(ids.name, 'BabelStone IDS')
    assert.equal(ids.version['File Date'], '2025-06-27')
    assert.equal(ids.sha256, 'cc2a0a97e6a51ed6ebe59870ef2af66e83f3c3c27387d79b4441bb2d791d78b1')
    assert.equal(kd.name, 'KANJIDIC2')
    assert.equal(kd.sha256, 'aef74d1c86bad7ef03441e6c0ded48f0b0da3e2637e00bcc80f6e10488811c99')
    assert.equal(manifest.generator.tool, 'tools/v2/structure.mjs')
  })

  test('serialisation is canonical: every shard written back from its own content is the same bytes', () => {
    shards.forEach((s, i) => assert.equal(shardText(new Map(Object.entries(s.entries))), shardFiles[i].toString('utf8'), manifest.shards.files[i].name))
  })

  const sources = process.env.V2_STRUCTURE_SOURCES
  test('the same sources and the same tool give the same table, byte for byte', { skip: sources ? false : 'set V2_STRUCTURE_SOURCES to the folder holding IDS.TXT and kanjidic2.xml.gz' }, async () => {
    const { generate } = await import('../tools/v2/structure.mjs')
    const { files } = generate(join(sources!, 'IDS.TXT'), join(sources!, 'kanjidic2.xml.gz'))
    assert.deepEqual([...files.keys()].sort(), [...manifest.shards.files.map((f) => f.name), 'manifest.json', 'NOTICE.txt'].sort())
    for (const [name, text] of files) assert.equal(text, readFileSync(join(dir, name), 'utf8'), name)
  })
})

describe('scope-1: the characters structure-1 holds, frozen', () => {
  const text = readFileSync(join(root, 'src/v2/structure/scope-1.json'), 'utf8')
  const scope = JSON.parse(text) as { meta: { id: string; version: string; sha256: string; counts: Record<string, number> }; chars: [string, string[]][] }
  const origins = ['grade', 'study', 'exploration', 'fixture']

  test('its characters are the ones its sha256 names, one code point each, in code point order', () => {
    assert.equal(scope.meta.id, 'scope-1')
    assert.equal(scope.meta.version, '1')
    assert.equal(sha(scope.chars.map((x) => JSON.stringify(x)).join(',\n')), scope.meta.sha256)
    for (let i = 0; i < scope.chars.length; i++) {
      const [c, from] = scope.chars[i]
      assert.equal([...c].length, 1, 'a character, never a word')
      if (i) assert.ok(scope.chars[i - 1][0].codePointAt(0)! < c.codePointAt(0)!, c)
      assert.ok(from.length > 0 && from.every((o) => origins.includes(o)), c)
      assert.deepEqual(from, origins.filter((o) => from.includes(o)), `${c}: origins in a fixed order`)
    }
    assert.equal(scope.chars.length, scope.meta.counts.total)
    for (const o of origins) assert.equal(scope.chars.filter(([, f]) => f.includes(o)).length, scope.meta.counts[o], o)
  })

  test('every character of the scope is in the table, or listed as absent (the source has nothing for it) and not found', () => {
    const absent = new Set(manifest.absent)
    for (const [c] of scope.chars) {
      const r = look(c)
      if (absent.has(c)) assert.equal(r.status, 'not-found', c)
      else assert.notEqual(r.status, 'not-found', c)
    }
    assert.equal(manifest.entries + manifest.absent.length, scope.chars.length)
  })

  test('the corpora no longer fall out: 嘘 and the exploration characters beyond grade 1–10 are in the table', () => {
    const u = look('嘘')
    assert.equal(u.status, 'found')
    assert.equal(u.status === 'found' && u.structure.ids, '⿰口虚')
    const onlyCorpus = scope.chars.filter(([, f]) => !f.includes('grade'))
    assert.equal(onlyCorpus.length, scope.meta.counts.onlyCorpus)
    for (const [c] of onlyCorpus) assert.notEqual(look(c).status, 'not-found', c)
  })

  test('the benchmark titles are in the scope (membership only)', () => {
    for (const c of CASES as readonly BenchmarkCase[]) {
      assert.ok(scope.chars.some(([x, f]) => x === c.title && f.includes('fixture')), c.title)
    }
  })
})

describe('structure-1: what the benchmark needs (spec-1 §16 stage 2)', () => {
  test('雨: 丶×4, a 2×2 of ⿰ and ⿱, under the roof 冂', () => {
    const r = found('雨')
    const reps = repeatedSubtrees(r.structure.tree, look)
    const dots = reps.find((x) => x.repetition.unit === '丶')!
    assert.equal(dots.repetition.n, 4)
    assert.equal(dots.repetition.tier, 'stroke')
    assert.deepEqual(new Set(dots.repetition.ops), new Set(['⿰', '⿱']))
    assert.match(idsOf(r.structure.tree), /⿵冂⿰⿱丶丶⿱丶丶/)
  })

  test('闇 ⿵門音, 淋 ⿰氵林, 林 ⿰木木, 血 ⿱㇒皿, 囚 ⿴囗人, 辻 ⿺辶十, 悲 ⿱非心', () => {
    for (const [c, ids] of [['闇', '⿵門音'], ['淋', '⿰氵林'], ['林', '⿰木木'], ['血', '⿱㇒皿'], ['囚', '⿴囗人'], ['辻', '⿺辶十'], ['悲', '⿱非心']]) {
      const r = found(c)
      assert.equal(r.structure.ids, ids, c)
      assert.equal(idsOf(r.structure.tree), ids, `${c}: nothing to open`)
      assert.equal(r.structure.source, 'babelstone-j', c)
    }
    const tiers = (c: string) => {
      const t = found(c).structure.tree
      return t.kind === 'op' ? t.children.map((x) => (x.kind === 'leaf' ? x.tier : 'op')) : []
    }
    assert.deepEqual(tiers('淋'), ['variant', 'character'])
    assert.deepEqual(tiers('血'), ['stroke', 'character'])
    assert.deepEqual(tiers('辻'), ['variant', 'character'])
    assert.deepEqual(tiers('囚'), ['character', 'character'])
  })

  test('州: the Japanese form is kept as it is (川 and an unencoded part); another region names the part, beside it', () => {
    const r = found('州')
    assert.equal(r.structure.ids, '⿻川{86}')
    assert.equal(r.entry.selected.japanese, 'plain')
    const t = r.structure.tree
    assert.ok(t.kind === 'op' && t.op === '⿻')
    assert.deepEqual(t.children.map((x) => (x.kind === 'leaf' ? [x.char, x.tier] : null)), [['川', 'character'], ['{86}', 'unknown']])
    assert.equal(r.entry.supplements.length, 1)
    assert.deepEqual({ ...r.entry.supplements[0], provenance: undefined }, { path: '1', unknown: '{86}', named: '⿲丶丶丶', from: 'HT', provenance: undefined })
    assert.equal(r.structure.named, '⿻川⿲丶丶丶')
  })

  test('十: two strokes crossing', () => {
    const t = found('十').structure.tree
    assert.deepEqual(t, { kind: 'op', op: '⿻', children: [{ kind: 'leaf', char: '一', tier: 'stroke' }, { kind: 'leaf', char: '丨', tier: 'stroke' }] })
  })

  test('品 = 口×3 and 晶 = 日×3 once their components are opened; 森 = 木×3 seen through 林', () => {
    for (const [c, unit, via] of [['品', '口', []], ['晶', '日', []], ['森', '木', ['林']], ['林', '木', []]] as const) {
      const h = homogeneous(found(c).structure.tree, look)
      assert.ok(h, c)
      assert.equal(h.unit, unit, c)
      assert.equal(h.tier, 'character', c)
      assert.equal(h.n, c === '林' ? 2 : 3, c)
      assert.deepEqual([...h.through], [...via], c)
    }
    assert.equal(idsOf(found('森').structure.tree), '⿱木林', '林 is kept whole in the tree; only the view sees through it')
    assert.deepEqual(found('品').entry.normalization.map((s) => [s.kind, s.char]), [['open-component', '吅']])
  })

  test('a repetition of strokes is never a repetition of characters: 心 丶×2, 皿 丨×2', () => {
    for (const [c, unit] of [['心', '丶'], ['皿', '丨']] as const) {
      const reps = repeatedSubtrees(found(c).structure.tree, look)
      assert.equal(reps.length, 1, c)
      assert.equal(reps[0].repetition.unit, unit)
      assert.equal(reps[0].repetition.n, 2)
      assert.equal(reps[0].repetition.tier, 'stroke')
      assert.equal(homogeneous(found(c).structure.tree, look), null, `${c} as a whole is not a repetition`)
    }
  })

  test('the Stage 1 expectations find their terms in the table (read as expected values only)', () => {
    for (const c of CASES as readonly BenchmarkCase[]) {
      const r = found(c.title)
      const chars = new Set<string>()
      const walk = (n: IdsNode) => (n.kind === 'leaf' ? chars.add(n.char) : n.children.forEach(walk))
      walk(r.structure.tree)
      if (r.structure.named) for (const ch of r.structure.named) chars.add(ch)
      const p = c.expect.primary.value
      if (!p) continue
      const need =
        p.type === 'addition' ? [p.base, ...p.delta] :
        p.type === 'enclosure' ? [p.container, p.contained] :
        p.type === 'partial_enclosure' ? [p.wrapper, p.core] :
        p.type === 'composition' ? [...p.parts] :
        p.type === 'internal_repetition' ? [] : []
      for (const t of need) assert.ok(chars.has(t), `${c.title}: ${t} in ${idsOf(r.structure.tree)}`)
      if (p.type === 'internal_repetition') {
        const reps = repeatedSubtrees(r.structure.tree, look).map((x) => x.repetition)
        assert.ok(reps.some((x) => x.unit === p.unit && x.n === p.n && x.tier === p.unitTier), `${c.title}: ${p.unit}×${p.n}`)
      }
    }
  })
})

describe('structure-1: forms, selection and normalisation are rules, not habits', () => {
  test('囗 stays 囗 (U+56D7); its correspondence to 口 is recorded, never merged', () => {
    const t = found('囚').structure.tree
    assert.ok(t.kind === 'op' && t.children[0].kind === 'leaf' && t.children[0].char === '囗')
    assert.deepEqual(manifest.forms.find((f) => f.form === '囗'), { form: '囗', kind: 'written-as', chars: ['口'] })
    for (const [form, char] of [['氵', '水'], ['亻', '人'], ['忄', '心'], ['辶', '辵']]) {
      assert.deepEqual(manifest.forms.find((f) => f.form === form)?.chars, [char], form)
    }
  })

  test('selection does not depend on the order the candidates come in', () => {
    const cands: RegionalIds[] = [
      { ids: '⿱⿵𠆢丶乛', regions: 'G[P][U][B]', parse: 'ok' },
      { ids: '⿱{88}乛', regions: 'HTJKPV[S]', parse: 'ok' },
      { ids: '⿱人乛', regions: '[J]', parse: 'ok' },
    ]
    const orders = [[0, 1, 2], [2, 1, 0], [1, 2, 0], [2, 0, 1]]
    const selfs = orders.map((o) => select(o.map((i) => cands[i]), 'self')!.chosen.ids)
    const comps = orders.map((o) => select(o.map((i) => cands[i]), 'component')!.chosen.ids)
    assert.deepEqual(new Set(selfs), new Set(['⿱{88}乛']), 'its own structure: the plain J')
    assert.deepEqual(new Set(comps), new Set(['⿱人乛']), 'as a component: the [J] form')
    assert.ok(canonicalOrder(cands[0], cands[1]) !== 0)
  })

  test('normalisation opens components only, stops at cycles and at depth, and is the same every time', () => {
    const leaf = (char: string, tier: IdsNode extends infer _ ? 'component' | 'character' | 'stroke' : never): IdsNode => ({ kind: 'leaf', char, tier })
    // A opens into ⿰ B 木, B opens into ⿱ A 丶: A inside B is a cycle
    const opener = (c: string) =>
      c === 'A' ? { ids: '⿰B木', tree: { kind: 'op', op: '⿰', children: [leaf('B', 'component'), leaf('木', 'character')] } as IdsNode } :
      c === 'B' ? { ids: '⿱A丶', tree: { kind: 'op', op: '⿱', children: [leaf('A', 'component'), leaf('丶', 'stroke')] } as IdsNode } : null
    const tree: IdsNode = { kind: 'op', op: '⿰', children: [leaf('A', 'component'), leaf('林', 'character')] }
    const a = normalize(tree, 'X', opener)
    const b = normalize(tree, 'X', opener)
    assert.deepEqual(a, b)
    assert.deepEqual(a.steps.map((s) => s.kind), ['open-component', 'open-component', 'cycle-stop'])
    assert.equal(idsOf(a.tree), '⿰⿰⿱A丶木林', 'the character 林 is kept whole; A is kept where it would open into itself')
    // a chain deeper than the limit stops
    let n = 0
    const deep = (c: string) => (c.startsWith('D') ? { ids: '', tree: { kind: 'op', op: '⿰', children: [leaf(`D${++n}`, 'component'), leaf('丶', 'stroke')] } as IdsNode } : null)
    const d = normalize({ kind: 'op', op: '⿰', children: [leaf('D0', 'component'), leaf('丶', 'stroke')] }, 'Y', deep)
    assert.ok(d.steps.some((s) => s.kind === 'depth-stop'))
  })

  test('no entry of the table holds a structure the source does not give: atomic, unparsed and missing characters say so', () => {
    const counts: Record<string, number> = {}
    for (const s of shards) for (const e of Object.values(s.entries)) {
      counts[e.status] = (counts[e.status] ?? 0) + 1
      if (e.status === 'unsupported-operator' || e.status === 'malformed') assert.equal(e.structure, null, e.char)
      if (e.status === 'decomposed') assert.ok(e.structure && e.structure.tree.kind === 'op', e.char)
    }
    assert.deepEqual(counts, manifest.status)
  })
})

describe('structure-1: the runtime lookup', () => {
  test('found, unparsed and not-found are three explicit results', () => {
    assert.equal(look('闇').status, 'found')
    const un = look('以')
    assert.equal(un.status, 'unparsed')
    assert.equal(un.status === 'unparsed' && un.reason, 'unsupported-operator')
    assert.equal(look('丑').status, 'unparsed')
    for (const c of ['𠀀', 'A', 'あ', '', '闇闇', '海']) assert.deepEqual(look(c), { status: 'not-found', char: c }, JSON.stringify(c))
    assert.ok(manifest.absent.includes('海'), 'a compatibility ideograph of the scope is absent from the source, and listed')
  })

  test('lookup is pure: the same answer every time, and the table is not touched', () => {
    const before = sha(JSON.stringify(shards))
    const a = JSON.stringify(['雨', '州', '以', '𠀀'].map(look))
    const b = JSON.stringify(['𠀀', '以', '州', '雨'].map(look).reverse())
    assert.equal(a, b)
    assert.equal(sha(JSON.stringify(shards)), before)
  })

  test('a table missing a shard is refused', () => {
    assert.throws(() => structureIndex(manifest, shards.slice(1)))
  })
})

describe('structure-1 stays with v2', () => {
  const files = (d: string): string[] =>
    readdirSync(d).flatMap((f) => {
      const p = join(d, f)
      return statSync(p).isDirectory() ? files(p) : /\.(ts|mjs|js|html)$/.test(p) ? [p] : []
    })

  test('nothing outside src/v2 and tools/v2 refers to it', () => {
    for (const f of [...files(join(root, 'src')), ...files(join(root, 'server')), join(root, 'index.html')].filter(existsSync)) {
      const rel = relative(root, f).replace(/\\/g, '/')
      if (rel.startsWith('src/v2/')) continue
      assert.ok(!/structure-1/.test(readFileSync(f, 'utf8')), `${rel} refers to structure-1`)
    }
  })

  test('the runtime reads the table, never the source: lookup and view import no build code', () => {
    for (const f of ['src/v2/structure/lookup.ts', 'src/v2/structure/view.ts']) {
      assert.ok(!/from ['"][^'"]*\/build\//.test(readFileSync(join(root, f), 'utf8')), f)
    }
  })
})
