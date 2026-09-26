// v2 Stage 11 (release candidate): any input, the provenance of every table, and the pages pinned.
//
//   - any text a person may type composes, without failing or hanging, the same twice; what is not there
//     (a structure, an ink entry, a resonance row) is recorded apart and never filled in
//   - the Rationale names every table by id and sha256 (§11.3), axes-1 included
//   - spec-1 §16 stage 11: the pages v2 writes are pinned (tests/fixtures/v2-expected.json, the sha256 of each
//     page's marks as node composes it, without the relations between the title's own glyphs, which need the
//     face measured in a browser). A change of any page fails here until the file is written again on purpose:
//       V2_WRITE_EXPECTED=1 npm test
//     Nothing in src/ reads the file; it is an expected value, never an input.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { DIFFICULT_WORDS, EDGE_TITLES } from '../src/study/difficult'
import { HOLDOUT_TITLES } from '../src/study/holdout'
import { PROBE_TITLES } from '../src/study/probes'
import { STUDY_TITLES } from '../src/study/titles'
import type { GlyphRelation } from '../src/glyph/relation'
import { composeV2 } from '../src/v2/compose'
import { AXES_1_SHA256 } from '../src/v2/observation'
import { composeNode, observeNode, root } from './v2-node'

const sha = (s: string | Buffer) => createHash('sha256').update(s).digest('hex')

/** every kind of text a person may type (the site refuses a character its face lacks before composing; v2 must not fail on it either) */
const ANY: readonly (readonly [string, string?])[] = [
  ['図書館'], ['ありがとう'], ['ヴァイオリン'], ['hello'], ['WORLD'], ['12345'], ['3.14'], ['「」'], ['！？'], ['……'],
  ['Tシャツ'], ['3月の雨'], ['iPhoneの画面'], ['A4用紙'], ['空 と 海'], ['a b c'], ['生', 'なま'], ['雨', 'かぜ'],
  ['ぬるぴか'], ['森雨林'], ['薔薇'], ['龘'], ['々'], ['𠮟る'], ['🌧'], ['雨🌧'], ['한글'], ['𪚥'], ['葛\u{E0100}'],
  ['辻\u{E0100}城'], ['か゚'], ['👨‍👩‍👧'], ['‍'], ['一'], ['A'], ['1'], ['。'], ['ー'], ['っ'], ['ｱｲｳ'], ['①②'],
  ['あいうえおかきくけこさしすせそた'], ['東西南北春夏秋冬朝昼夕夜天地人心'], ['雨雨雨雨雨雨雨雨雨雨雨雨雨雨雨雨'],
  ['寿限無', 'じゅげむじゅげむごこうのすりきれかいじゃりすいぎょのすいぎょうまつうんらいまつふうらいまつくうねるところにすむところ'],
]

describe('any input (Stage 11)', () => {
  test('composes without failing or hanging, and the same twice', { timeout: 120_000 }, async () => {
    for (const [text, reading] of ANY) {
      const t0 = performance.now()
      const a = await composeNode(text, reading)
      const b = await composeNode(text, reading)
      assert.ok(performance.now() - t0 < 10_000, `${text}: slow`)
      assert.equal(JSON.stringify(a.draft.marks), JSON.stringify(b.draft.marks), text)
      assert.ok(a.draft.marks.length > 0, `${text}: no marks`)
      assert.ok(a.draft.marks.every((m) => Number.isFinite(m.x) && Number.isFinite(m.y) && Number.isFinite(m.size) && m.size > 0), `${text}: a mark off the page`)
      assert.deepEqual(a.trace.geometry.unmotivated, [], text)
    }
  })

  test('a title too long, empty or with too long a reading is refused before anything is read', async () => {
    await assert.rejects(composeNode('あいうえおかきくけこさしすせそたち'), /too-long/)
    await assert.rejects(composeNode('   '), /empty/)
    await assert.rejects(composeNode('雨', 'あ'.repeat(65)), /reading-too-long/)
  })

  test('what is not there is recorded apart, never filled in: no structure, no ink, no resonance row', async () => {
    const miss = async (text: string) => Object.fromEntries((await composeNode(text)).rationale.observation.missing.map((m) => [m.char, m.missing]))
    assert.deepEqual(await miss('龘'), { 龘: ['structure', 'ink', 'resonance'] })
    assert.deepEqual(await miss('雨'), {})
    const latin = await composeNode('WORLD')
    assert.equal(latin.rationale.selection.primary, null)
    assert.match(latin.rationale.selection.reason, /structure-1 has no structure for W O R L D/)
    // a structure with nothing of a known type found in it says only that
    assert.doesNotMatch((await composeNode('一')).rationale.selection.reason, /has no structure/)
    // the glyph a face lacks is known only where the face is measured (in the browser): not claimed here
    assert.ok((await composeNode('🌧')).rationale.observation.missing[0].missing.every((m) => m !== 'glyph'))
  })
})

