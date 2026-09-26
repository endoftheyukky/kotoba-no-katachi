// v2 Stage 3 (spec-1 §16): align-1, where structure-1's components lie in the reading face, and the
// runtime lookup over it. The Stage 1 fixtures are read here only as expected values; KanjiVG is not
// read at all (tools/v2/align-eval.mjs compares with it, apart from the table and its tests).
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, test } from 'node:test'
import { ALIGN } from '../src/v2/align/constants'
import { alignIndex, placementOf, residueOf, type AlignLookup } from '../src/v2/align/lookup'
import type { AlignEntry, AlignManifest, AlignRow, AlignShard } from '../src/v2/align/table'
import { shardText } from '../src/v2/structure/build/serialize'
import type { StructureManifest, StructureShard } from '../src/v2/structure/table'
import { CASES } from '../src/v2/fixtures/cases'
import type { BenchmarkCase } from '../src/v2/fixtures/types'
import type { IdsNode } from '../src/v2/types/structure'

const root = join(import.meta.dirname, '..')
const dir = join(root, 'public/v2/align-1')
const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as AlignManifest
const shardFiles = manifest.shards.files.map((f) => readFileSync(join(dir, f.name)))
const shards = shardFiles.map((b) => JSON.parse(b.toString('utf8')) as AlignShard)
const index = alignIndex(manifest, shards)
const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex')

const sdir = join(root, 'public/v2/structure-1')
const smanifest = JSON.parse(readFileSync(join(sdir, 'manifest.json'), 'utf8')) as StructureManifest
const structure = new Map(smanifest.shards.files.flatMap((f) => Object.entries((JSON.parse(readFileSync(join(sdir, f.name), 'utf8')) as StructureShard).entries)))

const entry = (c: string): AlignEntry => {
  const e = index.entry(c)
  assert.ok(e, `${c}: no entry`)
  return e
}
const row = (c: string, path: string): AlignRow => {
  const r = entry(c).rows.find((x) => x.path === path)
  assert.ok(r, `${c} ${path}: no row`)
  return r
}
const box = (r: AlignRow) => ({ x0: r.box!.x, y0: r.box!.y, x1: r.box!.x + r.box!.w, y1: r.box!.y + r.box!.h, cx: r.box!.x + r.box!.w / 2, cy: r.box!.y + r.box!.h / 2 })
const half = (c: string) => entry(c).whole!.half

/** every node below the root of a structure, with its path, in pre-order */
function nodes(t: IdsNode): { path: string; node: IdsNode; depth: number }[] {
  const out: { path: string; node: IdsNode; depth: number }[] = []
  const walk = (n: IdsNode, p: string, d: number) => {
    if (n.kind !== 'op') return
    n.children.forEach((c, i) => {
      const q = p === '' ? String(i) : `${p}.${i}`
      out.push({ path: q, node: c, depth: d + 1 })
      walk(c, q, d + 1)
    })
  }
  walk(t, '', 0)
  return out
}

