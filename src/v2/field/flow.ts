/**
 * The flow of a line (spec-1 §9.3: v1's trace, adapted — its geometry, not its parameters). A run of the
 * title's graphemes is walked as v1's trace walks its units: a turtle that steps one character along the
 * writing and turns as it goes. What v1 read from motifs, meaning and a random side, v2 reads from the
 * constraints of the words alone; every shape the line takes names the constraint that caused it.
 *
 *   linguistic input                 rule                                         the line
 *   sequence                         one step per character, in reading order     a line          (line)
 *   split inside a word              the rest of the word steps one line across   a stair         (stair)
 *     (inflection, negation)         and goes on from where it was
 *   split between words              a new line, from the head of the first        verse lines     (verse)
 *     (relation word, coordination)
 *   a token repeated at once         each repeat goes back to the head, beside    lines of the    (return)
 *     (a reduplication)                the one before: the unit comes back          repeat
 *   a sound that returns: a mirror,  the line turns back as far as the return     an arc; a ring  (curve)
 *     a voicing, a mora                spans it: (span ÷ line) × (k − 1) ÷ k turns,  for a mirror
 *     (k occurrences)                  spread over its steps (v1's `turns`)
 *   a space the title writes         a step with nothing written                  its own white
 *   a line longer than its room      it breaks where the room ends, at its last   lines           (wrap)
 *     (the rest beside a figure)       split inside a word if there is one
 *
 * A reduplication is not bent: bent back upright, its repeat reads backwards. A vowel or a consonant alone returning (an echo of the vowel, of the onset) does not shape the line: nearly
 * every two-character word has one, and the line would bend for nothing heard. The characters stand upright:
 * the curve carries them, it does not turn them.
 *
 * Units: one character step = 1. Along = the writing direction; across = the side the next line goes to
 * (left in vertical writing, down in horizontal). Lines stand UNIT_SPACING apart.
 */
import type { LanguageAnalysis } from '../../language/analysis'
import { CONSTANTS } from '../spec'
import type { Constraint } from '../types/constraints'

export type FlowBehaviour = 'line' | 'stair' | 'verse' | 'return' | 'curve' | 'space' | 'wrap'

export interface FlowPoint {
  grapheme: number
  x: number
  y: number
}

export interface Flow {
  points: readonly FlowPoint[]
  /** the ink round the points (half a step each way), in steps */
  box: { x0: number; y0: number; x1: number; y1: number }
  /** what shaped it, each with the constraint that caused it */
  behaviours: readonly { kind: FlowBehaviour; at: readonly number[]; because: Constraint['id'] | 'page' }[]
  /** the verse lines, as grapheme runs */
  lines: readonly (readonly number[])[]
}

const INSIDE = new Set(['inflection', 'negation'])
const SHAPING = new Set(['grapheme', 'mora'])

/** where a reduplication returns (ころころ: ころ | ころ): the start of every repeat but the first, or none */
export function returnsOf(language: LanguageAnalysis, c: Constraint): number[] {
  if (c.kind !== 'recurrence' || c.unit !== 'token') return []
  const ms = [...c.members].sort((a, b) => a - b)
  const ch = ms.map((g) => language.graphemes[g]?.char)
  for (let p = 1; p <= ms.length / 2; p++) {
    if (ms.length % p) continue
    if (ch.every((x, i) => x === ch[i % p])) return ms.filter((_, i) => i > 0 && i % p === 0)
  }
  return []
}

/** how far a recurrence within a line turns it, in turns (0 when it does not shape the line) */
function closureOf(c: Constraint, line: readonly number[]): number {
  if (c.kind !== 'recurrence' || !SHAPING.has(c.unit)) return 0
  const inLine = new Set(line)
  if (!c.members.every((g) => inLine.has(g))) return 0
  if (c.unit === 'grapheme' && c.value === 'mirror') return 1
  const ms = [...c.members].sort((a, b) => a - b)
  const span = line.indexOf(ms[ms.length - 1]) - line.indexOf(ms[0]) + 1
  const k = ms.length
  if (k < 2) return 0
  return (span / line.length) * ((k - 1) / k)
}

