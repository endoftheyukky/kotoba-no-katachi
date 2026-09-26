/**
 * FieldGeometry (spec-1 §8): how much of the page the chosen plan uses and how it breathes. Every
 * property has a cause (a constraint, a piece of evidence, a named constant, the auxiliary axes, or
 * — on the fallback page only — the fact that nothing was found). The minimum carrier is the rule:
 * a count, an extent or a size larger than the relation needs must have a cause, or it is recorded
 * as unmotivated and loses (§8.3).
 *
 *   rule            extent                        count                             whitespace
 *   FieldSingleton  the base's frame in the       the smallest grid in the hidden    the delta's side band
 *   FieldInterleave derived character, mapped     band (> IMMEDIATE, ≤ √(IMM × HID)),
 *                   to the page frame             the delta reaching TAU
 *   RegionSplit     the derived character's       a band of the derived character and
 *                   frame                         the smallest field, ≤ IMMEDIATE
 *   NestedRegions   the page (extent: page)       a one-unit ring of the container on   the closed white between
 *                                                 its closed sides, the smallest ≥ 3×3  container and contained
 *   CrossRoads      the core's frame              5 × 5, two units each side of a road  the wrapper's zone
 *   Separation      each part's frame             one per part (2 × 3 is a candidate)   the seam (SEAM_COEF ×
 *                                                                                      (1 + severance, aux))
 *   GlyphItself     none: the character itself    one
 *   WholeEmerges    the field of units            n × 2 × 2^(evidence) (the whole emerges
 *                                                 among at least one other group)
 *   Sequence        a line                        the title once
 *   Absent          none                          the title once, small, off the centre  the quiet of nothing found
 */
import type { LanguageAnalysis } from '../../language/analysis'
import type { Meaning } from '../../language/semantic/axes'
import type { AlignIndex } from '../align/lookup'
import type { AlignEntry } from '../align/table'
import { CONSTANTS } from '../spec'
import type { Constraint, ConstraintKind } from '../types/constraints'
import type { Discovery } from '../types/discovery'
import type { Cause, CauseRef, FieldDetail, FieldGeometry, FieldProperty, GeometrySelection, PageRect, Visibility } from '../types/field'
import type { PlanCandidate } from '../types/plan'

const PAGE = 1000
const K = (n: keyof typeof CONSTANTS) => CONSTANTS[n].value
const M = K('FRAME_MARGIN')
export const FRAME: PageRect = { x: M, y: M, w: PAGE - 2 * M, h: PAGE - 2 * M }
const r1 = (v: number) => Math.round(v * 10) / 10

export interface FieldInput {
  plan: PlanCandidate
  constraints: readonly Constraint[]
  primary: Discovery | null
  align: AlignIndex
  language: LanguageAnalysis
  /** the title's graphemes the plan does not realise (written beside it, reading order; TODO-10) */
  rest: readonly number[]
  /** axes-1, the whole title: auxiliary only (§5.4) */
  meaning?: Meaning | null
}

/** a geometry under construction: every property set through `set`, with its cause or as unmotivated */
class Build {
  causes: Cause[] = []
  whitespace: { region: PageRect; cause: CauseRef }[] = []
  satisfies: string[] = []
  unmotivated: string[] = []
  constructor(readonly constraints: readonly Constraint[]) {}
  c(kind: ConstraintKind): CauseRef | null {
    const x = this.constraints.find((y) => y.kind === kind)
    return x ? { kind: 'constraint', id: x.id } : null
  }
  set(property: FieldProperty, value: unknown, ...because: (CauseRef | null)[]) {
    const bs = because.filter((b): b is CauseRef => !!b)
    if (!bs.length) this.unmotivated.push(`${property}: ${JSON.stringify(value)}`)
    for (const b of bs) this.causes.push({ property, value, because: b })
  }
  white(region: PageRect, cause: CauseRef | null) {
    if (!cause) this.unmotivated.push('whitespace: no cause')
    else if (region.w > 0.5 && region.h > 0.5) this.whitespace.push({ region, cause })
  }
  keep(...kinds: ConstraintKind[]) {
    for (const k of kinds) for (const x of this.constraints) if (x.kind === k && !this.satisfies.includes(x.id)) this.satisfies.push(x.id)
  }
  const(name: keyof typeof CONSTANTS): CauseRef {
    return { kind: 'const', name }
  }
  done(g: Omit<FieldGeometry, 'causes' | 'whitespace' | 'satisfies' | 'unmotivated'>): FieldGeometry {
    return { ...g, whitespace: this.whitespace, causes: this.causes, satisfies: this.satisfies, unmotivated: this.unmotivated }
  }
}

/** the grid step for a field of cols × rows in a rect, units apart by UNIT_SPACING */
function fit(rect: PageRect, cols: number, rows: number): { u: number; step: number; box: PageRect } {
  const step = Math.min(rect.w / cols, rect.h / rows)
  const w = step * cols
  const h = step * rows
  return { u: step / K('UNIT_SPACING'), step, box: { x: rect.x + (rect.w - w) / 2, y: rect.y + (rect.h - h) / 2, w, h } }
}

/** the visibility band of a difference among `count` units reaching `reach` page units (§8.2, TODO-4) */
export function visibilityOf(count: number, reach: number): Visibility {
  if (reach < K('TAU')) return 'too-small'
  if (count <= K('IMMEDIATE')) return 'immediate'
  if (count <= K('HIDDEN')) return 'hidden'
  return 'too-many'
}

