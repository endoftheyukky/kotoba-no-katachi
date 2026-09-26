/**
 * The figure in the title's line (spec-1 §9.3, TODO-10): a longer title is one line of reading, and the
 * figure of its primary Discovery is one item of it. The rest of the title does not stand beside the figure
 * as a caption: it continues from the figure's own characters.
 *
 *   linguistic input                   rule                                            on the page
 *   a character of the title that the  the figure's first unit of it in reading order   the title's 木 among
 *     figure repeats as its unit         writes it; the others repeat it                 the units of 林
 *     (木と林と森, 川または州)
 *   the title's characters the figure  anchors: where Layout writes them from the        —
 *     writes                             figure's geometry (the derived character, the
 *                                        whole, the parts, the unit above)
 *   a run of the rest after an anchor  it goes on from that character, out of the       the words leave the
 *                                        figure along the writing, in that character's   figure in the column
 *                                        column (row)                                    (row) of their word
 *   a run of the rest before an anchor it comes into that character, ending in its      —
 *                                        column (row), before the figure
 *   the run itself                     walked as a flow (field/flow.ts): verse lines,  the words fold as
 *                                        stairs, returns, curves from its own words      their words do
 *   size                               the figure's unit (a character unit's size; the  —
 *                                        lattice cell of a stroke unit), at most
 *                                        SEQUENCE_MAX_UNIT; smaller only where the words
 *                                        do not fit at the smallest figure
 *   where the rest goes: in the line   before and after the figure along the writing;   —
 *                                        the figure as long as the runs still fit
 *                                        beside it
 *     or beside (where the figure's    the words before it on the line before (above;   the words go on as
 *     characters stand together in     right in vertical writing), the words after on   writing goes on when
 *     the title)                       the next (below; left), from the head of the     a line is full
 *                                        page; the figure keeps the page's length and
 *                                        gives way across
 *   of the two                         the one that leaves the figure larger; in the    —
 *                                        line when equal
 *
 * A half character of white parts the words from the figure, as a split parts a line.
 */
import { layout } from '../layout'
import { CONSTANTS } from '../spec'
import type { Constraint } from '../types/constraints'
import type { CauseRef, FieldDetail, FieldGeometry, PageRect } from '../types/field'
import type { PlanCandidate } from '../types/plan'
import type { Discovery } from '../types/discovery'
import type { AlignIndex } from '../align/lookup'
import type { LanguageAnalysis } from '../../language/analysis'
import { flowOf, type Flow } from './flow'

const K = (n: keyof typeof CONSTANTS) => CONSTANTS[n].value
const r1 = (v: number) => Math.round(v * 10) / 10

export interface LineInput {
  plan: PlanCandidate
  constraints: readonly Constraint[]
  primary: Discovery | null
  align: AlignIndex
  language: LanguageAnalysis
  rest: readonly number[]
}

/** the figure's span on the writing axis: its extent, or the character itself; a singleton's ink out of the field counts */
export function figureSpan(g: FieldGeometry, horizontal: boolean): { lo: number; hi: number } | null {
  const r = g.extent ?? g.detail?.parts?.[0]?.rect ?? null
  if (!r) return null
  let lo = horizontal ? r.x : r.y
  let hi = horizontal ? r.x + r.w : r.y + r.h
  for (const w of g.whitespace)
    if (w.cause.kind === 'constraint' && w.cause.id.startsWith('c:boundary-side')) {
      const s = g.singleton
      if (s?.point) {
        const half = (g.unitSize * s.scale) / 2
        lo = Math.min(lo, (horizontal ? s.point.x : s.point.y) - half)
        hi = Math.max(hi, (horizontal ? s.point.x : s.point.y) + half)
      }
    }
  return { lo, hi }
}