describe('align-1: the table as published', () => {
  test('every shard is the file the manifest names, by size and sha256; the table hash is of the shard hashes', () => {
    assert.equal(manifest.id, 'align-1')
    assert.equal(manifest.shards.files.length, manifest.shards.count)
    manifest.shards.files.forEach((f, i) => {
      assert.equal(shardFiles[i].length, f.bytes, f.name)
      assert.equal(sha(shardFiles[i]), f.sha256, f.name)
      assert.equal(Object.keys(shards[i].entries).length, f.entries, f.name)
    })
    assert.equal(sha(manifest.shards.files.map((f) => f.sha256).join('')), manifest.sha256)
    const all = shards.flatMap((s) => Object.values(s.entries))
    assert.equal(all.length, manifest.entries)
    assert.equal(Object.values(manifest.status).reduce((a, b) => a + b, 0), all.length)
    const rows = all.flatMap((e) => e.rows)
    const counted = [...Object.values(manifest.rows.direct), ...Object.values(manifest.rows.nested)].reduce((a, b) => a + b, 0)
    assert.equal(rows.length, counted)
  })

  test('serialisation is canonical: every shard written back from its own content is the same bytes', () => {
    shards.forEach((s, i) => assert.equal(shardText(new Map(Object.entries(s.entries))), shardFiles[i].toString('utf8'), manifest.shards.files[i].name))
  })

  test('it names what it was made from: structure-1, the face, the browser, v1 measure, the constants', () => {
    assert.equal(manifest.structure.sha256, smanifest.sha256, 'the structure-1 it was fitted to')
    assert.equal(manifest.font.family, 'Noto Sans JP')
    assert.equal(manifest.font.weight, 500)
    const pkg = JSON.parse(readFileSync(join(root, 'node_modules/@fontsource/noto-sans-jp/package.json'), 'utf8')) as { version: string }
    assert.equal(manifest.font.package.version, pkg.version)
    assert.equal(manifest.font.css.sha256, sha(readFileSync(join(root, 'node_modules/@fontsource/noto-sans-jp/500.css'))))
    assert.match(manifest.face, /new table/)
    assert.equal(manifest.render.measure.module, 'src/glyph/metrics.ts')
    assert.equal(manifest.render.measure.sha256, sha(readFileSync(join(root, 'src/glyph/metrics.ts'))), 'v1 measure unchanged since the table was made')
    assert.match(manifest.render.browser.product, /^(Headless)?Chrome\//)
    assert.equal(manifest.render.devicePixelRatio, 1)
    assert.match(manifest.render.rasters.sha256, /^[0-9a-f]{64}$/)
    assert.deepEqual(JSON.parse(JSON.stringify(manifest.constants)), JSON.parse(JSON.stringify(ALIGN)))
    assert.doesNotMatch(JSON.stringify(manifest), /kanjivg/i, 'KanjiVG is not a source')
    assert.doesNotMatch(JSON.stringify(manifest), /[A-Z]:\\\\|\/Users\/|\/home\//, 'no personal paths')
  })

  const regenerate = process.env.V2_ALIGN_REGENERATE
  test('the same inputs give the same table, byte for byte (renders in headless Chrome: several minutes)', { skip: regenerate ? false : 'set V2_ALIGN_REGENERATE=1' }, async () => {
    const { generate } = await import('../tools/v2/align.mjs')
    const { files } = await generate({ reuse: regenerate === 'reuse' })
    assert.deepEqual([...files.keys()].sort(), [...manifest.shards.files.map((f) => f.name), 'manifest.json', 'NOTICE.txt'].sort())
    for (const [name, text] of files) assert.equal(text, readFileSync(join(dir, name), 'utf8'), name)
  })
})

describe('align-1: structure is the truth of existence', () => {
  test('every structure-1 entry has an entry; every node of a fitted structure has exactly one row, in path order', () => {
    assert.equal(manifest.entries, structure.size)
    for (const [c, s] of structure) {
      const e = entry(c)
      if (s.status === 'unsupported-operator' || s.status === 'malformed') assert.equal(e.status, 'no-structure', c)
      else if (s.structure!.tree.kind === 'leaf') assert.equal(e.status, 'atomic', c)
      else {
        assert.ok(e.status === 'fitted' || e.status === 'whole-not-in-face', c)
        assert.deepEqual(e.rows.map((r) => r.path), nodes(s.structure!.tree).map((n) => n.path), c)
      }
    }
  })

  test('a row never says a component is absent: unavailable only for want of a glyph, and still a row', () => {
    const notInFace = new Set(manifest.render.rasters.notInFace)
    for (const [c, s] of structure) {
      if (!s.structure || s.structure.tree.kind === 'leaf') continue
      const e = entry(c)
      const ns = new Map(nodes(s.structure.tree).map((n) => [n.path, n]))
      for (const r of e.rows) {
        const n = ns.get(r.path)!.node
        assert.equal(r.node.kind, n.kind, `${c} ${r.path}`)
        if (e.status === 'whole-not-in-face') {
          assert.deepEqual(r.because, ['whole-not-in-face'], c)
          continue
        }
        if (r.status !== 'unavailable') continue
        const why = r.because[0]
        if (n.kind === 'leaf') {
          if (n.tier === 'unknown') assert.equal(why, 'unencoded', `${c} ${r.path}`)
          else if (notInFace.has(n.char)) assert.equal(why, 'not-in-face', `${c} ${r.path}`)
          else assert.equal(why, 'no-room', `${c} ${r.path}: ${n.char} is in the face`)
        } else assert.equal(why, 'no-part-placed', `${c} ${r.path}`)
      }
    }
  })

  test('a placed component is its own glyph: never another character (氵 as 氵, 囗 as 囗, not 水, not 口)', () => {
    for (const s of shards)
      for (const e of Object.values(s.entries))
        for (const r of e.rows) if (r.glyph) assert.equal(r.glyph.char, r.node.kind === 'leaf' ? r.node.char : null, `${e.char} ${r.path}`)
    assert.equal(row('淋', '0').glyph!.char, '氵')
    assert.equal(row('囚', '0').glyph!.char, '囗')
    assert.equal(row('回', '0').glyph!.char, '囗')
    assert.equal(row('回', '1').glyph!.char, '口')
  })

  test('statuses follow their reasons: aligned has none, approximate and unavailable have some', () => {
    for (const s of shards)
      for (const e of Object.values(s.entries))
        for (const r of e.rows) {
          if (r.status === 'aligned') assert.deepEqual(r.because, [], `${e.char} ${r.path}`)
          else assert.ok(r.because.length > 0, `${e.char} ${r.path}`)
          if (r.status !== 'unavailable') assert.ok(r.box && r.confidence !== undefined, `${e.char} ${r.path}`)
          if (r.transform) {
            const { sx, sy } = r.transform
            for (const v of [sx, sy]) assert.ok(v >= ALIGN.SCALE_MIN.value - 1e-3 && v <= ALIGN.SCALE_MAX.value + 1e-3, `${e.char} ${r.path}: scale ${v}`)
            assert.ok(Math.max(sx / sy, sy / sx) <= ALIGN.ASPECT_MAX.value + 1e-2, `${e.char} ${r.path}: aspect`)
          }
          if (r.residual) assert.equal(r.depth, 1, `${e.char} ${r.path}: residual only on direct rows`)
        }
  })
})

describe('align-1: the benchmark (values as the fixtures expect them; never an input)', () => {
  test('闇 ⿵: 門 spans the character from its top; 音 lies inside it, in its lower part', () => {
    const [mon, on] = [row('闇', '0'), row('闇', '1')]
    const h = half('闇')
    assert.equal(mon.region.name, 'surround-open-below')
    assert.equal(on.region.name, 'inside-below')
    const [m, o] = [box(mon), box(on)]
    assert.ok(m.x1 - m.x0 > 1.8 * h.w && m.y0 < -h.h + 5, JSON.stringify(m))
    assert.ok(o.x0 > m.x0 && o.x1 < m.x1 && o.cy > 0, JSON.stringify(o))
    assert.ok(on.transform!.sx < 0.7 && on.transform!.sy < 0.7, '音 is written small')
    for (const r of [mon, on]) assert.equal(r.status, 'aligned')
  })

  test('淋 ⿰: 氵 on the left, 林 on the right; 淋 − 林 leaves pieces on the left', () => {
    const [sui, rin] = [row('淋', '0'), row('淋', '1')]
    assert.ok(box(sui).x1 <= box(rin).x0 + 2)
    assert.ok(sui.transform!.sy > 0.85, '氵 spans the height (never a dense spot)')
    assert.ok(rin.residual!.pieces.length >= 1 && rin.residual!.pieces.every((p) => p.side === 'left'))
    for (const r of [sui, rin]) assert.equal(r.status, 'aligned')
  })

  test('悲 ⿱: 非 above 心; 心 squeezed (sy well under sx)', () => {
    const [hi, shin] = [row('悲', '0'), row('悲', '1')]
    assert.ok(box(hi).cy < box(shin).cy)
    assert.ok(shin.transform!.sy < 0.6 && shin.transform!.sx > 0.8)
    for (const r of [hi, shin]) assert.equal(r.status, 'aligned')
  })

  test('辻 ⿺: 辶 spans; 十 in the upper right', () => {
    const [shin, ju] = [row('辻', '0'), row('辻', '1')]
    const h = half('辻')
    assert.ok(box(shin).x1 - box(shin).x0 > 1.8 * h.w)
    assert.ok(box(ju).cx > 0 && box(ju).cy < 0)
    for (const r of [shin, ju]) assert.equal(r.status, 'aligned')
  })

  test('囚 ⿴: 囗 surrounds; 人 inside it', () => {
    const [kuni, hito] = [box(row('囚', '0')), box(row('囚', '1'))]
    assert.ok(hito.x0 > kuni.x0 && hito.x1 < kuni.x1 && hito.y0 > kuni.y0 && hito.y1 < kuni.y1)
  })

  test('血 − 皿: one piece, above', () => {
    const r = row('血', '1')
    assert.equal(r.node.kind === 'leaf' && r.node.char, '皿')
    assert.equal(r.residual!.pieces.length, 1)
    assert.equal(r.residual!.pieces[0].side, 'above')
  })

  test('州 − 川: three pieces in a row, between 川\'s strokes; the unencoded {86} is unavailable, its ink found by elimination', () => {
    const r = row('州', '0')
    assert.equal(r.residual!.pieces.length, 3)
    assert.equal(r.residual!.distribution, 'row')
    assert.equal(r.residual!.interleaved, true)
    const u = index.at('州', '1')
    assert.equal(u.status, 'unavailable')
    assert.equal(u.status === 'unavailable' && u.reason, 'unencoded')
    assert.equal(u.status === 'unavailable' && u.row.unexplainedInRegion!.pieces.length, 3)
  })

  test('every addition the fixtures expect: the residual of the base lies on the expected side', () => {
    const sides: Record<string, string[]> = { left: ['left'], right: ['right'], top: ['above'], bottom: ['below'], interleaved: ['within'] }
    let n = 0
    for (const c of CASES as readonly BenchmarkCase[]) {
      const p = c.expect.primary?.value as { type?: string; base?: string; side?: string } | null | undefined
      if (!p || p.type !== 'addition' || !p.side) continue
      const r = entry(c.title).rows.find((x) => x.depth === 1 && x.node.kind === 'leaf' && x.node.char === p.base)
      assert.ok(r?.residual, `${c.title}: the base ${p.base} placed`)
      // the largest piece (the delta itself; a smaller one can be a part of it inside the base's box)
      const big = [...r!.residual!.pieces].sort((a, b) => b.share - a.share)[0]
      assert.ok(big && sides[p.side!].includes(big.side), `${c.title}: ${JSON.stringify(r!.residual!.pieces.map((q) => [q.side, q.share]))} for ${p.side}`)
      n++
    }
    assert.ok(n >= 5, `${n} additions checked`)
  })

  test('a large component never spreads over its small neighbour: 亻 艹 土 氵 span their side (儀 儒 儲 傳 模 坑 萱 蓑 漱)', () => {
    for (const c of ['儀', '儒', '儲', '傳', '模', '坑', '漱']) {
      const [a, b] = [row(c, '0'), row(c, '1')]
      assert.ok(a.transform!.sy > 0.75, `${c}: ${a.transform!.sy}`)
      assert.ok(box(a).cx < box(b).cx && box(a).x1 < box(b).x0 + 12, c)
      assert.ok(a.ink!.shared! < 0.1, `${c}: shared ${a.ink!.shared}`)
    }
    for (const c of ['萱', '蓑']) {
      const [a, b] = [row(c, '0'), row(c, '1')]
      assert.ok(a.transform!.sx > 0.85, `${c}: 艹 spans the width`)
      assert.ok(box(a).y1 < box(b).y0 + 8, c)
    }
  })
})

describe('align-1: the whole glyph\'s own ink (islands, alike groups, crossings)', () => {
  test('every entry whose glyph is in the face has its ink read; alike groups name islands; the source is v1 glyph/parts', () => {
    assert.equal(manifest.render.measure.islands?.module, 'src/glyph/parts.ts')
    assert.equal(manifest.render.measure.islands?.sha256, sha(readFileSync(join(root, 'src/glyph/parts.ts'))), 'v1 islands unchanged since the table was made')
    for (const s of shards)
      for (const e of Object.values(s.entries)) {
        if (e.status === 'whole-not-in-face') {
          assert.equal(e.ink, undefined, e.char)
          continue
        }
        assert.ok(e.ink, e.char)
        for (const g of e.ink.alike) {
          assert.ok(g.members.length >= 2 && g.members.every((i) => i >= 0 && i < e.ink!.islands.length), e.char)
        }
      }
  })

  test('雨: four alike dots; 森 and 品: three alike units; 十 and 辻: a crossing (辻\'s inside 十\'s place)', () => {
    assert.ok(entry('雨').ink!.alike.some((g) => g.members.length === 4))
    assert.ok(entry('森').ink!.alike.some((g) => g.members.length === 3))
    assert.ok(entry('品').ink!.alike.some((g) => g.members.length === 3))
    assert.equal(entry('十').ink!.crossings.length, 1)
    const ju = box(row('辻', '1'))
    assert.ok(entry('辻').ink!.crossings.some((c) => c.x > ju.x0 && c.x < ju.x1 && c.y > ju.y0 && c.y < ju.y1))
  })
})

describe('align-1: the runtime lookup', () => {
  test('aligned, approximate, unavailable and not-found are four explicit results', () => {
    assert.equal(index.at('淋', '1').status, 'aligned')
    const some = shards.flatMap((s) => Object.values(s.entries)).flatMap((e) => e.rows.map((r) => [e.char, r] as const))
    const [ac, ar] = some.find(([, r]) => r.status === 'approximate')!
    const a = index.at(ac, ar.path)
    assert.equal(a.status, 'approximate')
    assert.ok(a.status === 'approximate' && a.because.length > 0)
    const nf = some.find(([, r]) => r.because[0] === 'not-in-face')!
    const u = index.at(nf[0], nf[1].path)
    assert.equal(u.status === 'unavailable' && u.reason, 'not-in-face')
    const w = index.all('乐')
    assert.ok(w.length > 0 && w.every((x) => x.status === 'unavailable' && x.reason === 'whole-not-in-face'))
    const miss = (c: string, p: string, reason: string) => assert.deepEqual(index.at(c, p), { status: 'not-found', char: c, path: p, reason }, `${c} ${p}`)
    miss('𠀀', '0', 'not-in-table')
    miss('あ', '0', 'not-in-table')
    miss('', '0', 'not-in-table')
    miss('闇闇', '0', 'not-in-table')
    miss('淋', '2', 'no-such-path')
    miss('以', '0', 'no-structure')
    const atomic = [...structure].find(([, s]) => s.structure?.tree.kind === 'leaf')![0]
    miss(atomic, '0', 'atomic')
  })

  test('a placement reads as Stage 1\'s InkPlacement, a residual as CharInk.residue', () => {
    const p = placementOf(row('淋', '1'))!
    assert.equal(p.term, '林')
    assert.equal(p.sx, row('淋', '1').transform!.sx)
    assert.equal(placementOf(row('州', '1')), null)
    const r = residueOf(row('淋', '1'))!
    assert.equal(r.pieces.length, row('淋', '1').residual!.pieces.length)
  })

  test('lookup is pure: the same answer every time, and the table is not touched', () => {
    const before = sha(JSON.stringify(shards))
    const q: [string, string][] = [['闇', '0'], ['州', '1'], ['以', '0'], ['𠀀', '0'], ['品', '1.0']]
    const a = JSON.stringify(q.map(([c, p]) => index.at(c, p)))
    const b = JSON.stringify([...q].reverse().map(([c, p]) => index.at(c, p)).reverse())
    assert.equal(a, b)
    assert.equal(sha(JSON.stringify(shards)), before)
  })

  test('a table missing a shard is refused', () => {
    assert.throws(() => alignIndex(manifest, shards.slice(1)))
  })

  test('every answer is one of the four', () => {
    const ok = new Set<AlignLookup['status']>(['aligned', 'approximate', 'unavailable', 'not-found'])
    for (const s of shards) for (const e of Object.values(s.entries)) for (const x of index.all(e.char)) assert.ok(ok.has(x.status))
  })
})

describe('align-1 stays with v2, and apart from its evaluation', () => {
  const files = (d: string): string[] =>
    readdirSync(d).flatMap((f) => {
      const p = join(d, f)
      return statSync(p).isDirectory() ? files(p) : /\.(ts|mjs|js|html)$/.test(p) ? [p] : []
    })

  test('nothing outside src/v2 and tools/v2 refers to it', () => {
    for (const f of [...files(join(root, 'src')), ...files(join(root, 'server')), join(root, 'index.html')].filter(existsSync)) {
      const rel = relative(root, f).replace(/\\/g, '/')
      if (rel.startsWith('src/v2/')) continue
      assert.ok(!/align-1/.test(readFileSync(f, 'utf8')), `${rel} refers to align-1`)
    }
  })

  test('the table is made without KanjiVG and without the fixtures', () => {
    const build = [...files(join(root, 'src/v2/align')), join(root, 'tools/v2/align.mjs'), ...files(join(root, 'tools/v2/align'))]
    for (const f of build) {
      const text = readFileSync(f, 'utf8')
      const rel = relative(root, f).replace(/\\/g, '/')
      assert.ok(!/readKanjiVG|align-eval|kanjivg\.xml|--kanjivg/i.test(text), `${rel} reads KanjiVG`)
      assert.ok(!/from ['"][^'"]*fixtures/.test(text), `${rel} reads the fixtures`)
    }
  })

  test('the runtime reads the table, never builds it: lookup imports no build code and no browser API', () => {
    const text = readFileSync(join(root, 'src/v2/align/lookup.ts'), 'utf8')
    assert.ok(!/from ['"][^'"]*\/build\//.test(text))
    assert.ok(!/document|canvas|fetch\(/.test(text.replace(/\/\*[\s\S]*?\*\//g, '')))
  })
})
