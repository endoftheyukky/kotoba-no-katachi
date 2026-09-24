// The reading: bounded in length wherever it comes from, and aligned with the writing in
// time that grows with its length — with exactly the choices the lazy expression made before.
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { SMALL, toHiragana } from '../src/language/kana'
import { alignReading, analyzeLanguage, kanjiRuns, type Run } from '../src/language/analysis'
import { scriptOf } from '../src/language/script'
import type { Grapheme } from '../src/language/types'
import { EDGE_TITLES, DIFFICULT_WORDS } from '../src/study/difficult'
import { HOLDOUT_TITLES } from '../src/study/holdout'
import { PROBE_TITLES } from '../src/study/probes'
import { STUDY_TITLES } from '../src/study/titles'
import { MAX_READING, normalizeTitle } from '../src/title'

const graphemesOf = (text: string): Grapheme[] =>
  Array.from(text).map((char, index) => ({ index, char, script: scriptOf(char), small: SMALL.has(char) }))

/** alignReading as it was written until this version: the reference for the choices it makes */
function reference(graphemes: readonly Grapheme[], runs: readonly Run[], reading: string): Map<number, string> | null {
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  let pattern = '^'
  const groups: number[] = []
  for (let i = 0; i < graphemes.length; ) {
    const run = runs.find((r) => r.start === i)
    if (run) {
      pattern += '(.+?)'
      groups.push(run.start)
      i = run.end
      continue
    }
    const g = graphemes[i]
    if (g.script === 'hiragana' || g.script === 'katakana') pattern += escape(toHiragana(g.char))
    else if (g.char === 'ー') pattern += '(?:ー|[あいうえお])'
    i++
  }
  const m = new RegExp(pattern + '$').exec(reading.replace(/[^ぁ-ゟー]/g, ''))
  if (!m) return null
  return new Map(groups.map((start, k) => [start, m[k + 1]]))
}

const both = (text: string, reading: string) => {
  const g = graphemesOf(text)
  const runs = kanjiRuns(g)
  return { now: alignReading(g, runs, reading), before: reference(g, runs, reading) }
}
const plain = (m: Map<number, string> | null) => (m ? [...m] : null)

describe('reading', () => {
  test('is at most MAX_READING characters, counted as written in hiragana', () => {
    assert.equal(MAX_READING, 64)
    const ok = normalizeTitle({ text: '森', reading: 'も'.repeat(64) })
    assert.equal(typeof ok, 'object')
    assert.equal(normalizeTitle({ text: '森', reading: 'も'.repeat(65) }), 'reading-too-long')
    assert.equal(normalizeTitle({ text: '森', reading: 'モ'.repeat(65) }), 'reading-too-long')
    // spaces are not part of it
    assert.equal(typeof normalizeTitle({ text: '森', reading: 'も '.repeat(64) }), 'object')
    // a very long one is refused before it is read
    assert.equal(normalizeTitle({ text: '森', reading: ' '.repeat(100_000) + 'も' }), 'reading-too-long')
  })

  test('the address, the line (題（よみ）) and the archive all pass through the same rule', () => {
    // src/main.ts read() and server/generations.ts check() both call normalizeTitle; the archive
    // also refuses more than 64 (server/generations.ts), so nothing the page accepts is refused there for length
    const input = normalizeTitle({ text: '子供の城', reading: 'こどものしろ' })
    assert.deepEqual(input, { text: '子供の城', reading: 'こどものしろ', variant: 0 })
  })

  test('every reading in the public title sets is aligned exactly as before', () => {
    const sets = [STUDY_TITLES, HOLDOUT_TITLES, PROBE_TITLES, DIFFICULT_WORDS, EDGE_TITLES].flat().filter((t) => t.reading)
    assert.ok(sets.length > 5)
    for (const t of sets) {
      const input = normalizeTitle({ text: t.text, reading: t.reading })
      assert.equal(typeof input, 'object', t.text)
      if (typeof input === 'string') continue
      const { now, before } = both(input.text, input.reading!)
      assert.deepEqual(plain(now), plain(before), `${t.text}（${t.reading}）`)
    }
  })

  test('random titles and readings: the same choices as the lazy expression', () => {
    // a small alphabet, so that runs, anchors and long vowels meet often
    const writing = ['一', '森', '子', '城', 'あ', 'い', 'の', 'か', 'ア', 'カ', 'ー', ' ', '・', 'ッ', 'っ']
    const sounds = ['あ', 'い', 'う', 'え', 'お', 'か', 'の', 'こ', 'し', 'っ', 'ー', 'ア', 'カ', 'x', ' ']
    let seed = 12345
    const rand = (n: number) => ((seed = (seed * 1103515245 + 12345) >>> 0) % n)
    let aligned = 0
    for (let i = 0; i < 20_000; i++) {
      const text = Array.from({ length: 1 + rand(7) }, () => writing[rand(writing.length)]).join('')
      const reading = Array.from({ length: rand(12) }, () => sounds[rand(sounds.length)]).join('')
      const { now, before } = both(text, reading)
      if (before) aligned++
      assert.deepEqual(plain(now), plain(before), `${text} / ${reading}`)
    }
    assert.ok(aligned > 1_000, `enough of the cases align (${aligned})`)
  })

  test('a reading that cannot align is refused in time that grows with its length', () => {
    // eight runs with nothing between them, and an ending the reading does not have:
    // the lazy expression tried about C(n, 8) ways (4.4e9 at 64 characters)
    const text = '一 一 一 一 一 一 一 一あ'
    for (const n of [64, 1_000, 10_000]) {
      const start = performance.now()
      const now = alignReading(graphemesOf(text), kanjiRuns(graphemesOf(text)), 'い'.repeat(n))
      const ms = performance.now() - start
      assert.equal(now, null)
      assert.ok(ms < (n <= 64 ? 50 : 1_000), `${n} characters: ${ms.toFixed(1)} ms`)
    }
    // and the whole analysis of the longest reading the page accepts
    const input = normalizeTitle({ text, reading: 'い'.repeat(MAX_READING) })
    assert.equal(typeof input, 'object')
    const start = performance.now()
    const a = analyzeLanguage(input as Exclude<typeof input, string>)
    assert.equal(a.readingAligned, false)
    assert.ok(performance.now() - start < 200)
  })
})