/** the whole character's em box mapped into a rect (uniform scale, centred) */
function mapper(e: AlignEntry | null, rect: PageRect) {
  const hw = e?.whole?.half.w ?? 50
  const hh = e?.whole?.half.h ?? 50
  const k = Math.min(rect.w / (2 * hw), rect.h / (2 * hh))
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  return {
    k,
    pt: (x: number, y: number) => ({ x: cx + x * k, y: cy + y * k }),
    rect: (r: { x: number; y: number; w: number; h: number }): PageRect => ({ x: cx + r.x * k, y: cy + r.y * k, w: r.w * k, h: r.h * k }),
    frame: { x: cx - hw * k, y: cy - hh * k, w: 2 * hw * k, h: 2 * hh * k } as PageRect,
  }
}

const inter = (a: PageRect, b: PageRect): PageRect => {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  return { x, y, w: Math.max(0, Math.min(a.x + a.w, b.x + b.w) - x), h: Math.max(0, Math.min(a.y + a.h, b.y + b.h) - y) }
}

/** the side band of `frame` outside `inner` on one side */
function band(frame: PageRect, inner: PageRect, side: string): PageRect {
  switch (side) {
    case 'left': return { x: frame.x, y: frame.y, w: inner.x - frame.x, h: frame.h }
    case 'right': return { x: inner.x + inner.w, y: frame.y, w: frame.x + frame.w - inner.x - inner.w, h: frame.h }
    case 'top': return { x: frame.x, y: frame.y, w: frame.w, h: inner.y - frame.y }
    default: return { x: frame.x, y: inner.y + inner.h, w: frame.w, h: frame.y + frame.h - inner.y - inner.h }
  }
}

// ------------------------------------------------------------------ the difference: base field with the derived character

interface Difference {
  derived: string
  base: string
  /** em, in the derived character (ink centre = origin) */
  baseBox: { x: number; y: number; w: number; h: number }
  baseScale: number
  delta: { centroid: { x: number; y: number }; box: { x: number; y: number; w: number; h: number } | null; pieces: readonly { x: number; y: number }[] }
}

function differenceOf(p: Discovery | null, align: AlignIndex): Difference | null {
  if (p?.type === 'addition') {
    const e = align.entry(p.derived.char)
    const row = e?.rows.find((r) => r.depth === 1 && r.node.kind === 'leaf' && r.node.char === p.base.char)
    if (!row?.box || !row.residual || !row.transform) return null
    return {
      derived: p.derived.char, base: p.base.char, baseBox: row.box, baseScale: Math.max(row.transform.sx, row.transform.sy),
      delta: { centroid: row.residual.centroid ?? { x: 0, y: 0 }, box: row.residual.box, pieces: row.residual.pieces.map((q) => q.centroid) },
    }
  }
  if (p?.type === 'inter_containment' || p?.type === 'inter_similarity') {
    const r = p.relation
    const e = align.entry(p.inner.char)
    const hw = (e?.whole?.half.w ?? 45) * r.scale
    const hh = (e?.whole?.half.h ?? 45) * r.scale
    const box = r.residue.box
    return {
      derived: p.outer.char, base: p.inner.char, baseBox: { x: r.dx - hw, y: r.dy - hh, w: 2 * hw, h: 2 * hh }, baseScale: r.scale,
      delta: { centroid: r.residue.centroid, box: box.w > 0 ? box : null, pieces: r.residue.pieces.map((q) => ({ x: q.x + q.w / 2, y: q.y + q.h / 2 })) },
    }
  }
  return null
}

/** the smallest grid with the extent's proportions whose count passes `ok` (rows from 3: a field reads as one) */
function smallestGrid(rect: PageRect, ok: (cols: number, rows: number, u: number) => boolean, multiple = 1, max = 40): { cols: number; rows: number } | null {
  const a = rect.w / rect.h
  for (let rows = 3; rows <= max; rows++) {
    let cols = Math.max(3, Math.round(rows * a))
    cols = Math.ceil(cols / multiple) * multiple
    const { u } = fit(rect, cols, rows)
    if (ok(cols, rows, u)) return { cols, rows }
  }
  return null
}

