/**
 * v3 — what the title asks of the form, read from the analysis.
 *
 * Not a new template and not a style: a set of signed pressures on the axes
 * of the form space (form/profile.ts). The page the v2c grammar drew is the
 * anchor; these pressures say in which directions this title's own
 * properties push away from it, and how hard. Each contribution names the
 * linguistic (or letterform) property that causes it — if a property cannot
 * be named, there is no pressure.
 *
 * Properties read (all 0–1):
 *   asymmetry      the two terms of the title's binary relation differ in weight
 *                  (ink × sound length): 大きな｜犬, 見｜えない, 子供｜城
 *   inkContrast    the title's letterforms differ in how much ink they carry
 *   irregularRepeat a repetition that does not cover the title evenly (ささやき),
 *                  as opposed to a perfect one (ころころ, 人々, 雨の中の雨)
 *   perfectRepeat  the title is its repetition, or reads the same backwards
 *   prosody        special beats — ん, っ, long vowels, whispered vowels — among the beats
 *   turns          the reading turns: word boundaries per character
 *   switches       the writing changes script along the title (kanji ↔ kana ↔ katakana)
 *   returning      the title ends where it began (the same character, the same sound)
 *   erasure        the poem writes something as space: a negation, a silent beat
 *   decomposable   a character falls into parts the computer can read
 *   contained      one of the title's letterforms is read inside another
 *   star           several words hang on one head, or several terms are coordinated
 *   length         the title is long enough to be a line
 *   glyphAsymmetry the title's letterforms are not mirror-symmetric
 *   counters       the letterforms close white inside themselves
 */
import type { Relation } from '../../language/analysis'
import type { Analysis } from '../types'
import { AXES, flat, type Axis, type FormProfile } from './profile'

export interface Pressure {
  axis: Axis
  amount: number
  because: string
}

export interface FormTarget {
  /** 0–1 each: the properties read */
  properties: Record<string, number>
  /** signed, per axis: where the title pushes the anchor's form (clipped to ±0.8) */
  delta: FormProfile
  pressures: Pressure[]
}

const clip = (v: number, lo = 0, hi = 1) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo)

function inkOf(a: Analysis, char: string): number {
  try {
    return a.glyphs.get(char).metrics.density
  } catch {
    return 0
  }
}

/** the two terms of the title's first binary relation, as grapheme lists */
function terms(a: Analysis): [number[], number[]] | null {
  const tok = (t: number) => {
    const k = a.tokens[t]
    return k ? Array.from({ length: k.end - k.start }, (_, i) => k.start + i) : []
  }
  for (const r of a.relations) {
    if (r.kind === 'coordination' || r.kind === 'separation') return [tok(r.left), tok(r.right)]
    if (r.kind === 'dependency') return [tok(r.dependent), tok(r.head)]
  }
  const inflection = a.relations.find((r): r is Extract<Relation, { kind: 'inflection' }> => r.kind === 'inflection')
  if (inflection) {
    const k = a.tokens[inflection.token]
    const stem = Array.from({ length: inflection.at - k.start }, (_, i) => k.start + i)
    const ending = Array.from({ length: k.end - inflection.at }, (_, i) => inflection.at + i)
    return [stem, ending]
  }
  const pair = a.glyphRelations.find((r) => r.origin === 'title')
  if (pair) {
    const at = (c: string) => a.graphemes.filter((g) => g.char === c).map((g) => g.index)
    return [at(pair.inner), at(pair.outer)]
  }
  return null
}

