/**
 * Linguistic analysis of a title: graphemes, tokens, readings, morae, and the
 * relations between them that operations can take as their ground.
 * Glyph relations are added separately (glyph/reading.ts): they are readings
 * of a font, not of the language.
 */
import type { TitleInput } from '../title'
import { SMALL, toHiragana } from './kana'
import { parseMorae, type SoundChar } from './morae'
import { readPhonology, type PhonologicalFeature } from './phonology'
import { scriptOf } from './script'
import { ruleSegmenter, type Segmenter } from './segment'
import type { Grapheme, Mora, Token, Vowel } from './types'

export type Relation =
  /** the same unit appears more than once */
  | { kind: 'recurrence'; unit: 'grapheme' | 'mora' | 'vowel'; value: string; members: number[] }
  /** dependent →(marker)→ head, e.g. 子供 →の→ 城 (token indices) */
  | { kind: 'dependency'; dependent: number; head: number; marker: number }
  /** A (marker) B, e.g. 川 または 州 */
  | { kind: 'coordination'; left: number; right: number; marker: number }
  /** a word whose work is the relation itself: particle or conjunction */
  | { kind: 'relationWord'; token: number }
  /** a mora of silence: っ */
  | { kind: 'silence'; mora: number }
  /** a unit repeated in immediate succession: ささ, 許許, ころころ, 人々 (graphemes of each occurrence) */
  | { kind: 'reduplication'; value: string; occurrences: number[][] }
  /** the title reads the same backwards: 雨の中の雨 (the grapheme at the centre, or −1 between two) */
  | { kind: 'mirror'; centre: number }
  /** a negation: 見えない, 不在 */
  | { kind: 'negation'; token: number; graphemes: number[] }
  /** a space written between two words: 白い 犬 */
  | { kind: 'separation'; left: number; right: number }
  /** a command: 走れ, さがせ */
  | { kind: 'imperative'; token: number }
  /** a word written as a kanji stem and a kana ending: 触|る, 美し|い, 走|れ */
  | { kind: 'inflection'; token: number; at: number }

export interface LanguageAnalysis {
  input: TitleInput
  graphemes: Grapheme[]
  tokens: Token[]
  /** grapheme index → token index */
  tokenOf: number[]
  morae: Mora[]
  /** what the sound of the title offers, as far as the writing lets us read it */
  phonology: PhonologicalFeature[]
  /** whether the given reading could be aligned with the writing */
  readingAligned: boolean
  direction: 'vertical' | 'horizontal'
  relations: Relation[]
}

const CONTENT = new Set(['noun', 'verb', 'adjective', 'other'])