function fieldSingleton(input: FieldInput, frame: PageRect, interleave: boolean): FieldGeometry | null {
  const d = differenceOf(input.primary, input.align)
  if (!d) return null
  const b = new Build(input.constraints)
  const map = mapper(input.align.entry(d.derived), frame)
  const extent = map.rect(d.baseBox)
  const reachEm = d.delta.box ? Math.max(d.delta.box.w, d.delta.box.h) / 100 : 0.1
  const target = input.constraints.find((c) => c.kind === 'visibility')
  const hiddenMid = Math.floor(Math.sqrt(K('IMMEDIATE') * K('HIDDEN')))
  const rhythm = input.constraints.find((c) => c.kind === 'rhythm')
  const multiple = rhythm?.kind === 'rhythm' && rhythm.op !== '⿱' && rhythm.op !== '⿳' ? rhythm.n : 1
  const wantHidden = target?.kind === 'visibility' && target.target === 'hidden'
  const g = smallestGrid(extent, (c, r, u) => (wantHidden ? c * r > K('IMMEDIATE') && c * r <= hiddenMid : c * r >= 9) && reachEm * u / (1 / d.baseScale) >= K('TAU'), multiple)
    ?? smallestGrid(extent, (c, r) => c * r > K('IMMEDIATE'), multiple)!
  const { cols, rows } = g
  const { u, box } = fit(extent, cols, rows)
  // where the derived character stands: at the edge of the field on the delta's side, in the row (column) of the delta's centroid
  const side = input.constraints.find((c) => c.kind === 'boundary-side')
  const dc = map.pt(d.delta.centroid.x, d.delta.centroid.y)
  const rowOf = (y: number) => Math.min(rows - 1, Math.max(0, Math.floor(((y - box.y) / box.h) * rows)))
  const colOf = (x: number) => Math.min(cols - 1, Math.max(0, Math.floor(((x - box.x) / box.w) * cols)))
  const s = side?.kind === 'boundary-side' ? side.side : null
  const row = s === 'top' ? 0 : s === 'bottom' ? rows - 1 : rowOf(dc.y)
  const col = s === 'left' ? 0 : s === 'right' ? cols - 1 : colOf(dc.x)
  const reach = reachEm * u / (1 / d.baseScale)
  const count = cols * rows
  const visibility = visibilityOf(count, reach)
  b.set('extent', extent, b.c('major'), b.c('boundary-side') ?? b.c('interleave'))
  b.set('count', count, b.c('visibility'), b.const('IMMEDIATE'), b.const('HIDDEN'), b.const('TAU'))
  b.set('cols', cols, b.c('major'))
  b.set('rows', rows, b.c('major'))
  b.set('unitSize', r1(u), b.const('UNIT_SPACING'), b.c('same-scale'))
  b.set('orientation', 'rows', b.c('major'))
  b.set('visibility', visibility, b.c('visibility'))
  if (multiple > 1) b.set('groups', { n: multiple, op: '⿰', gapUnits: K('GROUP_GAP') }, b.c('rhythm'), b.const('GROUP_GAP'))
  if (s) b.white(band(frame, extent, s), b.c('boundary-side'))
  b.keep('major', 'difference', 'same-scale', 'no-emphasis')
  if (s) b.keep('boundary-side')
  if (multiple > 1) b.keep('rhythm')
  if (target?.kind === 'visibility' && target.target === visibility) b.keep('visibility')
  let detail: FieldDetail = { unit: d.base }
  let singleton: FieldGeometry['singleton']
  if (interleave) {
    const inter = input.constraints.find((c) => c.kind === 'interleave')
    const n = inter?.kind === 'interleave' ? inter.count : 1
    const xs = d.delta.pieces.length === n ? d.delta.pieces.map((p) => map.pt(p.x, p.y).x) : Array.from({ length: n }, (_, i) => box.x + ((i + 1) / (n + 1)) * box.w)
    const colsAt = xs.map((x) => Math.round(((x - box.x) / box.w) * cols * 2) / 2).sort((a, b2) => a - b2)
    detail = { ...detail, interleave: { item: d.derived, row: rowOf(dc.y), cols: colsAt } }
    b.set('singleton', { item: d.derived, row: rowOf(dc.y), cols: colsAt }, b.c('interleave'), b.c('difference'))
    b.keep('interleave')
  } else {
    // the derived character written so that its base part lies where a base unit would (align: base-part)
    const scale = 1 / d.baseScale
    const cell = { x: box.x + (col + 0.5) * (box.w / cols), y: box.y + (row + 0.5) * (box.h / rows) }
    const bc = { x: d.baseBox.x + d.baseBox.w / 2, y: d.baseBox.y + d.baseBox.h / 2 }
    const size = u * scale
    const point = { x: r1(cell.x - (bc.x / 100) * size), y: r1(cell.y - (bc.y / 100) * size) }
    singleton = { item: d.derived, cell: { row, col }, point, scale: r1(scale * 1000) / 1000, align: 'base-part' }
    b.set('singleton', singleton, b.c('difference'), b.c('boundary-side'))
    detail = { ...detail, span: { item: d.derived, row, col, rows: 1, cols: 1, role: 'singleton' } }
  }
  return b.done({ name: interleave ? 'interleaved field' : 'field with a singleton', extent: box, count, cols, rows, unitSize: r1(u), orientation: 'rows', ...(multiple > 1 ? { groups: { n: multiple, op: '⿰', gapUnits: K('GROUP_GAP') } } : {}), ...(singleton ? { singleton } : {}), visibility, detail })
}

// ------------------------------------------------------------------ a band of the derived character (zone)

function regionSplit(input: FieldInput, frame: PageRect): FieldGeometry | null {
  const d = differenceOf(input.primary, input.align)
  const side = input.constraints.find((c) => c.kind === 'boundary-side')
  if (!d || side?.kind !== 'boundary-side') return null
  const b = new Build(input.constraints)
  const map = mapper(input.align.entry(d.derived), frame)
  const baseRect = inter(map.rect(d.baseBox), map.frame)
  const bandRect = band(map.frame, baseRect, side.side)
  const along = side.side === 'left' || side.side === 'right'
  // the smallest field that reads as one (3 along the band), the band as long as the field
  const rows = 3
  const a = along ? baseRect.w / baseRect.h : baseRect.h / baseRect.w
  const cols = Math.max(3, Math.round(rows * a))
  const f = along ? fit(baseRect, cols, rows) : fit(baseRect, rows, cols)
  const count = cols * rows + rows
  b.set('extent', map.frame, b.c('zone'))
  b.set('count', count, b.c('visibility'), b.const('IMMEDIATE'))
  b.set('unitSize', r1(f.u), b.const('UNIT_SPACING'), b.c('same-scale'))
  b.set('orientation', along ? 'rows' : 'columns', b.c('boundary-side'))
  const visibility = visibilityOf(count, K('TAU'))
  b.set('visibility', visibility, b.c('visibility'))
  b.keep('major', 'zone', 'same-scale', 'boundary-side', 'no-emphasis')
  const t = input.constraints.find((c) => c.kind === 'visibility')
  if (t?.kind === 'visibility' && t.target === visibility) b.keep('visibility')
  return b.done({
    name: 'band and field', extent: map.frame, count, cols: along ? cols : rows, rows: along ? rows : cols, unitSize: r1(f.u), orientation: along ? 'rows' : 'columns', visibility,
    inner: [f.box, bandRect],
    detail: { unit: d.base, band: { item: d.derived, rect: bandRect, count: rows } },
  })
}