export function readProperties(a: Analysis): Record<string, number> {
  const chars = a.graphemes.filter((g) => g.char.trim())
  const n = chars.length
  const beatsOf = (gs: number[]) => a.morae.filter((m) => m.graphemes.some((g) => gs.includes(g))).reduce((s, m) => s + m.weight, 0)
  const weightOf = (gs: number[]) => gs.reduce((s, g) => s + inkOf(a, a.graphemes[g].char), 0) * (1 + beatsOf(gs) / 4)

  const t = terms(a)
  const asymmetry = t && t[0].length && t[1].length ? clip(Math.abs(Math.log(weightOf(t[0]) / (weightOf(t[1]) || 1e-6))) / Math.log(4)) : 0

  const inks = [...new Set(chars.map((g) => g.char))].map((c) => inkOf(a, c)).filter((d) => d > 0)
  const mean = inks.reduce((s, d) => s + d, 0) / (inks.length || 1)
  const cv = inks.length > 1 ? Math.sqrt(inks.reduce((s, d) => s + (d - mean) ** 2, 0) / inks.length) / (mean || 1) : 0
  const inkContrast = clip(cv / 0.45)

  const whole = a.relations.some((r) => r.kind === 'mirror') || a.relations.some((r) => r.kind === 'reduplication' && r.occurrences.flat().length >= n)
  const repeated = new Set(a.relations.flatMap((r) => (r.kind === 'recurrence' && r.unit === 'grapheme' ? r.members : r.kind === 'reduplication' ? r.occurrences.flat() : [])))
  const perfectRepeat = whole ? 1 : 0
  const irregularRepeat = !whole && repeated.size ? clip(repeated.size / n) * (1 - clip(repeated.size / n)) * 4 : 0

  const special = a.morae.filter((m) => m.kind === 'N' || m.kind === 'Q' || m.kind === 'R' || m.devoiced).length
  const prosody = a.morae.length ? clip((special / a.morae.length) / 0.4) : 0

  const turns = n > 1 ? clip((a.tokens.filter((k) => k.end > k.start).length - 1) / Math.max(1, n - 1) / 0.5) : 0
  let switches = 0
  for (let i = 1; i < chars.length; i++) if (chars[i].script !== chars[i - 1].script) switches++
  const scriptSwitches = n > 1 ? clip(switches / (n - 1) / 0.5) : 0

  const first = chars[0]
  const last = chars[chars.length - 1]
  const vowelOf = (g: number) => a.morae.find((m) => m.graphemes.includes(g))?.vowel
  const returning =
    n < 2 ? 0 : a.relations.some((r) => r.kind === 'mirror') || first.char === last.char ? 1 : vowelOf(first.index) && vowelOf(first.index) === vowelOf(last.index) ? 0.4 : 0

  const erasure = clip(
    (a.relations.some((r) => r.kind === 'negation') ? 0.7 : 0) + (a.relations.some((r) => r.kind === 'silence') ? 0.4 : 0),
  )
  const decomposable = clip(
    Math.max(0, ...chars.map((g) => {
      try {
        return (a.glyphs.get(g.char).metrics.islands - 2) / 3
      } catch {
        return 0
      }
    })),
  )
  const contained = clip(Math.max(0, ...a.glyphRelations.filter((r) => r.origin === 'title' && r.kind === 'containment').map((r) => r.score)))
  const heads = new Map<number, number>()
  for (const r of a.relations) if (r.kind === 'dependency') heads.set(r.head, (heads.get(r.head) ?? 0) + 1)
  const coordinated = a.relations.filter((r) => r.kind === 'coordination').length
  const star = clip(Math.max(0, ...heads.values()) / 3 + Math.max(0, coordinated - 1) / 2)
  const length = clip((n - 4) / 6)
  const sym = chars.map((g) => a.interiors.get(g.char)?.symmetry.x).filter((v): v is number => v !== undefined)
  const glyphAsymmetry = sym.length ? clip(1 - sym.reduce((s, v) => s + v, 0) / sym.length) : 0
  const counters = clip(chars.reduce((s, g) => s + (a.interiors.get(g.char)?.counters.length ? 1 : 0), 0) / Math.max(1, n))

  return {
    asymmetry,
    inkContrast,
    irregularRepeat,
    perfectRepeat,
    prosody,
    turns,
    switches: scriptSwitches,
    returning,
    erasure,
    decomposable,
    contained,
    star,
    length,
    glyphAsymmetry,
    counters,
  }
}

/** axis ← property × weight, with the reason as it will be reported */
const RULES: [Axis, string, number, string][] = [
  ['curvature', 'turns', 0.45, 'the reading turns at its word boundaries: the figure bends'],
  ['curvature', 'returning', 0.35, 'the title ends where it began: the figure bends back toward its start'],
  ['closure', 'returning', 0.5, 'the title ends where it began: the figure closes on itself'],
  ['closure', 'asymmetry', -0.35, 'the two terms differ in weight: what goes round the lighter one does not close'],
  ['radiality', 'star', 0.4, 'several words hang on one head: marks gather on every side of it'],
  ['fragmentation', 'erasure', 0.45, 'the poem erases part of the title: the figure comes apart there'],
  ['fragmentation', 'decomposable', 0.35, 'a character falls into parts: its marks loosen'],
  ['dispersion', 'erasure', 0.3, 'what is erased leaves its marks scattered where it was'],
  ['dispersion', 'perfectRepeat', -0.3, 'a perfect repetition holds together'],
  ['periodicity', 'perfectRepeat', 0.35, 'a perfect repetition keeps its interval'],
  ['periodicity', 'irregularRepeat', -0.5, 'the repetition does not cover the title evenly: its spacing is uneven'],
  ['periodicity', 'prosody', -0.4, 'special beats (ん, っ, long and whispered vowels) break the even pulse'],
  ['periodicity', 'inkContrast', -0.3, 'the letterforms differ in weight: the heavier ones pull the spacing toward themselves'],
  ['branching', 'star', 0.45, 'several terms stand on one structure: it forks'],
  ['branching', 'turns', 0.2, 'where the reading turns, the line may divide'],
  ['hierarchy', 'inkContrast', 0.4, 'the letterforms differ in weight: sizes follow the weight continuously'],
  ['hierarchy', 'asymmetry', 0.3, 'the two terms differ in weight: their marks differ in size'],
  ['rotation', 'switches', -0.4, 'the writing changes script along the title: the marks do not all face one way'],
  ['rotation', 'turns', -0.2, 'the reading turns: the marks turn with it'],
  ['symmetry', 'asymmetry', -0.45, 'the two terms differ in weight: the figure leans toward the heavier'],
  ['symmetry', 'glyphAsymmetry', -0.25, 'the letterforms are not mirror-symmetric'],
  ['symmetry', 'perfectRepeat', 0.3, 'a perfect repetition or a mirror title is symmetric'],
  ['containment', 'contained', 0.35, 'one letterform is read inside another'],
  ['porosity', 'erasure', 0.35, 'what is erased is white inside the figure'],
  ['porosity', 'counters', 0.2, 'the letterforms close white inside themselves'],
  ['linearity', 'length', 0.3, 'a long title is a line'],
  ['linearity', 'returning', -0.3, 'a title that returns is not a straight line'],
]

export function formTarget(a: Analysis): FormTarget {
  const properties = readProperties(a)
  const delta = flat(0)
  const pressures: Pressure[] = []
  for (const [axis, property, weight, because] of RULES) {
    const amount = weight * (properties[property] ?? 0)
    if (Math.abs(amount) < 0.02) continue
    delta[axis] += amount
    pressures.push({ axis, amount, because: `${property} ${properties[property].toFixed(2)}: ${because}` })
  }
  for (const k of AXES) delta[k] = clip(delta[k], -0.8, 0.8)
  return { properties, delta, pressures }
}