/** a geometry moved on the page (the figure and everything that stands with it) */
export function shiftGeometry(g: FieldGeometry, dx: number, dy: number): FieldGeometry {
  if (!dx && !dy) return g
  const R = (r: PageRect): PageRect => ({ x: r1(r.x + dx), y: r1(r.y + dy), w: r.w, h: r.h })
  const P = <T extends { x: number; y: number }>(p: T): T => ({ ...p, x: r1(p.x + dx), y: r1(p.y + dy) })
  const d = g.detail
  return {
    ...g,
    extent: g.extent ? R(g.extent) : null,
    ...(g.inner ? { inner: g.inner.map(R) } : {}),
    ...(g.singleton ? { singleton: { ...g.singleton, ...(g.singleton.point ? { point: P(g.singleton.point) } : {}) } } : {}),
    whitespace: g.whitespace.map((w) => ({ ...w, region: R(w.region) })),
    detail: d && {
      ...d,
      ...(d.grid ? { grid: { ...d.grid, x0: r1(d.grid.x0 + dx), y0: r1(d.grid.y0 + dy) } } : {}),
      ...(d.points ? { points: d.points.map(P) } : {}),
      ...(d.ring ? { ring: { ...d.ring, inner: R(d.ring.inner) } } : {}),
      ...(d.band ? { band: { ...d.band, rect: R(d.band.rect) } } : {}),
      ...(d.parts ? { parts: d.parts.map((p) => ({ ...p, rect: R(p.rect) })) } : {}),
      ...(d.line ? { line: { ...d.line, rect: R(d.line.rect) } } : {}),
      ...(d.interfaceAt ? { interfaceAt: P(d.interfaceAt) } : {}),
      ...(d.titleUnits ? { titleUnits: d.titleUnits.map(P) } : {}),
      ...(d.flow ? { flow: { ...d.flow, points: d.flow.points.map(P) } } : {}),
    },
  }
}

/** the characters a figure repeats as its units (a stroke unit is not a character) */
function unitsOf(g: FieldGeometry): string[] {
  const d = g.detail
  if (!d) return []
  const out = new Set<string>()
  if (d.unit && !d.strokeUnit) out.add(d.unit)
  if (d.ring) {
    out.add(d.ring.item)
    out.add(d.ring.innerItem)
  }
  return [...out]
}

interface Figure {
  g: FieldGeometry
  /** the rest graphemes the figure now writes (a unit that is the title's character) */
  realised: number[]
  /** where the figure writes the title's characters */
  anchors: Map<number, { x: number; y: number }>
}

/** the figure, with the title's characters it writes: its own, and the units that are the title's */
function figureOf(t: LineInput, g: FieldGeometry): Figure {
  const vertical = t.language.direction === 'vertical'
  const first = (a: { x: number; y: number }, b: { x: number; y: number }) => (vertical ? b.x - a.x || a.y - b.y : a.y - b.y || a.x - b.x)
  const lay = (x: FieldGeometry) => layout({ plan: t.plan, geometry: x, primary: t.primary, align: t.align, language: t.language }).marks
  let marks = lay(g)
  const realised: number[] = []
  const titleUnits = [...(g.detail?.titleUnits ?? [])]
  for (const u of unitsOf(g)) {
    const gi = t.rest.find((i) => t.language.graphemes[i].char === u && !realised.includes(i))
    if (gi === undefined) continue
    const unit = marks.filter((m) => m.derived && !m.keep && m.char === u).sort(first)[0]
    if (!unit) continue
    realised.push(gi)
    titleUnits.push({ grapheme: gi, x: unit.x, y: unit.y })
  }
  if (realised.length) {
    g = { ...g, detail: { ...g.detail, titleUnits } as FieldDetail }
    marks = lay(g)
  }
  const anchors = new Map<number, { x: number; y: number }>()
  for (const m of marks) if (m.grapheme !== undefined && !anchors.has(m.grapheme)) anchors.set(m.grapheme, { x: m.x, y: m.y })
  // parts that stand for a character: where they stand together
  const by = new Map<number, { x: number; y: number }[]>()
  for (const m of marks) if (m.represents !== undefined) by.set(m.represents, [...(by.get(m.represents) ?? []), { x: m.x, y: m.y }])
  for (const [gi, ps] of by)
    if (!anchors.has(gi)) {
      const xs = ps.map((p) => p.x)
      const ys = ps.map((p) => p.y)
      anchors.set(gi, { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 })
    }
  return { g, realised, anchors }
}

interface Run {
  graphemes: number[]
  flow: Flow
  /** after: it goes on from the anchor; before: it comes into it */
  side: 'before' | 'after'
  anchor: number | null
}