// ------------------------------------------------------------------ enclosure: the page holds

function nested(input: FieldInput, frame: PageRect, withInterface: boolean): FieldGeometry | null {
  const cont = input.constraints.find((c) => c.kind === 'container')
  const ins = input.constraints.find((c) => c.kind === 'inside')
  const face = input.constraints.find((c) => c.kind === 'interface')
  if (cont?.kind !== 'container' || ins?.kind !== 'inside') return null
  const b = new Build(input.constraints)
  const sides = ({ '⿴': ['top', 'left', 'right', 'bottom'], '⿵': ['top', 'left', 'right'], '⿶': ['bottom', 'left', 'right'], '⿷': ['top', 'left', 'bottom'] } as const)[ins.op]
  const has = (s: string) => (sides as readonly string[]).includes(s)
  // one unit of ring on each closed side, one unit of closed white, the smallest inner field (3 × 3)
  const inner = 3
  const cols = (has('left') ? 2 : 0) + inner + (has('right') ? 2 : 0)
  const rows = (has('top') ? 2 : 0) + inner + (has('bottom') ? 2 : 0)
  const { u, step, box } = fit(frame, cols, rows)
  const ix = box.x + (has('left') ? 2 : 0) * step
  const iy = box.y + (has('top') ? 2 : 0) * step
  const innerRect: PageRect = { x: ix, y: iy, w: inner * step, h: inner * step }
  const ringCount = (has('top') ? cols : 0) + (has('bottom') ? cols : 0) + (has('left') ? rows - (has('top') ? 1 : 0) - (has('bottom') ? 1 : 0) : 0) + (has('right') ? rows - (has('top') ? 1 : 0) - (has('bottom') ? 1 : 0) : 0)
  const count = ringCount + inner * inner
  b.set('extent', box, b.c('extent'), b.c('container'))
  b.set('inner', innerRect, b.c('inside'))
  b.set('count', count, b.c('container'), b.c('inside'))
  b.set('unitSize', r1(u), b.const('UNIT_SPACING'), b.c('same-scale'))
  b.set('orientation', 'blocks', b.c('inside'))
  // the closed white between container and contained
  const gap: PageRect = { x: box.x + (has('left') ? step : 0), y: box.y + (has('top') ? step : 0), w: box.w - (has('left') ? step : 0) - (has('right') ? step : 0), h: box.h - (has('top') ? step : 0) - (has('bottom') ? step : 0) }
  b.white(gap, b.c('inside'))
  b.keep('container', 'inside', 'same-scale', 'extent')
  let interfaceAt: FieldDetail['interfaceAt']
  if (withInterface && face?.kind === 'interface') {
    // on the white between them, at the middle of the side opposite the opening (⿴: the top, where reading begins)
    const s = ins.op === '⿶' ? 'bottom' : ins.op === '⿷' ? 'left' : 'top'
    const size = u * K('INTERFACE_SCALE')
    const x = s === 'left' ? box.x + 1.5 * step : innerRect.x + innerRect.w / 2
    const y = s === 'top' ? box.y + 1.5 * step : s === 'bottom' ? box.y + box.h - 1.5 * step : innerRect.y + innerRect.h / 2
    interfaceAt = { item: face.term, x: r1(x), y: r1(y), size: r1(size) }
    b.set('scale', { interface: K('INTERFACE_SCALE') }, b.c('interface'), b.const('INTERFACE_SCALE'))
    b.keep('interface')
  }
  return b.done({
    name: withInterface ? 'nested regions' : 'frame', extent: box, inner: [innerRect], count, cols, rows, unitSize: r1(u), orientation: 'blocks',
    detail: { unit: cont.term, ring: { item: cont.term, sides, inner: innerRect, innerCols: inner, innerRows: inner, innerItem: ins.term }, ...(interfaceAt ? { interfaceAt } : {}) },
  })
}

// ------------------------------------------------------------------ the character itself

function glyphItself(input: FieldInput, frame: PageRect): FieldGeometry | null {
  const face = input.constraints.find((c) => c.kind === 'interface')
  if (face?.kind !== 'interface') return null
  const b = new Build(input.constraints)
  const side = Math.min(frame.w, frame.h) * K('GLYPH_ITSELF_SCALE')
  const rect: PageRect = { x: frame.x + (frame.w - side) / 2, y: frame.y + (frame.h - side) / 2, w: side, h: side }
  b.set('count', 1, b.c('extent'))
  b.set('unitSize', r1(side), b.c('extent'), b.const('GLYPH_ITSELF_SCALE'))
  b.set('orientation', 'none', b.c('extent'))
  b.keep('container', 'inside', 'extent', 'wrapper-zone')
  return b.done({ name: 'the character itself', extent: null, count: 1, unitSize: r1(side), orientation: 'none', detail: { parts: [{ item: face.term, rect, count: 1 }] } })
}