describe('a relation between the title\'s characters keeps the words whole (Stage 11)', () => {
  const box = { x: 0, y: 0, w: 10, h: 10 }
  const rel = (inner: string, outer: string): GlyphRelation => ({ kind: 'containment', origin: 'title', inner, outer, score: 0.8, containment: 0.8, overlap: 0.9, dx: 0, dy: 0, scale: 1, residue: { share: 0.2, pieces: [box], box, centroid: { x: 0, y: -20 }, substance: 1 } })
  const withRelation = async (text: string, r: GlyphRelation) => composeV2({ ...(await observeNode(text)), titleRelations: [r] })

  test('a character of the relation inside a longer word is written by its word; the figure writes its form only', async () => {
    const c = await withRelation('春はあけぼの', rel('け', 'は'))
    assert.equal(c.rationale.selection.primary, 'inter_containment:1:け⊂は')
    const marks = c.draft.marks
    for (let g = 0; g < 6; g++) assert.equal(marks.filter((m) => m.grapheme === g).length, 1, `grapheme ${g} written once`)
    // あけぼの, one word: its four characters in one run of the line
    const flows = c.trace.geometry.detail!.flows!.map((f) => f.points.map((p) => p.grapheme))
    assert.ok(flows.some((f) => [2, 3, 4, 5].every((g) => f.includes(g))), JSON.stringify(flows))
    // は, a word by itself, is the figure's own
    assert.ok(marks.some((m) => m.grapheme === 1 && m.role === 'nucleus'))
    assert.ok(marks.filter((m) => m.char === 'け').every((m) => m.grapheme === 3 ? m.role === 'body' && !m.derived : !!m.derived))
  })

  test('the title is written in its words: a space stays in the line, a word in letters is not split (Good morning!)', async () => {
    const c = await withRelation('Good morning!', rel('n', 'o'))
    const flows = c.trace.geometry.detail!.flows!.map((f) => f.points.map((p) => p.grapheme))
    assert.deepEqual(flows, [[0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12]])
    const at = (g: number) => c.draft.marks.find((m) => m.grapheme === g)!
    for (let g = 1; g <= 3; g++) assert.equal(at(g).y, at(0).y)
    for (let g = 6; g <= 12; g++) assert.equal(at(g).y, at(5).y, `morning! on one line (${g})`)
  })

  test('where both are words by themselves, the figure writes both (大と太)', async () => {
    const c = await withRelation('大と太', rel('大', '太'))
    assert.ok(c.draft.marks.some((m) => m.grapheme === 0 && m.char === '大'))
    assert.ok(c.draft.marks.some((m) => m.grapheme === 2 && m.char === '太' && m.role === 'nucleus'))
  })
})

describe('provenance (§11.3)', () => {
  test('axes-1 is named by the sha256 of its shards, as the other tables are', async () => {
    const meta = JSON.parse(readFileSync(join(root, 'public/semantic/axes-1/meta.json'), 'utf8')) as { sha256: Record<string, string> }
    const files = Object.keys(meta.sha256).sort()
    for (const f of files) assert.equal(sha(readFileSync(join(root, 'public/semantic/axes-1', f))), meta.sha256[f], f)
    assert.equal(sha(files.map((f) => meta.sha256[f]).join('')), AXES_1_SHA256)
    const data = (await composeNode('雨')).rationale.data
    for (const id of ['structure-1', 'align-1', 'resonance-1', 'axes-1'] as const) assert.match(data[id].sha256, /^[0-9a-f]{64}$/, id)
  })
})

const PAGES: readonly { text: string; reading?: string }[] = [
  ...[...'雨闇淋林州血囚辻悲海問品森玉晶轟好男国閣日琳田回魁噴虜看'].map((text) => ({ text })),
  ...[...STUDY_TITLES, ...HOLDOUT_TITLES, ...PROBE_TITLES, ...DIFFICULT_WORDS, ...EDGE_TITLES].map((t) => ({ text: t.text, ...(t.reading ? { reading: t.reading } : {}) })),
  ...ANY.map(([text, reading]) => ({ text, ...(reading ? { reading } : {}) })),
]

describe('the pages v2 writes, pinned (spec-1 §16 stage 11)', () => {
  const file = join(root, 'tests/fixtures/v2-expected.json')
  test('every page is the page it was', { timeout: 300_000 }, async () => {
    const got: Record<string, string> = {}
    for (const p of PAGES) {
      const key = p.reading ? `${p.text}|${p.reading}` : p.text
      if (key in got) continue
      got[key] = sha(JSON.stringify((await composeNode(p.text, p.reading)).draft.marks))
    }
    if (process.env.V2_WRITE_EXPECTED) {
      writeFileSync(file, JSON.stringify({ about: 'sha256 of each v2 page\'s marks, composed in node without the relations between the title\'s own glyphs (tests/v2-release.test.ts)', pages: got }, null, 1) + '\n')
      return
    }
    assert.ok(existsSync(file), 'tests/fixtures/v2-expected.json: write it with V2_WRITE_EXPECTED=1')
    const want = (JSON.parse(readFileSync(file, 'utf8')) as { pages: Record<string, string> }).pages
    assert.deepEqual(Object.keys(got).sort(), Object.keys(want).sort())
    const changed = Object.keys(want).filter((k) => got[k] !== want[k])
    assert.deepEqual(changed, [], `pages changed: ${changed.join(', ')}`)
  })
})