/** the rest in runs of consecutive graphemes, each walked as a flow and attached to the character next to it in the figure */
function runsOf(t: LineInput, rest: readonly number[], anchors: ReadonlyMap<number, unknown>, wrapOf: (gs: readonly number[]) => number = () => Infinity): Run[] {
  const runs: number[][] = []
  for (const g of [...rest].sort((a, b) => a - b)) {
    const last = runs[runs.length - 1]
    if (last && last[last.length - 1] === g - 1) last.push(g)
    else runs.push([g])
  }
  const keys = [...anchors.keys()].sort((a, b) => a - b)
  return runs
    .map((gs) => {
      const flow = flowOf(gs, t.constraints, t.language, wrapOf(gs))
      const prev = anchors.has(gs[0] - 1) ? gs[0] - 1 : null
      const next = anchors.has(gs[gs.length - 1] + 1) ? gs[gs.length - 1] + 1 : null
      if (prev !== null) return { graphemes: gs, flow, side: 'after' as const, anchor: prev }
      if (next !== null) return { graphemes: gs, flow, side: 'before' as const, anchor: next }
      const before = keys.filter((k) => k < gs[0])
      if (before.length) return { graphemes: gs, flow, side: 'after' as const, anchor: before[before.length - 1] }
      const after = keys.filter((k) => k > gs[0])
      return { graphemes: gs, flow, side: 'before' as const, anchor: after.length ? after[0] : null }
    })
    .filter((r) => r.flow.points.length)
}

type Placed = { points: { grapheme: number; x: number; y: number }[]; size: number; behaviours: string[] }
interface Arranged {
  g: FieldGeometry
  candidates: FieldGeometry[]
  realised: number[]
  runs: Run[]
  flows: Placed[]
  /** the figure's area on the page: what the arrangement is chosen by */
  area: number
  way: 'in the line' | 'beside'
}

const lenOf = (f: Flow, horizontal: boolean) => (horizontal ? f.box.x1 - f.box.x0 : f.box.y1 - f.box.y0)
const wideOf = (f: Flow, horizontal: boolean) => (horizontal ? f.box.y1 - f.box.y0 : f.box.x1 - f.box.x0)
const placedOf = (f: Flow, m: number, ox: number, oy: number): Placed => ({ points: f.points.map((p) => ({ grapheme: p.grapheme, x: r1(ox + p.x * m), y: r1(oy + p.y * m) })), size: r1(m), behaviours: [...new Set(f.behaviours.map((b) => b.kind))] })

/** the figure's box on the page (its extent, or its parts, or the character itself) */
function boxOf(g: FieldGeometry): PageRect | null {
  const h = figureSpan(g, true)
  const v = figureSpan(g, false)
  return h && v ? { x: h.lo, y: v.lo, w: h.hi - h.lo, h: v.hi - v.lo } : null
}

/**
 * In the line: the rest before and after the figure along the writing, each run continuing from the figure's
 * character next to it; the figure as long as the runs still fit beside it at the figure's measure.
 */