// ------------------------------------------------------------------ crossing roads

function crossRoads(input: FieldInput, frame: PageRect): FieldGeometry | null {
  const x = input.constraints.find((c) => c.kind === 'intersection')
  if (x?.kind !== 'intersection') return null
  const b = new Build(input.constraints)
  const whole = input.constraints.find((c) => c.kind === 'interface')
  const wholeChar = whole?.kind === 'interface' ? whole.term : x.term
  const e = input.align.entry(wholeChar)
  const map = mapper(e, frame)
  const wrap = input.constraints.find((c) => c.kind === 'wrapper-zone')
  // the core's frame: where the core stands in the whole (a component), or the whole itself
  const coreRow = e?.rows.find((r) => r.depth === 1 && r.node.kind === 'leaf' && r.node.char === x.term)
  const core = coreRow?.box && wrap ? map.rect(coreRow.box) : map.frame
  const arm = 2
  const n = 2 * arm + 1
  const { u, step, box } = fit(core, n, n)
  const empty: { row: number; col: number }[] = []
  for (let i = 0; i < n; i++) {
    if (i !== arm) empty.push({ row: arm, col: i }, { row: i, col: arm })
  }
  b.set('extent', box, b.c('intersection'), wrap ? b.c('wrapper-zone') : null)
  b.set('count', n * n - empty.length, b.c('intersection'))
  b.set('cols', n, b.c('intersection'))
  b.set('rows', n, b.c('intersection'))
  b.set('unitSize', r1(u), b.const('UNIT_SPACING'), b.c('same-scale'))
  b.set('orientation', 'rows', b.c('intersection'))
  b.set('singleton', { item: wholeChar, cell: { row: arm, col: arm } }, b.c('interface'))
  if (wrap?.kind === 'wrapper-zone') {
    // the wrapper's zone: the page on the sides it wraps from, left empty
    const sidesOf = ({ '⿸': ['left', 'top'], '⿹': ['right', 'top'], '⿺': ['left', 'bottom'] } as const)[wrap.op]
    for (const s of sidesOf) b.white(band(frame, box, s), b.c('wrapper-zone'))
  }
  for (const r of [{ x: box.x, y: box.y + arm * step, w: box.w, h: step }, { x: box.x + arm * step, y: box.y, w: step, h: box.h }]) b.white(r, b.c('intersection'))
  b.keep('intersection', 'interface', 'same-scale', 'wrapper-zone', 'container')
  return b.done({
    name: 'crossing roads', extent: box, count: n * n - empty.length, cols: n, rows: n, unitSize: r1(u), orientation: 'rows',
    singleton: { item: wholeChar, cell: { row: arm, col: arm }, scale: 1 },
    detail: { unit: x.term, empty, span: { item: wholeChar, row: arm, col: arm, rows: 1, cols: 1, role: 'interface' } },
  })
}

// ------------------------------------------------------------------ separation of parts

function separation(input: FieldInput, frame: PageRect, perPart: number): FieldGeometry | null {
  const regions = input.constraints.find((c) => c.kind === 'regions')
  const sep = input.constraints.find((c) => c.kind === 'separation')
  if (regions?.kind !== 'regions' || sep?.kind !== 'separation' || input.primary?.type !== 'composition') return null
  const b = new Build(input.constraints)
  const whole = input.language.graphemes[input.primary.graphemes[0]].char
  const e = input.align.entry(whole)
  const map = mapper(e, frame)
  const horizontalSeam = sep.axis === 'horizontal'
  // each part's frame, from where it stands in the whole (align-1), else an even share
  const n = regions.parts.length
  const rects = regions.parts.map((p, i) => {
    const row = e?.rows.find((r) => r.depth === 1 && r.index === i && r.node.kind === 'leaf' && r.node.char === p)
    if (row?.box) return map.rect(row.box)
    const f = map.frame
    return horizontalSeam ? { x: f.x, y: f.y + (i * f.h) / n, w: f.w, h: f.h / n } : { x: f.x + (i * f.w) / n, y: f.y, w: f.w / n, h: f.h }
  })
  // the seam: SEAM_COEF of the frame (× 1 + severance, auxiliary), opened between the parts' frames
  const sev = input.meaning ? Math.max(0, Math.min(1, input.meaning.axes.severance)) : 0
  const seam = K('SEAM_COEF') * (1 + sev) * (horizontalSeam ? frame.h : frame.w)
  const along = (r: PageRect) => (horizontalSeam ? r.y + r.h / 2 : r.x + r.w / 2)
  const order = rects.map((r, i) => ({ r, i })).sort((a, c) => along(a.r) - along(c.r))
  const total = order.reduce((s, o) => s + (horizontalSeam ? o.r.h : o.r.w), 0) + seam * (n - 1)
  const avail = horizontalSeam ? frame.h : frame.w
  const k = Math.min(1, avail / total)
  let at = (horizontalSeam ? frame.y : frame.x) + (avail - total * k) / 2
  const placed: { item: string; rect: PageRect; count: number }[] = []
  const seams: PageRect[] = []
  order.forEach((o, j) => {
    const len = (horizontalSeam ? o.r.h : o.r.w) * k
    const rect: PageRect = horizontalSeam ? { x: frame.x, y: at, w: frame.w, h: len } : { x: at, y: frame.y, w: len, h: frame.h }
    placed[o.i] = { item: regions.parts[o.i], rect, count: perPart }
    at += len
    if (j < n - 1) {
      seams.push(horizontalSeam ? { x: frame.x, y: at, w: frame.w, h: seam * k } : { x: at, y: frame.y, w: seam * k, h: frame.h })
      at += seam * k
    }
  })
  b.set('extent', frame, b.c('regions'))
  b.set('count', perPart * n, perPart === 1 ? b.c('regions') : null)
  b.set('orientation', horizontalSeam ? 'rows' : 'columns', b.c('axis'))
  b.set('unitSize', r1(Math.min(...placed.map((p) => Math.min(p.rect.w, p.rect.h)))), b.c('regions'))
  for (const s of seams) b.white(s, b.c('separation'))
  if (sev > 0 && input.meaning) b.causes.push({ property: 'whitespace', value: { seam: r1(seam) }, because: { kind: 'aux', table: 'axes-1', axis: 'severance' } })
  b.causes.push({ property: 'whitespace', value: { seam: r1(seam) }, because: b.const('SEAM_COEF') })
  b.keep('regions', 'axis', 'separation')
  return b.done({ name: perPart === 1 ? 'parts apart' : 'fields of parts apart', extent: frame, count: perPart * n, unitSize: r1(Math.min(...placed.map((p) => Math.min(p.rect.w, p.rect.h)))), orientation: horizontalSeam ? 'rows' : 'columns', detail: { parts: placed } })
}