export function analyzeLanguage(input: TitleInput, segmenter: Segmenter = ruleSegmenter): LanguageAnalysis {
  const graphemes: Grapheme[] = Array.from(input.text).map((char, index) => ({
    index,
    char,
    script: scriptOf(char),
    small: SMALL.has(char),
  }))
  const tokens = segmenter.segment(graphemes)
  const tokenOf: number[] = []
  for (const t of tokens) for (let i = t.start; i < t.end; i++) tokenOf[i] = t.index

  // readings
  const runs = kanjiRuns(graphemes)
  const aligned = input.reading ? alignReading(graphemes, runs, input.reading) : null
  const sound: SoundChar[] = []
  for (let i = 0; i < graphemes.length; ) {
    const run = runs.find((r) => r.start === i)
    if (run) {
      const reading = aligned?.get(run.start)
      const members = range(run.start, run.end)
      if (reading) for (const ch of Array.from(reading)) sound.push({ char: ch, graphemes: members, token: tokenOf[i] })
      else for (const g of members) sound.push({ char: graphemes[g].char, graphemes: [g], token: tokenOf[g] })
      i = run.end
    } else {
      sound.push({ char: graphemes[i].char, graphemes: [i], token: tokenOf[i] })
      i++
    }
  }
  const morae = parseMorae(sound)
  for (const t of tokens)
    t.reading = morae
      .filter((m) => m.token === t.index && m.kind !== 'unread')
      .map((m) => m.key)
      .join('') || undefined

  // relations
  const relations: Relation[] = []
  const recur = (unit: 'grapheme' | 'mora' | 'vowel', items: [string, number][]): void => {
    const by = new Map<string, number[]>()
    for (const [v, i] of items) by.set(v, [...(by.get(v) ?? []), i])
    for (const [value, members] of by) if (members.length > 1) relations.push({ kind: 'recurrence', unit, value, members })
  }
  recur('grapheme', graphemes.filter((g) => g.script !== 'symbol').map((g) => [toHiragana(g.char), g.index]))
  recur('mora', morae.filter((m) => m.kind !== 'unread').map((m) => [m.key, m.index]))
  recur('vowel', morae.filter((m) => m.vowel).map((m) => [m.vowel as Vowel, m.index]))

  tokens.forEach((t, i) => {
    if (t.pos !== 'particle' && t.pos !== 'conjunction') return
    relations.push({ kind: 'relationWord', token: i })
    const left = tokens[i - 1]
    const right = tokens[i + 1]
    if (!left || !right || !CONTENT.has(left.pos) || !CONTENT.has(right.pos)) return
    if (t.pos === 'conjunction' || ['と', 'や', 'か'].includes(t.surface))
      relations.push({ kind: 'coordination', left: left.index, right: right.index, marker: i })
    else relations.push({ kind: 'dependency', dependent: left.index, head: right.index, marker: i })
  })
  morae.forEach((m) => m.kind === 'Q' && relations.push({ kind: 'silence', mora: m.index }))
  relations.push(...reduplications(graphemes), ...mirror(graphemes))
  tokens.forEach((t, i) => {
    if (t.form === 'imperative') relations.push({ kind: 'imperative', token: i })
    if (t.stem !== undefined && t.stem > t.start) relations.push({ kind: 'inflection', token: i, at: t.stem })
    const kana = toHiragana(t.surface)
    const ending = NEGATION_ENDINGS.find((e) => kana.endsWith(e))
    if (ending) relations.push({ kind: 'negation', token: i, graphemes: range(t.end - ending.length, t.end) })
    else if (t.pos === 'noun' && NEGATION_PREFIXES.has(t.surface[0]) && t.end - t.start > 1)
      relations.push({ kind: 'negation', token: i, graphemes: [t.start] })
    if (t.pos === 'symbol' && !t.surface.trim() && tokens[i - 1] && tokens[i + 1])
      relations.push({ kind: 'separation', left: i - 1, right: i + 1 })
  })

  // Writing direction: a title mostly in katakana — the script of borrowed
  // words — is written horizontally; everything else vertically.
  const by = (s: Grapheme['script']) => graphemes.filter((g) => g.script === s).length
  const direction = by('katakana') > by('hiragana') + by('kanji') ? 'horizontal' : 'vertical'

  return { input, graphemes, tokens, tokenOf, morae, phonology: readPhonology(graphemes, morae), readingAligned: !input.reading || !!aligned, direction, relations }
}

const NEGATION_ENDINGS = ['ません', 'なかった', 'ない', 'なく', 'ぬ', 'ず']
const NEGATION_PREFIXES = new Set(['無', '不', '非', '未'])

/** 々 and ゝ repeat the character before them */
function repeatedChar(graphemes: readonly Grapheme[], i: number): string {
  const c = graphemes[i].char
  return (c === '々' || c === 'ゝ') && i > 0 ? repeatedChar(graphemes, i - 1) : c
}

/** units of 1…n/2 graphemes repeated in immediate succession (longest first, no overlaps) */
function reduplications(graphemes: readonly Grapheme[]): Relation[] {
  const n = graphemes.length
  const written = (i: number) => graphemes[i].script !== 'symbol'
  const key = (i: number) => toHiragana(repeatedChar(graphemes, i))
  const used = new Set<number>()
  const out: Relation[] = []
  for (let len = Math.floor(n / 2); len >= 1; len--)
    for (let s = 0; s + 2 * len <= n; s++) {
      const unit = range(s, s + len)
      if (!unit.every(written) || unit.some((i) => used.has(i))) continue
      const same = (t: number) => unit.every((i, k) => t + k < n && written(t + k) && !used.has(t + k) && key(t + k) === key(i))
      let count = 1
      while (same(s + count * len)) count++
      if (count < 2) continue
      const occurrences = Array.from({ length: count }, (_, c) => range(s + c * len, s + (c + 1) * len))
      occurrences.flat().forEach((i) => used.add(i))
      out.push({ kind: 'reduplication', value: unit.map((i) => graphemes[i].char).join(''), occurrences })
    }
  return out
}