function inTheLine(t: LineInput, frame: PageRect, figureAt: FigureAt): Arranged | null {
  const horizontal = t.language.direction !== 'vertical'
  const measure = Math.min(frame.w, frame.h) * K('SEQUENCE_MAX_UNIT')
  const along = horizontal ? frame.w : frame.h
  const across = horizontal ? frame.h : frame.w
  const f0 = horizontal ? frame.x : frame.y
  const frameOf = (len: number): PageRect => {
    const start = f0 + (along - len) / 2
    return horizontal ? { x: start, y: frame.y, w: len, h: frame.h } : { x: frame.x, y: start, w: frame.w, h: len }
  }
  const at = (len: number) => {
    const got = figureAt(frameOf(len))
    if (!got) return null
    const fig = figureOf(t, got.chosen)
    const rest = t.rest.filter((g) => !fig.realised.includes(g))
    const span = figureSpan(fig.g, horizontal)
    const figLen = span ? span.hi - span.lo : len
    const m0 = sizeOf(fig.g, measure)
    // each run's lines end where its share of the room beside the figure ends (at the figure's measure)
    const total = Math.max(1, rest.length)
    const wrapOf = (gs: readonly number[]) => Math.max(1, ((along - figLen) * (gs.length / total)) / m0 - 0.5)
    const runs = runsOf(t, rest, fig.anchors, wrapOf)
    // the room beside the figure, in steps of the rest's size: the runs one after another, a half step before each
    const steps = runs.reduce((s, r) => s + lenOf(r.flow, horizontal) + 0.5, 0)
    const room = steps ? (along - figLen) / steps : Infinity
    const wide = Math.max(1, ...runs.map((r) => wideOf(r.flow, horizontal)))
    const want = Math.min(m0, across / wide)
    return { got, fig, runs, want, room, span }
  }
  let lo = along * 0.1
  let hi = along
  const whole = at(along)
  if (!whole) return null
  let best = whole
  if (whole.want > whole.room) {
    for (let i = 0; i < 24; i++) {
      const len = (lo + hi) / 2
      const x = at(len)
      if (!x) break
      if (x.want <= x.room) lo = len
      else hi = len
    }
    best = at(lo) ?? whole
  }
  const m = Math.max(0, Math.min(best.want, best.room))
  const span = best.span ?? { lo: f0 + along / 2, hi: f0 + along / 2 }
  const before = best.runs.filter((r) => r.side === 'before')
  const after = best.runs.filter((r) => r.side === 'after')
  const lenB = before.reduce((s, r) => s + (lenOf(r.flow, horizontal) + 0.5) * m, 0)
  const lenA = after.reduce((s, r) => s + (lenOf(r.flow, horizontal) + 0.5) * m, 0)
  // the figure and its words centred together on the writing axis
  const shift = f0 + (along - (lenB + (span.hi - span.lo) + lenA)) / 2 + lenB - span.lo
  const g = shiftGeometry(best.fig.g, horizontal ? shift : 0, horizontal ? 0 : shift)
  const anchors = new Map([...best.fig.anchors].map(([k, p]) => [k, horizontal ? { x: p.x + shift, y: p.y } : { x: p.x, y: p.y + shift }]))
  const flows: Placed[] = []
  const x0 = frame.x
  const x1 = frame.x + frame.w
  const y0 = frame.y
  const y1 = frame.y + frame.h
  const place = (r: Run, alongStart: number) => {
    const f = r.flow
    const a = r.anchor !== null ? anchors.get(r.anchor) : undefined
    // the point that meets the anchor's column (row): the first point after it, the last before it
    const meet = r.side === 'after' ? f.points[0] : f.points[f.points.length - 1]
    let ox: number
    let oy: number
    if (horizontal) {
      ox = alongStart - f.box.x0 * m
      oy = (a ? a.y : frame.y + frame.h / 2) - meet.y * m
      oy += Math.max(0, y0 - (oy + f.box.y0 * m)) - Math.max(0, oy + f.box.y1 * m - y1)
    } else {
      oy = alongStart - f.box.y0 * m
      ox = (a ? a.x : frame.x + frame.w / 2) - meet.x * m
      ox += Math.max(0, x0 - (ox + f.box.x0 * m)) - Math.max(0, ox + f.box.x1 * m - x1)
    }
    flows.push(placedOf(f, m, ox, oy))
  }
  // before the figure: the last run nearest it
  let cursor = span.lo + shift
  for (const r of [...before].reverse()) {
    cursor -= (lenOf(r.flow, horizontal) + 0.5) * m
    place(r, cursor)
  }
  cursor = span.hi + shift + 0.5 * m
  for (const r of after) {
    place(r, cursor)
    cursor += (lenOf(r.flow, horizontal) + 0.5) * m
  }
  const box = boxOf(g)
  return { g, candidates: best.got.candidates, realised: best.fig.realised, runs: best.runs, flows, area: box ? box.w * box.h : 0, way: 'in the line' }
}

/**
 * Beside: the figure is one item of the line, and the line goes on as writing goes on where a line is full —
 * the words before it on the line before (above; to the right in vertical writing), the words after it on the
 * next (below; to the left), each from the head of the page, as long as the page. The figure keeps the whole
 * length of the page and gives way across, just as far as those lines need at its measure. Only where the
 * figure's own characters stand together in the title (the rest is a head and a tail of it): a figure inside
 * the words' own order is not one item of their line.
 */