// ------------------------------------------------------------------ the whole emerging among its units

function wholeEmerges(input: FieldInput, frame: PageRect): FieldGeometry | null {
  const p = input.primary
  if (p?.type !== 'internal_repetition') return null
  const b = new Build(input.constraints)
  const count = input.constraints.find((c) => c.kind === 'count')
  // groups: at least two (the whole emerges among another group of its units), doubled by each piece of evidence
  const ev = count?.because.evidence ?? []
  const k = (ev.some((x) => x.startsWith('res:part-referent')) ? 1 : 0) + (ev.some((x) => x.startsWith('res:schema')) ? 1 : 0)
  const groups = 2 * 2 ** k
  const total = p.n * groups
  const others = total - p.n
  // work in pitches: the field's pitch is the units' own pitch inside the whole (its nearest-neighbour
  // distance), so the whole, drawn at its size, stands with its units on the field's points
  const nn = p.groupGeometry.nn > 0 ? p.groupGeometry.nn : 45
  const e = input.align.entry(p.whole.char)
  const half = e?.whole?.half ?? { w: 45, h: 45 }
  const offs = p.groupGeometry.offsets
  const lattice = { x: offs.length ? offs[0].x / nn - Math.floor(offs[0].x / nn) : 0, y: offs.length ? offs[0].y / nn - Math.floor(offs[0].y / nn) : 0 }
  const box = { x0: -half.w / nn, x1: half.w / nn, y0: -half.h / nn, y1: half.h / nn }
  // the whole closes where its remainder stands in it: the field lies away from that side (TODO-1: else round it)
  const remainder = input.constraints.find((c) => c.kind === 'remainder-site')
  const remRow = remainder?.kind === 'remainder-site' ? e?.rows.find((r) => r.depth === 1 && r.node.kind === 'leaf' && r.node.char === remainder.remainder) : undefined
  const rem = remRow?.box ? { x: (remRow.box.x + remRow.box.w / 2) / nn, y: (remRow.box.y + remRow.box.h / 2) / nn } : { x: 0, y: 0 }
  const centre = { x: -rem.x, y: -rem.y }
  // the points of the lattice round the whole, clear of its ink box (the road is left open), nearest the field's centre first
  const clear = 0.5 / K('UNIT_SPACING')
  const pts: { x: number; y: number; d: number }[] = []
  const R = Math.ceil(Math.max(box.x1, box.y1) + Math.sqrt(total) + 2)
  for (let j = -R; j <= R; j++)
    for (let i = -R; i <= R; i++) {
      const x = i + lattice.x
      const y = j + lattice.y
      if (x + clear > box.x0 && x - clear < box.x1 && y + clear > box.y0 && y - clear < box.y1) continue
      pts.push({ x, y, d: Math.hypot(x - centre.x, y - centre.y) })
    }
  pts.sort((a2, b2) => a2.d - b2.d || a2.y - b2.y || a2.x - b2.x)
  const chosen = pts.slice(0, others)
  // the whole and its units, fitted to the frame
  const xs = [box.x0, box.x1, ...chosen.map((q) => q.x - clear), ...chosen.map((q) => q.x + clear)]
  const ys = [box.y0, box.y1, ...chosen.map((q) => q.y - clear), ...chosen.map((q) => q.y + clear)]
  const span = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }
  const step = Math.min(frame.w / (span.x1 - span.x0), frame.h / (span.y1 - span.y0))
  const ox = frame.x + (frame.w - (span.x1 - span.x0) * step) / 2 - span.x0 * step
  const oy = frame.y + (frame.h - (span.y1 - span.y0) * step) / 2 - span.y0 * step
  const u = step / K('UNIT_SPACING')
  const W = (step * 100) / nn
  const extent: PageRect = { x: ox + span.x0 * step, y: oy + span.y0 * step, w: (span.x1 - span.x0) * step, h: (span.y1 - span.y0) * step }
  const points = chosen.map((q) => ({ x: r1(ox + q.x * step), y: r1(oy + q.y * step) }))
  b.set('extent', extent, b.c('whole-emerges'), b.c('count'))
  b.set('count', total, b.c('count'), b.c('repeated'), ...ev.map((x): CauseRef => ({ kind: 'evidence', id: x as never })))
  b.set('unitSize', r1(u), b.const('UNIT_SPACING'), b.c('same-scale'))
  b.set('orientation', 'blocks', b.c('count'))
  b.set('singleton', { item: p.whole.char, point: { x: r1(ox), y: r1(oy) }, size: r1(W) }, b.c('whole-emerges'), remainder ? b.c('remainder-site') : null)
  b.set('scale', { whole: r1(W / u) }, b.c('whole-emerges'), b.c('same-scale'))
  b.keep('repeated', 'count', 'same-scale', 'whole-emerges', 'remainder-site')
  const stroke = p.unitTier === 'stroke'
  const alike = e?.ink?.alike.find((a2) => a2.members.length === p.n)
  return b.done({
    name: 'the whole emerging among its units', extent, count: others + 1, unitSize: r1(u), orientation: 'blocks',
    singleton: { item: p.whole.char, point: { x: r1(ox), y: r1(oy) }, scale: r1((W / u) * 1000) / 1000 },
    detail: {
      unit: p.unit.char,
      ...(stroke && alike ? { strokeUnit: { whole: p.whole.char, islands: alike.members } } : {}),
      points,
      span: { item: p.whole.char, row: 0, col: 0, rows: 1, cols: 1, role: 'whole' },
    },
  })
}

