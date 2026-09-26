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
 *     (relation word, coordination)    — where the lines still read as lines; else
 *                                        a half step of white along the one line      a parted line   (gap)
 *   a token repeated at once         each repeat goes back to where the unit      lines of the    (return)
 *     (a reduplication)                began, beside it: the unit comes back        repeat
 *   a sound that returns: a mirror,  the line turns back as far as the return     an arc; a ring  (curve)
 *     a voicing, a mora heard again    spans it: (span ÷ line) × (k − 1) ÷ k turns,  for a mirror
 *     after another (k occurrences)    spread over its steps (v1's `turns`); only a
 *                                        line of three characters or more shows it
 *   a space the title writes         a step with nothing written                  its own white
 *   a line longer than its room      it breaks where the room ends, at its last   lines           (wrap)
 *     (the rest beside a figure)       word's beginning or split inside a word; a line
 *                                        keeps two characters at least, and the lines
 *                                        are no wider across than they are long
 *
 * A reduplication is not bent: bent back upright, its repeat reads backwards. A vowel or a consonant alone
 * returning (an echo of the vowel, of the onset) does not shape the line: nearly every two-character word has
 * one, and the line would bend for nothing heard. Nor does a mora written twice that is not heard coming back:
 * ー and っ (their sound is their neighbour's), or a mora doubled in place (ささ). The characters stand upright:
 * the curve carries them, it does not turn them.
 *
 * Units: one character step = 1. Along = the writing direction; across = the side the next line goes to
 * (left in vertical writing, down in horizontal). Lines stand UNIT_SPACING apart.
 */
import type { LanguageAnalysis } from '../../language/analysis'
import { SMALL } from '../../language/kana'
import { CONSTANTS } from '../spec'
import type { Constraint } from '../types/constraints'

export type FlowBehaviour = 'line' | 'stair' | 'verse' | 'gap' | 'return' | 'curve' | 'space' | 'wrap'

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
/** the symbols that open (a line may begin with them) */
const OPENING = new Set([...'「『（(［[〈《【〔“‘'])
const SHAPING = new Set(['grapheme', 'mora'])

/** where a reduplication returns (ころころ: ころ | ころ): the start of every repeat but the first, with the start of the one it repeats; or none */
export function returnsOf(language: LanguageAnalysis, c: Constraint): { at: number; of: number }[] {
  if (c.kind !== 'recurrence' || c.unit !== 'token') return []
  const ms = [...c.members].sort((a, b) => a - b)
  const ch = ms.map((g) => language.graphemes[g]?.char)
  // a repeat of one character inside a longer word (ささやき, 特許許可) is a doubled letter, not a word said again:
  // it returns only when the repeats are the whole word, or the unit is more than one character (ぴょこ | ぴょこ)
  const inWord = new Set(ms)
  const whole = [...new Set(ms.map((g) => language.tokenOf[g]))].every((t) => {
    const tk = language.tokens[t]
    return !!tk && Array.from({ length: tk.end - tk.start }, (_, i) => tk.start + i).every((g) => inWord.has(g) || !language.graphemes[g]?.char.trim())
  })
  for (let p = 1; p <= ms.length / 2; p++) {
    if (ms.length % p) continue
    if (p === 1 && !whole) continue
    if (ch.every((x, i) => x === ch[i % p])) return ms.filter((_, i) => i > 0 && i % p === 0).map((g) => ({ at: g, of: ms[ms.indexOf(g) - p] }))
  }
  return []
}

/**
 * A sound that comes back, not one that is merely there twice: the same mora with a sound of its own (ー and っ
 * take theirs from beside them: コー and ヒー share a mark, not a sound), heard again after another between
 * (a doubling, ささ, is one sound held, not a return). Graphemes (a voicing beside its base) the same.
 */
function returns(c: Extract<Constraint, { kind: 'recurrence' }>, language: LanguageAnalysis): boolean {
  if (c.unit === 'mora') {
    const ms = language.morae.filter((m) => m.key === c.value)
    if (ms.length < 2 || ms.some((m) => m.kind === 'R' || m.kind === 'Q')) return false
    const at = ms.map((m) => m.index).sort((a, b) => a - b)
    return at.every((x, i) => i === 0 || x - at[i - 1] >= 2)
  }
  const at = [...c.members].sort((a, b) => a - b)
  return at.length >= 2 && at.every((x, i) => i === 0 || x - at[i - 1] >= 2)
}

/** how far a recurrence within a line turns it, in turns (0 when it does not shape the line) */
function closureOf(c: Constraint, line: readonly number[], language: LanguageAnalysis): number {
  if (c.kind !== 'recurrence' || !SHAPING.has(c.unit)) return 0
  const inLine = new Set(line)
  if (!c.members.every((g) => inLine.has(g))) return 0
  if (c.unit === 'grapheme' && c.value === 'mirror') return 1
  if (!returns(c, language)) return 0
  const ms = [...c.members].sort((a, b) => a - b)
  const span = line.indexOf(ms[ms.length - 1]) - line.indexOf(ms[0]) + 1
  const k = ms.length
  if (k < 2) return 0
  return (span / line.length) * ((k - 1) / k)
}

/** the length of the lines a line of n characters breaks into where the page ends it at about L: even lengths */
function lineLength(n: number, L: number): number {
  const most = Math.max(2, Math.floor(L))
  return most >= n ? n : Math.ceil(n / Math.ceil(n / most))
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
  const echoes = new Map<number, number>()
  for (const c of constraints)
    for (const r of returnsOf(language, c))
      if (graphemes.includes(r.at) && r.at !== first) {
        returns.set(r.at, c.id)
        echoes.set(r.at, r.of)
      }
  const behaviours: { kind: FlowBehaviour; at: number[]; because: Constraint['id'] | 'page' }[] = []
  const note = (kind: FlowBehaviour, at: number, because: Constraint['id'] | 'page') => {
    const b = behaviours.find((x) => x.kind === kind && x.because === because)
    if (b) b.at.push(at)
    else behaviours.push({ kind, at: [at], because })
  }
  // the verse lines: a new one at each split between words
  const noHead = (g: number) => {
    const x = language.graphemes[g]
    return !!x && ((x.script === 'symbol' && !OPENING.has(x.char)) || x.script === 'mark' || SMALL.has(x.char))
  }
  // verse lines only where they still read as lines: the longest no shorter than the lines are wide (私 | の, 手 |
  // と足: lines of a character or two, side by side, read across them — backwards, in vertical writing). Else
  // the words part by a half step along the one line (gap). Returns are exempt: their lines are one unit repeated
  const writtenIn = (gs: readonly number[]) => gs.filter((g) => language.graphemes[g]?.char.trim()).length
  const verses: number[][] = [[]]
  for (const g of graphemes) {
    if (between.has(g) && verses[verses.length - 1].length) verses.push([])
    verses[verses.length - 1].push(g)
  }
  const verse = verses.length < 2 || Math.max(...verses.map(writtenIn)) >= verses.length * LINE
  const gaps = new Set<number>()
  const lines: number[][] = [[]]
  for (const g of graphemes) {
    if (between.has(g) && !verse && !returns.has(g) && lines[lines.length - 1].length) {
      note('gap', g, between.get(g)!)
      gaps.add(g)
    } else if ((between.has(g) || returns.has(g)) && lines[lines.length - 1].length) {
      if (returns.has(g)) note('return', g, returns.get(g)!)
      else note('verse', g, between.get(g)!)
      lines.push([])
    }
    lines[lines.length - 1].push(g)
  }
  // where the page ends a line (wrapAt steps along), the line breaks: at its last word's beginning or split
  // inside a word, else at the character (a line of writing ends where its page does; the page is the cause, not a relation)
  if (Number.isFinite(wrapAt)) {
    // where a word begins (v1's tokens): a line of writing breaks between words where it can
    const words = new Set(language.tokens.map((t) => t.start))
    /** a line broken into lines of about L: even lengths, set again for what is left after each break */
    const piecesOf = (line: readonly number[], L: number) => {
      const out: number[][] = []
      let left = [...line]
      for (let most = lineLength(left.length, L); left.length > most; most = lineLength(left.length, L)) {
        const at = [...left.slice(2, most + 1)].reverse().find((g) => (words.has(g) || inside.has(g)) && left.length - left.indexOf(g) >= 2)
        let cut = at !== undefined ? left.indexOf(at) : most
        // a line does not begin with what closes or follows a character (！、ー ゃ っ; v1 reads these as marks,
        // symbols and small kana): the character before it goes down with it, or where that would leave a line
        // of one, it stays at the end of the line before, hanging past it
        let back = cut
        while (back > 2 && noHead(left[back])) back--
        if (!noHead(left[back])) cut = back
        while (cut < left.length && noHead(left[cut])) cut++
        if (cut >= left.length) break
        out.push(left.slice(0, cut))
        left = left.slice(cut)
      }
      out.push(left)
      return out
    }
    // the lines of one line must still read as lines (two characters each at least, no wider across than they
    // are long): where they would not, they are made longer, up to the line unbroken
    const reads = (ps: readonly (readonly number[])[]) => ps.length === 1 || (ps.every((q) => writtenIn(q) >= 2) && Math.max(...ps.map(writtenIn)) >= ps.length * LINE)
    const out: number[][] = []
    for (const line of lines) {
      let ps = [line]
      for (let L = Math.max(2, Math.floor(wrapAt)); L < line.length; L++) {
        const q = piecesOf(line, L)
        if (reads(q)) {
          ps = q
          break
        }
      }
      for (const q of ps.slice(1)) note('wrap', q[0], 'page')
      out.push(...ps)
    }
    lines.splice(0, lines.length, ...out)
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
      const k = closureOf(c, line, language)
      if (k > closure + 1e-9) {
        closure = k
        cause = c.id
      }
    }
    if (closure > 0 && cause) note('curve', line[0], cause)
    const turn = (2 * Math.PI * closure) / Math.max(1, written.length - 1 + closure)
    // a repeat's line begins beside the unit it repeats (かえる ぴょこ | ぴょこ: under the first ぴょこ), which is
    // the head where the unit is the whole line before (ころ | ころ)
    const echo = echoes.has(line[0]) ? points.find((q) => q.grapheme === echoes.get(line[0])) : undefined
    let x = echo && !vertical ? echo.x : 0
    let y = echo && vertical ? echo.y : 0
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
      if (gaps.has(g) && g !== line[0]) {
        x += dir.x * 0.5
        y += dir.y * 0.5
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