function beside(t: LineInput, frame: PageRect, figureAt: FigureAt): Arranged | null {
  const horizontal = t.language.direction !== 'vertical'
  const measure = Math.min(frame.w, frame.h) * K('SEQUENCE_MAX_UNIT')
  const along = horizontal ? frame.w : frame.h
  const across = horizontal ? frame.h : frame.w
  const c0 = horizontal ? frame.y : frame.x
  const frameOf = (w: number): PageRect => {
    const start = c0 + (across - w) / 2
    return horizontal ? { x: frame.x, y: start, w: frame.w, h: w } : { x: start, y: frame.y, w, h: frame.h }
  }
  const at = (w: number) => {
    const got = figureAt(frameOf(w))
    if (!got) return null
    const fig = figureOf(t, got.chosen)
    const rest = t.rest.filter((g) => !fig.realised.includes(g))
    const written = [...fig.anchors.keys()]
    if (!rest.length || !written.length) return null
    const lo = Math.min(...written)
    const hi = Math.max(...written)
    if (rest.some((g) => g > lo && g < hi)) return null
    const m0 = sizeOf(fig.g, measure)
    // the words before the figure and after it, each one line of writing (a space the title writes stays in it)
    const all = t.language.graphemes.map((x) => x.index)
    const trim = (gs: number[]) => {
      const w = (g: number) => !!t.language.graphemes[g].char.trim()
      while (gs.length && !w(gs[0])) gs.shift()
      while (gs.length && !w(gs[gs.length - 1])) gs.pop()
      return gs
    }
    const head = trim(all.filter((g) => g < lo && !written.includes(g)))
    const tail = trim(all.filter((g) => g > hi && !written.includes(g)))
    const runs: Run[] = [
      ...(head.length ? [{ graphemes: head, flow: flowOf(head, t.constraints, t.language, along / m0), side: 'before' as const, anchor: lo }] : []),
      ...(tail.length ? [{ graphemes: tail, flow: flowOf(tail, t.constraints, t.language, along / m0), side: 'after' as const, anchor: hi }] : []),
    ].filter((r) => r.flow.points.length)
    // a line longer than the page even so is written smaller (the last resort)
    const m = Math.min(m0, ...runs.map((r) => along / lenOf(r.flow, horizontal)))
    const box = boxOf(fig.g)
    if (!box) return null
    const figWide = horizontal ? box.h : box.w
    const need = runs.reduce((s, r) => s + (wideOf(r.flow, horizontal) + 0.5) * m, 0)
    return { got, fig, runs, m, box, fits: figWide + need <= across + 1e-6, need }
  }
  let lo = across * 0.1
  let hi = across
  let best = at(across)
  if (!best) return null
  if (!best.fits) {
    for (let i = 0; i < 24; i++) {
      const w = (lo + hi) / 2
      const x = at(w)
      if (!x) return null
      if (x.fits) lo = w
      else hi = w
    }
    best = at(lo)
    if (!best) return null
  }
  const { box, runs, m } = best
  const before = runs.filter((r) => r.side === 'before')
  const after = runs.filter((r) => r.side === 'after')
  // across: the lines before, the figure, the lines after, together in the middle of the frame. The line before
  // is above in horizontal writing and to the right in vertical: the across axis runs the other way there
  const sign = horizontal ? 1 : -1
  const wideB = before.reduce((s, r) => s + (wideOf(r.flow, horizontal) + 0.5) * m, 0)
  const wideA = after.reduce((s, r) => s + (wideOf(r.flow, horizontal) + 0.5) * m, 0)
  const figWide = horizontal ? box.h : box.w
  const total = wideB + figWide + wideA
  // where the figure's near edge (toward the lines before) goes
  const figNear = horizontal ? c0 + (across - total) / 2 + wideB : c0 + across - (across - total) / 2 - wideB
  const d = figNear - (horizontal ? box.y : box.x + box.w)
  const g = shiftGeometry(best.fig.g, horizontal ? 0 : d, horizontal ? d : 0)
  const flows: Placed[] = []
  const head = horizontal ? frame.x : frame.y
  const gb = boxOf(g)!
  // a flow's across coordinate grows toward the next line (down; to the left in vertical writing, −x)
  const place = (f: Flow, nearEdge: number, side: 'before' | 'after') => {
    // along: from the head of the frame
    const oAlong = head - (horizontal ? f.box.x0 : f.box.y0) * m
    // across: the lines before end at `nearEdge`, the lines after begin there
    const oAcross = horizontal ? nearEdge - (side === 'after' ? f.box.y0 : f.box.y1) * m : nearEdge - (side === 'after' ? f.box.x1 : f.box.x0) * m
    flows.push(horizontal ? placedOf(f, m, oAlong, oAcross) : placedOf(f, m, oAcross, oAlong))
  }
  let edge = (horizontal ? gb.y : gb.x + gb.w) - sign * 0.5 * m
  for (const r of [...before].reverse()) {
    place(r.flow, edge, 'before')
    edge -= sign * (wideOf(r.flow, horizontal) + 0.5) * m
  }
  edge = (horizontal ? gb.y + gb.h : gb.x) + sign * 0.5 * m
  for (const r of after) {
    place(r.flow, edge, 'after')
    edge += sign * (wideOf(r.flow, horizontal) + 0.5) * m
  }
  return { g, candidates: best.got.candidates, realised: best.fig.realised, runs, flows, area: gb.w * gb.h, way: 'beside' }
}