// ------------------------------------------------------------------ the words in a line; nothing found

function lineOf(input: FieldInput, frame: PageRect, graphemes: readonly number[], role: 'word' | 'context'): FieldDetail['line'] {
  const splits = input.constraints.filter((c) => c.kind === 'split').map((c) => (c.kind === 'split' ? c.at : -1))
  const axis = input.language.direction === 'vertical' ? 'vertical' : 'horizontal'
  const breaks = graphemes.filter((g) => splits.includes(g) && g !== graphemes[0])
  const units = graphemes.length + breaks.length * 0.5
  const along = axis === 'horizontal' ? frame.w : frame.h
  const size = Math.min(along / units, Math.min(frame.w, frame.h) * K('SEQUENCE_MAX_UNIT'))
  const len = size * units
  const rect: PageRect = axis === 'horizontal' ? { x: frame.x + (frame.w - len) / 2, y: frame.y + (frame.h - size) / 2, w: len, h: size } : { x: frame.x + (frame.w - size) / 2, y: frame.y + (frame.h - len) / 2, w: size, h: len }
  return { graphemes, breaks, rect, size: r1(size), axis, role }
}

function sequence(input: FieldInput, frame: PageRect): FieldGeometry | null {
  const s = input.constraints.find((c) => c.kind === 'sequence')
  if (s?.kind !== 'sequence') return null
  const b = new Build(input.constraints)
  const line = lineOf(input, frame, s.graphemes, 'word')!
  b.set('extent', line.rect, b.c('sequence'))
  b.set('count', s.graphemes.length, b.c('sequence'))
  b.set('unitSize', line.size, b.c('sequence'), b.const('SEQUENCE_MAX_UNIT'))
  b.set('orientation', line.axis === 'horizontal' ? 'rows' : 'columns', b.c('sequence'))
  if (line.breaks.length) b.causes.push({ property: 'whitespace', value: { breaks: line.breaks }, because: b.c('split')! })
  b.keep('sequence', 'split', 'recurrence')
  return b.done({ name: 'the words in a line', extent: line.rect, count: s.graphemes.length, unitSize: line.size, orientation: line.axis === 'horizontal' ? 'rows' : 'columns', detail: { line } })
}

function absent(input: FieldInput): FieldGeometry {
  const b = new Build(input.constraints)
  const gs = input.language.graphemes.filter((g) => g.char.trim()).map((g) => g.index)
  const why: CauseRef = { kind: 'fallback', reason: 'no relation was found: the title once, small, away from the centre (§10, TODO-9)' }
  const axis = input.language.direction === 'vertical' ? 'vertical' : 'horizontal'
  // v1's pages that found nothing: the title took about 16% of the page, 0.85 of the way out from the centre
  const span = PAGE * K('FALLBACK_SPAN')
  const size = Math.min(span / Math.max(1, gs.length), span)
  const len = size * gs.length
  const corner = axis === 'horizontal' ? { x: FRAME.x + FRAME.w, y: FRAME.y + FRAME.h } : { x: FRAME.x, y: FRAME.y + FRAME.h }
  const c = { x: PAGE / 2 + (corner.x - PAGE / 2) * K('FALLBACK_OFFSET'), y: PAGE / 2 + (corner.y - PAGE / 2) * K('FALLBACK_OFFSET') }
  const w = axis === 'horizontal' ? len : size
  const h = axis === 'horizontal' ? size : len
  const rect: PageRect = { x: Math.min(Math.max(c.x - w / 2, FRAME.x), FRAME.x + FRAME.w - w), y: Math.min(Math.max(c.y - h / 2, FRAME.y), FRAME.y + FRAME.h - h), w, h }
  b.set('count', gs.length, why)
  b.set('unitSize', r1(size), why)
  b.set('orientation', 'none', why)
  b.white({ x: 0, y: 0, w: PAGE, h: PAGE }, why)
  return b.done({ name: 'nothing found', extent: null, count: gs.length, unitSize: r1(size), orientation: 'none', detail: { line: { graphemes: gs, breaks: [], rect, size: r1(size), axis, role: 'word' } } })
}

