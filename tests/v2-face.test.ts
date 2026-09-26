// v2 after Stage 11: the writing face (layout/face.ts, docs/v2-decisions.md). The words to be read in the serif,
// everything the geometry stands on in the reading face; the face moves nothing.
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { composeV2 } from '../src/v2/compose'
import { CONSTANTS } from '../src/v2/spec'
import { SMALLEST_WRITING } from '../src/poem/face'
import { observeNode } from './v2-node'

const BENCHMARK = [...'雨闇淋林州血囚辻悲']
const WORDS = ['ころころ', '雨の中の雨', '春はあけぼの', 'Good morning!', '2026', 'A to Z', '美しい', '子供の城', '私の影を踏まないでください！', '大と太']
const pages = new Map(await Promise.all([...BENCHMARK, ...WORDS].map(async (t) => {
  const o = await observeNode(t)
  return [t, { o, c: composeV2(o) }] as const
})))
const page = (t: string) => pages.get(t)!

describe('the writing face', () => {
  test('SMALLEST_WRITING is v1\'s', () => {
    assert.equal(CONSTANTS.SMALLEST_WRITING.value, SMALLEST_WRITING)
  })

  test('a serif mark is a word: the title\'s own character, uncut, not derived, not a figure, at least SMALLEST_WRITING', () => {
    for (const [t, { c }] of pages)
      for (const m of c.draft.marks.filter((m) => m.face === 'serif')) {
        assert.ok(m.grapheme !== undefined && !m.derived, `${t} ${m.char}`)
        assert.ok(!m.keep && !m.shift && !m.minus, `${t} ${m.char}`)
        assert.notEqual(m.role, 'nucleus', `${t} ${m.char}`)
        assert.ok(m.size >= CONSTANTS.SMALLEST_WRITING.value, `${t} ${m.char}`)
      }
  })

  test('the benchmark pages are all in the reading face (their marks are the figure and its field)', () => {
    for (const t of BENCHMARK) assert.ok(page(t).c.draft.marks.every((m) => m.face === 'sans'), t)
  })

  test('a Sequence is written in the serif; a field\'s units stay in the reading face', () => {
    assert.ok(page('ころころ').c.draft.marks.every((m) => m.face === 'serif'))
    for (const t of ['春はあけぼの', 'Good morning!', '2026']) {
      const { marks } = page(t).c.draft
      assert.ok(marks.some((m) => m.face === 'serif'), t)
      assert.ok(marks.filter((m) => m.derived).every((m) => m.face === 'sans'), t)
    }
  })

  test('the Rationale counts every mark once, by layer, face and cause', () => {
    for (const [t, { c }] of pages) {
      const f = c.rationale.layout.faces
      assert.equal(f.reduce((n, r) => n + r.marks, 0), c.draft.marks.length, t)
      assert.equal(f.filter((r) => r.face === 'serif').reduce((n, r) => n + r.marks, 0), c.draft.marks.filter((m) => m.face === 'serif').length, t)
      for (const r of f) assert.equal(r.face === 'serif', r.layer === 'words' && r.because === 'words', `${t} ${JSON.stringify(r)}`)
    }
  })

  test('a word the writing face has no glyph for stays in the reading face, and says so', () => {
    const { o } = page('ころころ')
    const c = composeV2({ ...o, writingLacks: ['ろ'] })
    assert.ok(c.draft.marks.filter((m) => m.char === 'ろ').every((m) => m.face === 'sans'))
    assert.ok(c.draft.marks.filter((m) => m.char === 'こ').every((m) => m.face === 'serif'))
    assert.ok(c.rationale.layout.faces.some((r) => r.because === 'no-writing-glyph' && r.marks === 2))
  })

  test('the face moves nothing: the same page with every face the reading face', () => {
    for (const [t, { o, c }] of pages) {
      const all = composeV2({ ...o, writingLacks: [...new Set(o.language.graphemes.map((g) => g.char))] })
      assert.ok(all.draft.marks.every((m) => m.face === 'sans'), t)
      assert.deepEqual(c.draft.marks.map((m) => ({ ...m, face: 'sans' })), all.draft.marks, t)
    }
  })
})