type FigureAt = (f: PageRect) => { chosen: FieldGeometry; candidates: FieldGeometry[] } | null

/**
 * The size the rest is written at: the figure's unit — the measure of one of its places (a character unit's
 * own size; for a stroke unit, the lattice cell a unit stands in) — at most SEQUENCE_MAX_UNIT. Not the whole
 * where the units are strokes (Stage 9): that tied the words to the figure's largest character, so that a long
 * title could only be written with its figure no larger than two or three of its words' characters.
 */
function sizeOf(g: FieldGeometry, measure: number) {
  return Math.min(g.unitSize, measure)
}

/**
 * The figure and the rest of its title on the page. `figureAt` is the chosen figure in a frame. The rest goes
 * in the line (before and after the figure along the writing) or beside it (the lines before and after); of
 * the two, the one that leaves the figure larger, in the line when they are equal.
 */
export function withTheTitle(t: LineInput, frame: PageRect, figureAt: FigureAt) {
  const line = inTheLine(t, frame, figureAt)
  if (!line) return null
  const side = beside(t, frame, figureAt)
  const best = side && side.area > line.area * 1.0001 ? side : line
  const seq = t.constraints.find((c) => c.kind === 'sequence')
  const same = t.constraints.find((c) => c.kind === 'same-scale')
  const causes = [...best.g.causes]
  const satisfies = [...best.g.satisfies]
  const m = best.flows.length ? best.flows[0].size : 0
  causes.push({ property: 'extent', value: { rest: t.rest, way: best.way }, because: seq ? { kind: 'constraint', id: seq.id } : { kind: 'const', name: 'SEQUENCE_MAX_UNIT' } })
  if (best.way === 'beside') causes.push({ property: 'extent', value: { beside: best.flows.length }, because: { kind: 'const', name: 'FRAME_MARGIN' } })
  causes.push({ property: 'unitSize', value: { rest: r1(m) }, because: same ? { kind: 'constraint', id: same.id } : { kind: 'const', name: 'SEQUENCE_MAX_UNIT' } })
  for (const r of best.runs)
    for (const b of r.flow.behaviours) {
      if (b.kind === 'line') continue
      const because: CauseRef = b.because === 'page' ? { kind: 'const', name: 'FRAME_MARGIN' } : { kind: 'constraint', id: b.because }
      causes.push({ property: b.kind === 'curve' ? 'orientation' : 'whitespace', value: { [b.kind]: b.at }, because })
      if (b.because !== 'page' && !satisfies.includes(b.because)) satisfies.push(b.because)
    }
  // a unit that writes the title's character is caused by what made it a unit
  const maker = t.constraints.find((c) => ['major', 'repeated', 'container', 'inside', 'intersection'].includes(c.kind))
  if (best.realised.length && maker) causes.push({ property: 'titleUnit', value: best.realised, because: { kind: 'constraint', id: maker.id } })
  const g = { ...best.g, causes, satisfies, detail: { ...best.g.detail, ...(best.flows.length ? { flows: best.flows } : {}) } as FieldDetail }
  return { geometry: g, candidates: best.candidates, realised: best.realised }
}