/** the comparison candidate of §8.3: the whole frame, dense — kept to be seen losing */
function fullDense(g: FieldGeometry): FieldGeometry {
  const n = Math.ceil(Math.sqrt(K('HIDDEN')))
  const { u, box } = fit(FRAME, n, n)
  return {
    ...g, name: `${g.name}, the whole frame dense`, extent: box, count: n * n, cols: n, rows: n, unitSize: r1(u), whitespace: [],
    unmotivated: [...g.unmotivated, 'extent: the whole frame (no cause)', `count: ${n * n} (no cause)`], satisfies: g.satisfies.filter((s) => !s.startsWith('c:visibility')),
  }
}

// ------------------------------------------------------------------ the choice

function byRule(input: FieldInput, frame: PageRect): FieldGeometry[] {
  switch (input.plan.rule) {
    case 'FieldSingleton': return [fieldSingleton(input, frame, false)].filter((x): x is FieldGeometry => !!x)
    case 'FieldInterleave': return [fieldSingleton(input, frame, true)].filter((x): x is FieldGeometry => !!x)
    case 'RegionSplit': return [regionSplit(input, frame)].filter((x): x is FieldGeometry => !!x)
    case 'NestedRegions': return [nested(input, frame, true)].filter((x): x is FieldGeometry => !!x)
    case 'Frame': return [nested(input, frame, false)].filter((x): x is FieldGeometry => !!x)
    case 'GlyphItself': return [glyphItself(input, frame)].filter((x): x is FieldGeometry => !!x)
    case 'CrossRoads': return [crossRoads(input, frame)].filter((x): x is FieldGeometry => !!x)
    case 'Separation': return [separation(input, frame, 1), separation(input, frame, 6)].filter((x): x is FieldGeometry => !!x)
    case 'WholeEmerges': return [wholeEmerges(input, frame)].filter((x): x is FieldGeometry => !!x)
    case 'Sequence': return [sequence(input, frame)].filter((x): x is FieldGeometry => !!x)
    default: return []
  }
}

/**
 * The geometry of the chosen plan (§8.3): every candidate kept; the chosen has the fewest unmotivated
 * properties, then keeps the most constraints. A title with more graphemes than its plan realises has
 * the rest written once beside the figure, in reading order, at the figure's unit size (same scale):
 * the figure's frame gives way along the writing axis (TODO-10, Stage 10).
 */
export function geometry(input: FieldInput): GeometrySelection & { geometry: FieldGeometry } {
  let frame = FRAME
  const first = byRule(input, frame)
  let candidates = first.length ? [...first, ...(['FieldSingleton', 'FieldInterleave', 'WholeEmerges', 'CrossRoads', 'NestedRegions'].includes(input.plan.rule) ? [fullDense(first[0])] : [])] : [absent(input)]
  let chosen = [...candidates].sort((a, b) => a.unmotivated.length - b.unmotivated.length || b.satisfies.length - a.satisfies.length)[0]
  if (input.rest.length && chosen.name !== 'nothing found') {
    const primaryAt = input.primary?.graphemes[0] ?? 0
    const before = input.rest.filter((g) => g < primaryAt)
    const after = input.rest.filter((g) => g > primaryAt)
    const horizontal = input.language.direction !== 'vertical'
    const unit = Math.min(chosen.unitSize, Math.min(FRAME.w, FRAME.h) * K('SEQUENCE_MAX_UNIT'))
    const need = (before.length + after.length) * unit * K('UNIT_SPACING')
    const along = horizontal ? FRAME.w : FRAME.h
    const figure = Math.max(along * 0.4, along - need)
    const pre = before.length / Math.max(1, before.length + after.length)
    const start = (along - figure) * pre
    frame = horizontal ? { x: FRAME.x + start, y: FRAME.y, w: figure, h: FRAME.h } : { x: FRAME.x, y: FRAME.y + start, w: FRAME.w, h: figure }
    const again = byRule(input, frame)
    if (again.length) {
      candidates = [...again, ...candidates.filter((c) => c.name.includes('dense'))]
      chosen = [...again].sort((a, b) => a.unmotivated.length - b.unmotivated.length || b.satisfies.length - a.satisfies.length)[0]
    }
    const size = Math.min(chosen.unitSize, unit)
    const lineAt = (gs: readonly number[], lo: number, hi: number): FieldDetail['line'] => {
      const len = gs.length * size * K('UNIT_SPACING')
      const mid = (lo + hi) / 2
      const rect: PageRect = horizontal ? { x: mid - len / 2, y: FRAME.y + (FRAME.h - size) / 2, w: len, h: size } : { x: FRAME.x + (FRAME.w - size) / 2, y: mid - len / 2, w: size, h: len }
      return { graphemes: gs, breaks: [], rect, size: r1(size), axis: horizontal ? 'horizontal' : 'vertical', role: 'context' }
    }
    const f0 = horizontal ? FRAME.x : FRAME.y
    const lines = [before.length ? lineAt(before, f0, f0 + start) : null, after.length ? lineAt(after, f0 + start + figure, f0 + along) : null].filter((x): x is NonNullable<FieldDetail['line']> => !!x)
    chosen = {
      ...chosen,
      detail: { ...chosen.detail, ...(lines.length ? { rest: lines } : {}) } as FieldDetail,
      causes: [...chosen.causes, { property: 'extent', value: { rest: input.rest }, because: input.constraints.find((c) => c.kind === 'sequence') ? { kind: 'constraint', id: input.constraints.find((c) => c.kind === 'sequence')!.id } : { kind: 'const', name: 'UNIT_SPACING' } }],
    }
  }
  return { candidates, chosen: chosen.name, geometry: chosen }
}