export function flowOf(graphemes: readonly number[], constraints: readonly Constraint[], language: LanguageAnalysis, wrapAt = Infinity): Flow {
  const vertical = language.direction === 'vertical'
  const h0 = vertical ? Math.PI / 2 : 0
  const LINE = CONSTANTS.UNIT_SPACING.value
  const first = graphemes[0]
  const splits = constraints.filter((c): c is Extract<Constraint, { kind: 'split' }> => c.kind === 'split' && c.at !== first && graphemes.includes(c.at))
  const between = new Map<number, Constraint['id']>()
  const inside = new Map<number, Constraint['id']>()
  for (const s of splits) (INSIDE.has(s.by) ? inside : between).set(s.at, between.get(s.at) ?? inside.get(s.at) ?? s.id)
  for (const g of between.keys()) inside.delete(g)
  const returns = new Map<number, Constraint['id']>()
  for (const c of constraints) for (const g of returnsOf(language, c)) if (graphemes.includes(g) && g !== first) returns.set(g, c.id)
  const behaviours: { kind: FlowBehaviour; at: number[]; because: Constraint['id'] | 'page' }[] = []
  const note = (kind: FlowBehaviour, at: number, because: Constraint['id'] | 'page') => {
    const b = behaviours.find((x) => x.kind === kind && x.because === because)
    if (b) b.at.push(at)
    else behaviours.push({ kind, at: [at], because })
  }
  // the verse lines: a new one at each split between words
  const lines: number[][] = [[]]
  for (const g of graphemes) {
    if ((between.has(g) || returns.has(g)) && lines[lines.length - 1].length) {
      if (returns.has(g)) note('return', g, returns.get(g)!)
      else note('verse', g, between.get(g)!)
      lines.push([])
    }
    lines[lines.length - 1].push(g)
  }
  // where the page ends a line (wrapAt steps along), the line breaks: at its last split inside a word, else at
  // the character (a line of writing ends where its page does; the page is the cause, not a relation)
  if (Number.isFinite(wrapAt))
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const most = Math.max(1, Math.floor(wrapAt))
      if (line.length <= most) continue
      const at = [...line.slice(1, most + 1)].reverse().find((g) => inside.has(g))
      const cut = at !== undefined ? line.indexOf(at) : most
      note('wrap', line[cut], 'page')
      lines.splice(i, 1, line.slice(0, cut), line.slice(cut))
    }
  const sequence = constraints.find((c) => c.kind === 'sequence')
  if (sequence) behaviours.push({ kind: 'line', at: [first], because: sequence.id })
  // each line walked on its own, then set beside the one before it
  const points: FlowPoint[] = []
  let acrossAt = 0
  for (const line of lines) {
    const written = line.filter((g) => language.graphemes[g]?.char.trim())
    // the turn: the recurrence that returns most within this line (a curve needs three characters to be seen)
    let closure = 0
    let cause: Constraint['id'] | null = null
    if (written.length >= 3) for (const c of constraints) {
      const k = closureOf(c, line)
      if (k > closure + 1e-9) {
        closure = k
        cause = c.id
      }
    }
    if (closure > 0 && cause) note('curve', line[0], cause)
    const turn = (2 * Math.PI * closure) / Math.max(1, written.length - 1 + closure)
    let x = 0
    let y = 0
    let h = h0
    const local: FlowPoint[] = []
    for (const g of line) {
      const dir = { x: Math.cos(h), y: Math.sin(h) }
      const side = { x: Math.cos(h + Math.PI / 2), y: Math.sin(h + Math.PI / 2) }
      if (inside.has(g) && g !== line[0]) {
        note('stair', g, inside.get(g)!)
        x += side.x * LINE
        y += side.y * LINE
      }
      if (!language.graphemes[g]?.char.trim()) {
        if (sequence) note('space', g, sequence.id)
        x += dir.x
        y += dir.y
        continue
      }
      local.push({ grapheme: g, x, y })
      x += dir.x
      y += dir.y
      h += turn
    }
    // set beside the line before: across by that line's reach, and the gap lines keep
    const acrossOf = (p: FlowPoint) => (vertical ? -p.x : p.y)
    const lo = Math.min(...local.map(acrossOf)) - 0.5
    const hi = Math.max(...local.map(acrossOf)) + 0.5
    const shift = points.length ? acrossAt + (LINE - 1) - lo : 0
    for (const p of local) points.push(vertical ? { grapheme: p.grapheme, x: p.x - shift, y: p.y } : { grapheme: p.grapheme, x: p.x, y: p.y + shift })
    acrossAt = (points.length ? shift : 0) + hi
  }
  const r = (v: number) => Math.round(v * 1000) / 1000
  const out = points.map((p) => ({ grapheme: p.grapheme, x: r(p.x), y: r(p.y) }))
  const xs = out.map((p) => p.x)
  const ys = out.map((p) => p.y)
  const box = out.length ? { x0: Math.min(...xs) - 0.5, y0: Math.min(...ys) - 0.5, x1: Math.max(...xs) + 0.5, y1: Math.max(...ys) + 0.5 } : { x0: 0, y0: 0, x1: 0, y1: 0 }
  return { points: out, box, behaviours, lines }
}