function mirror(graphemes: readonly Grapheme[]): Relation[] {
  const g = graphemes.filter((x) => x.script !== 'symbol')
  if (g.length < 3) return []
  const k = g.map((x) => toHiragana(x.char))
  if (new Set(k).size < 2 || k.join('') !== [...k].reverse().join('')) return []
  return [{ kind: 'mirror', centre: g.length % 2 ? g[(g.length - 1) / 2].index : -1 }]
}

export interface Run {
  start: number
  end: number
}

export function kanjiRuns(graphemes: readonly Grapheme[]): Run[] {
  const out: Run[] = []
  for (const g of graphemes) {
    if (g.script !== 'kanji') continue
    const last = out[out.length - 1]
    if (last && last.end === g.index) last.end++
    else out.push({ start: g.index, end: g.index + 1 })
  }
  return out
}

/** one step of the writing, as the reading must follow it */
type Step = { run: number } | { kana: string } | { oneOf: string }

/**
 * Match the reading against the writing: kana are literal anchors, each kanji
 * run takes whatever lies between them. Returns run start → reading.
 *
 * Where a run could take more or less, the earlier run takes the least that
 * still lets the rest match — the choice the lazy expression ^(.+?)…$ once
 * written here made. It is made by looking once from the end (from where each
 * later step can still match the rest), so the time grows with the steps times
 * the reading's length, never with the ways a reading can be divided.
 */
export function alignReading(graphemes: readonly Grapheme[], runs: readonly Run[], reading: string): Map<number, string> | null {
  const steps: Step[] = []
  for (let i = 0; i < graphemes.length; ) {
    const run = runs.find((r) => r.start === i)
    if (run) {
      steps.push({ run: run.start })
      i = run.end
      continue
    }
    const g = graphemes[i]
    if (g.script === 'hiragana' || g.script === 'katakana') steps.push({ kana: toHiragana(g.char) })
    else if (g.char === 'ー') steps.push({ oneOf: 'ーあいうえお' })
    // symbols and others are not read
    i++
  }
  // read as UTF-16 units, as the expression read it
  const s = reading.replace(/[^ぁ-ゟー]/g, '')
  const n = s.length
  // can[k][p]: steps k… match s from p exactly to its end
  const can = Array.from({ length: steps.length + 1 }, () => new Array<boolean>(n + 1).fill(false))
  can[steps.length][n] = true
  for (let k = steps.length - 1; k >= 0; k--) {
    const step = steps[k]
    const next = can[k + 1]
    if ('run' in step) {
      // at least one unit, then any place from which the rest matches
      let later = false
      for (let p = n - 1; p >= 0; p--) {
        later ||= next[p + 1]
        can[k][p] = later
      }
    } else if ('kana' in step) {
      for (let p = 0; p + step.kana.length <= n; p++) can[k][p] = s.startsWith(step.kana, p) && next[p + step.kana.length]
    } else {
      for (let p = 0; p < n; p++) can[k][p] = step.oneOf.includes(s[p]) && next[p + 1]
    }
  }
  if (!can[0][0]) return null
  const out = new Map<number, string>()
  let p = 0
  steps.forEach((step, k) => {
    if ('run' in step) {
      // the shortest reading that leaves a match for the rest
      let q = p + 1
      while (!can[k + 1][q]) q++
      out.set(step.run, s.slice(p, q))
      p = q
    } else p += 'kana' in step ? step.kana.length : 1
  })
  return out
}
const range = (a: number, b: number) => Array.from({ length: b - a }, (_, i) => a + i)
