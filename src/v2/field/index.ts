/**
 * FieldGeometry (spec-1 §8): how much of the page the chosen plan uses and how it breathes. Every
 * property has a cause (a constraint, a piece of evidence, a named constant, the auxiliary axes, or
 * — on the fallback page only — the fact that nothing was found). The minimum carrier is the rule:
 * a count, an extent or a size larger than the relation needs must have a cause, or it is recorded
 * as unmotivated and loses (§8.3).
 *
 *   rule            extent                        count                             whitespace
 *   (a field's pitch is its unit's own ink plus the UNIT_SPACING gap, along each axis)
 *   FieldSingleton  the base's frame in the       the smallest grid in the hidden    the delta's side band
 *   FieldInterleave derived character, mapped     band (> IMMEDIATE, ≤ √(IMM × HID)),
 *                   to the page frame             the delta reaching TAU
 *   RegionSplit     the derived character's       a band of the derived character and
 *                   frame                         the smallest field, ≤ IMMEDIATE
 *   NestedRegions   the page (extent: page)       a one-unit ring of the container on   the closed white between
 *                                                 its closed sides, the smallest ≥ 3×3  container and contained
 *   CrossRoads      the core's frame              5 × 5, two units each side of a road  the wrapper's zone
 *   Separation      each part, a character at    one per part (2 × 3 is a candidate)   the seam (SEAM_COEF ×
 *                   SEQUENCE_MAX_UNIT, in order                                         (1 + severance, aux))
 *   GlyphItself     none: the character itself    one
 *   WholeEmerges    the field of units            n × groups, groups = n × 2^(evidence);
 *                                                 the units' own lattice in the whole
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
import type { Cause, CauseRef, FieldDetail, FieldGeometry, FieldGrid, FieldProperty, GeometrySelection, PageRect, Visibility } from '../types/field'
import type { PlanCandidate } from '../types/plan'

const PAGE = 1000
const K = (n: keyof typeof CONSTANTS) => CONSTANTS[n].value
const M = K('FRAME_MARGIN')
export const FRAME: PageRect = { x: M, y: M, w: PAGE - 2 * M, h: PAGE - 2 * M }
const r1 = (v: number) => Math.round(v * 10) / 10
const r3 = (v: number) => Math.round(v * 1000) / 1000

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

/** the grid step for a field of cols × rows in a rect, units apart by UNIT_SPACING (square cells: rings, crossings) */
function fit(rect: PageRect, cols: number, rows: number): { u: number; step: number; box: PageRect } {
  const step = Math.min(rect.w / cols, rect.h / rows)
  const w = step * cols
  const h = step * rows
  return { u: step / K('UNIT_SPACING'), step, box: { x: rect.x + (rect.w - w) / 2, y: rect.y + (rect.h - h) / 2, w, h } }
}

/**
 * The pitch of a field of one unit, in units, along each axis: the unit's own ink extent plus the gap
 * UNIT_SPACING leaves (UNIT_SPACING − 1 of a unit). The field's texture is the unit's own proportion: a
 * wide unit gives a wide pitch, a flat one close rows (Stage 9: fields of every unit had read alike).
 */
export function pitchOf(e: AlignEntry | null): { x: number; y: number } {
  const gap = K('UNIT_SPACING') - 1
  const half = e?.whole?.half
  if (!half) return { x: K('UNIT_SPACING'), y: K('UNIT_SPACING') }
  return { x: r3((2 * half.w) / 100 + gap), y: r3((2 * half.h) / 100 + gap) }
}
/** a grid of cols × rows at a pitch (units), columns in groups of n with a gap (units) between groups, fitted and centred in a rect */
function gridFit(rect: PageRect, cols: number, rows: number, pitch: { x: number; y: number }, groups?: { n: number; gap: number }) {
  const gaps = groups && groups.n > 1 ? (Math.ceil(cols / groups.n) - 1) * groups.gap : 0
  const u = Math.min(rect.w / (cols * pitch.x + gaps), rect.h / (rows * pitch.y))
  const w = u * (cols * pitch.x + gaps)
  const h = u * rows * pitch.y
  const box: PageRect = { x: rect.x + (rect.w - w) / 2, y: rect.y + (rect.h - h) / 2, w, h }
  const grid: FieldGrid = { x0: r1(box.x), y0: r1(box.y), sx: r3(u * pitch.x), sy: r3(u * pitch.y), n: groups && groups.n > 1 ? groups.n : 1, gap: groups && groups.n > 1 ? r3(u * groups.gap) : 0 }
  return { u, box, grid, at: (row: number, col: number) => cellAt(grid, row, col) }
}

/** the centre of a cell of a grid (Layout reads the same function) */
export function cellAt(g: FieldGrid, row: number, col: number): { x: number; y: number } {
  return { x: g.x0 + (col + 0.5) * g.sx + Math.floor(col / g.n) * g.gap, y: g.y0 + (row + 0.5) * g.sy }
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

/**
 * Grids with the extent's proportions at a pitch, from three rows up (a field reads as one from three), each
 * with its unit size. Columns are rounded up to a multiple (pairs are not cut at the edge).
 */
function grids(rect: PageRect, pitch: { x: number; y: number }, multiple = 1, groups?: { n: number; gap: number }, max = 40) {
  const a = rect.w / pitch.x / (rect.h / pitch.y)
  const out: { cols: number; rows: number; u: number }[] = []
  for (let rows = 3; rows <= max; rows++) {
    let cols = Math.max(3, Math.round(rows * a))
    cols = Math.ceil(cols / multiple) * multiple
    out.push({ cols, rows, u: gridFit(rect, cols, rows, pitch, groups).u })
  }
  return out
}

/** the title's grapheme a character of the relation is, when the relation lies between the title's characters */
function graphemeOf(p: Discovery | null, language: LanguageAnalysis, char: string): number | null {
  if (!p || p.level !== 'inter-character') return null
  const g = p.graphemes.find((i) => language.graphemes[i]?.char === char)
  return g ?? null
}

/** the first cell of a grid in reading order (vertical: right to left, top to bottom) not in `taken` */
function firstCell(cols: number, rows: number, vertical: boolean, taken: (r: number, c: number) => boolean): { row: number; col: number } | null {
  if (vertical) {
    for (let c = cols - 1; c >= 0; c--) for (let r = 0; r < rows; r++) if (!taken(r, c)) return { row: r, col: c }
  } else for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (!taken(r, c)) return { row: r, col: c }
  return null
}

function fieldSingleton(input: FieldInput, frame: PageRect, interleave: boolean): FieldGeometry | null {
  const d = differenceOf(input.primary, input.align)
  if (!d) return null
  const b = new Build(input.constraints)
  const map = mapper(input.align.entry(d.derived), frame)
  const extent = map.rect(d.baseBox)
  const pitch = pitchOf(input.align.entry(d.base))
  const reachEm = d.delta.box ? Math.max(d.delta.box.w, d.delta.box.h) / 100 : 0.1
  // the delta on the page: the derived character is written at the unit (interleaved, in a unit's place) or
  // so that its base part is a unit (a singleton: the whole at unit / base scale)
  const reachOf = (u: number) => reachEm * (interleave ? u : u / d.baseScale)
  const target = input.constraints.find((c) => c.kind === 'visibility')
  const hiddenMid = Math.floor(Math.sqrt(K('IMMEDIATE') * K('HIDDEN')))
  const rhythm = input.constraints.find((c) => c.kind === 'rhythm')
  const multiple = rhythm?.kind === 'rhythm' && rhythm.op !== '⿱' && rhythm.op !== '⿳' ? rhythm.n : 1
  const groups = multiple > 1 ? { n: multiple, gap: K('GROUP_GAP') } : undefined
  const wantHidden = target?.kind === 'visibility' && target.target === 'hidden'
  // §8.2: the target band bounds the count; the delta reaching TAU is kept whatever the band. When no grid of
  // the band keeps it, the field is the largest that does (fewer units, larger), and the target is not met
  const all = grids(extent, pitch, multiple, groups)
  const seen = all.filter((x) => reachOf(x.u) >= K('TAU'))
  const g = seen.find((x) => (wantHidden ? x.cols * x.rows > K('IMMEDIATE') && x.cols * x.rows <= hiddenMid : x.cols * x.rows >= 9))
    ?? [...seen].reverse().find((x) => x.cols * x.rows <= hiddenMid)
    ?? all[0]
  const { cols, rows } = g
  const { u, box, grid, at } = gridFit(extent, cols, rows, pitch, groups)
  // where the derived character stands: at the edge of the field on the delta's side, in the row (column) of the delta's centroid
  const side = input.constraints.find((c) => c.kind === 'boundary-side')
  const dc = map.pt(d.delta.centroid.x, d.delta.centroid.y)
  const rowOf = (y: number) => Math.min(rows - 1, Math.max(0, Math.floor((y - box.y) / grid.sy)))
  const colOf = (x: number) => {
    let best = 0
    for (let c = 1; c < cols; c++) if (Math.abs(at(0, c).x - x) < Math.abs(at(0, best).x - x)) best = c
    return best
  }
  const s = side?.kind === 'boundary-side' ? side.side : null
  const row = s === 'top' ? 0 : s === 'bottom' ? rows - 1 : rowOf(dc.y)
  const col = s === 'left' ? 0 : s === 'right' ? cols - 1 : colOf(dc.x)
  const reach = reachOf(u)
  const count = cols * rows
  const visibility = visibilityOf(count, reach)
  b.set('extent', extent, b.c('major'), b.c('boundary-side') ?? b.c('interleave'))
  b.set('count', count, b.c('visibility'), b.const('IMMEDIATE'), b.const('HIDDEN'), b.const('TAU'))
  b.set('cols', cols, b.c('major'))
  b.set('rows', rows, b.c('major'))
  b.set('unitSize', r1(u), b.const('UNIT_SPACING'), b.c('same-scale'))
  b.set('pitch', pitch, b.c('major'), b.const('UNIT_SPACING'))
  b.set('orientation', 'rows', b.c('major'))
  b.set('visibility', visibility, b.c('visibility'))
  if (groups) b.set('groups', { n: multiple, op: '⿰', gapUnits: K('GROUP_GAP') }, b.c('rhythm'), b.const('GROUP_GAP'))
  if (s) b.white(band(frame, extent, s), b.c('boundary-side'))
  b.keep('major', 'difference', 'same-scale', 'no-emphasis')
  if (s) b.keep('boundary-side')
  if (groups) b.keep('rhythm')
  if (target?.kind === 'visibility' && target.target === visibility) b.keep('visibility')
  let detail: FieldDetail = { unit: d.base, grid }
  let singleton: FieldGeometry['singleton']
  let takes: (r: number, c: number) => boolean
  if (interleave) {
    const inter = input.constraints.find((c) => c.kind === 'interleave')
    const n = inter?.kind === 'interleave' ? inter.count : 1
    const xs = d.delta.pieces.length === n ? d.delta.pieces.map((p) => map.pt(p.x, p.y).x) : Array.from({ length: n }, (_, i) => box.x + ((i + 1) / (n + 1)) * box.w)
    const colsAt = [...new Set(xs.map(colOf))].sort((a, b2) => a - b2)
    const r = rowOf(dc.y)
    detail = { ...detail, interleave: { item: d.derived, row: r, cols: colsAt } }
    b.set('singleton', { item: d.derived, row: r, cols: colsAt }, b.c('interleave'), b.c('difference'))
    b.keep('interleave')
    takes = (rr, cc) => rr === r && colsAt.includes(cc)
  } else {
    // the derived character written so that its base part lies where a base unit would (align: base-part)
    const scale = 1 / d.baseScale
    const cell = at(row, col)
    const bc = { x: d.baseBox.x + d.baseBox.w / 2, y: d.baseBox.y + d.baseBox.h / 2 }
    const size = u * scale
    const point = { x: r1(cell.x - (bc.x / 100) * size), y: r1(cell.y - (bc.y / 100) * size) }
    singleton = { item: d.derived, cell: { row, col }, point, scale: r1(scale * 1000) / 1000, align: 'base-part' }
    b.set('singleton', singleton, b.c('difference'), b.c('boundary-side'))
    detail = { ...detail, span: { item: d.derived, row, col, rows: 1, cols: 1, role: 'singleton' } }
    takes = (rr, cc) => rr === row && cc === col
  }
  // the base is itself one of the title's characters (a relation between them): one unit writes it, the first
  // in reading order; the others repeat it
  const gi = graphemeOf(input.primary, input.language, d.base)
  if (gi !== null) {
    const cell = firstCell(cols, rows, input.language.direction === 'vertical', takes)
    if (cell) {
      detail = { ...detail, titleUnit: { grapheme: gi, ...cell } }
      b.set('titleUnit', cell, b.c('major'))
    }
  }
  return b.done({ name: interleave ? 'interleaved field' : 'field with a singleton', extent: box, count, cols, rows, unitSize: r1(u), orientation: 'rows', ...(groups ? { groups: { n: multiple, op: '⿰', gapUnits: K('GROUP_GAP') } } : {}), ...(singleton ? { singleton } : {}), visibility, detail })
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
  const pitch = pitchOf(input.align.entry(d.base))
  // the smallest field that reads as one (3 along the band), the band as long as the field
  const n = 3
  const a = baseRect.w / pitch.x / (baseRect.h / pitch.y)
  const cols = along ? Math.max(3, Math.round(n * a)) : n
  const rows = along ? n : Math.max(3, Math.round(n / a))
  const f = gridFit(baseRect, cols, rows, pitch)
  const count = cols * rows + n
  b.set('extent', map.frame, b.c('zone'))
  b.set('count', count, b.c('visibility'), b.const('IMMEDIATE'))
  b.set('unitSize', r1(f.u), b.const('UNIT_SPACING'), b.c('same-scale'))
  b.set('pitch', pitch, b.c('major'), b.const('UNIT_SPACING'))
  b.set('orientation', along ? 'rows' : 'columns', b.c('boundary-side'))
  const visibility = visibilityOf(count, K('TAU'))
  b.set('visibility', visibility, b.c('visibility'))
  b.keep('major', 'zone', 'same-scale', 'boundary-side', 'no-emphasis')
  const t = input.constraints.find((c) => c.kind === 'visibility')
  if (t?.kind === 'visibility' && t.target === visibility) b.keep('visibility')
  // the band: the derived character once per row (column) of the field, on the delta's side
  const points = Array.from({ length: n }, (_, i) => {
    const c = f.at(along ? i : 0, along ? 0 : i)
    return along ? { x: r1(bandRect.x + bandRect.w / 2), y: r1(c.y) } : { x: r1(c.x), y: r1(bandRect.y + bandRect.h / 2) }
  })
  return b.done({
    name: 'band and field', extent: map.frame, count, cols, rows, unitSize: r1(f.u), orientation: along ? 'rows' : 'columns', visibility,
    inner: [f.box, bandRect],
    detail: { unit: d.base, grid: f.grid, band: { item: d.derived, rect: bandRect, count: n }, points },
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
    // the interface: the contained field's face toward the container, on the side opposite the opening (⿴: the
    // top, where reading begins). The whole takes the contained unit there, across the closed white from the
    // container; it is not set apart on the white (Stage 9: a whole alone on the white read as a label)
    const s = ins.op === '⿶' ? 'bottom' : ins.op === '⿷' ? 'left' : 'top'
    const mid = Math.floor(inner / 2)
    const cell = s === 'top' ? { row: 0, col: mid } : s === 'bottom' ? { row: inner - 1, col: mid } : { row: mid, col: 0 }
    const size = u * K('INTERFACE_SCALE')
    interfaceAt = { item: face.term, x: r1(innerRect.x + (cell.col + 0.5) * step), y: r1(innerRect.y + (cell.row + 0.5) * step), size: r1(size), cell }
    b.set('scale', { interface: K('INTERFACE_SCALE') }, b.c('interface'), b.const('INTERFACE_SCALE'))
    b.set('singleton', { item: face.term, cell }, b.c('interface'), b.c('inside'))
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
  const { u, box, grid } = gridFit(core, n, n, { x: K('UNIT_SPACING'), y: K('UNIT_SPACING') })
  const step = grid.sx
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
    detail: { unit: x.term, grid, empty, span: { item: wholeChar, row: arm, col: arm, rows: 1, cols: 1, role: 'interface' } },
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
  const horizontalSeam = sep.axis === 'horizontal'
  const n = regions.parts.length
  // the parts' order along the axis: where each stands in the whole (align-1), else the structure's order
  const at = regions.parts.map((p, i) => {
    const row = e?.rows.find((r) => r.depth === 1 && r.index === i && r.node.kind === 'leaf' && r.node.char === p)
    return row?.box ? (horizontalSeam ? row.box.y + row.box.h / 2 : row.box.x + row.box.w / 2) : i * 1000
  })
  const order = regions.parts.map((_, i) => i).sort((a, c) => at[a] - at[c] || a - c)
  // the seam: SEAM_COEF of the page's frame (× 1 + severance, auxiliary)
  const sev = input.meaning ? Math.max(0, Math.min(1, input.meaning.axes.severance)) : 0
  const seam = K('SEAM_COEF') * (1 + sev) * (horizontalSeam ? FRAME.h : FRAME.w)
  // each part written as a character in its own right (the unsqueezed form, §9.1), all at one measure: the
  // measure of a character written as itself (SEQUENCE_MAX_UNIT). Stage 9: parts at their size in the whole,
  // at the frame's scale, read as an exploded diagram of the glyph; apart, they are isolated components
  const along = horizontalSeam ? frame.h : frame.w
  const cross = horizontalSeam ? frame.w : frame.h
  const m = Math.min(K('SEQUENCE_MAX_UNIT') * Math.min(FRAME.w, FRAME.h), (along - seam * (n - 1)) / n, cross)
  const total = m * n + seam * (n - 1)
  let pos = (horizontalSeam ? frame.y : frame.x) + (along - total) / 2
  const c = horizontalSeam ? frame.x + frame.w / 2 : frame.y + frame.h / 2
  const placed: { item: string; rect: PageRect; count: number }[] = []
  const seams: PageRect[] = []
  order.forEach((i, j) => {
    const rect: PageRect = horizontalSeam ? { x: c - m / 2, y: pos, w: m, h: m } : { x: pos, y: c - m / 2, w: m, h: m }
    placed[i] = { item: regions.parts[i], rect, count: perPart }
    pos += m
    if (j < n - 1) {
      seams.push(horizontalSeam ? { x: c - m / 2, y: pos, w: m, h: seam } : { x: pos, y: c - m / 2, w: seam, h: m })
      pos += seam
    }
  })
  const extent: PageRect = horizontalSeam ? { x: c - m / 2, y: placed[order[0]].rect.y, w: m, h: total } : { x: placed[order[0]].rect.x, y: c - m / 2, w: total, h: m }
  b.set('extent', extent, b.c('regions'))
  b.set('count', perPart * n, perPart === 1 ? b.c('regions') : null)
  b.set('orientation', horizontalSeam ? 'rows' : 'columns', b.c('axis'))
  b.set('unitSize', r1(m), b.c('regions'), b.const('SEQUENCE_MAX_UNIT'))
  for (const s of seams) b.white(s, b.c('separation'))
  if (sev > 0 && input.meaning) b.causes.push({ property: 'whitespace', value: { seam: r1(seam) }, because: { kind: 'aux', table: 'axes-1', axis: 'severance' } })
  b.causes.push({ property: 'whitespace', value: { seam: r1(seam) }, because: b.const('SEAM_COEF') })
  b.keep('regions', 'axis', 'separation')
  return b.done({ name: perPart === 1 ? 'parts apart' : 'fields of parts apart', extent, count: perPart * n, unitSize: r1(m), orientation: horizontalSeam ? 'rows' : 'columns', detail: { parts: placed } })
}

// ------------------------------------------------------------------ the whole emerging among its units

function wholeEmerges(input: FieldInput, frame: PageRect): FieldGeometry | null {
  const p = input.primary
  if (p?.type !== 'internal_repetition') return null
  const b = new Build(input.constraints)
  const count = input.constraints.find((c) => c.kind === 'count')
  // §8.2: groups = n × 2^(part-referent L0, MULTITUDE L1); §9.1: the total is groups × n, the whole's own n among
  // them (Stage 9 corrects Stage 8, which read the groups as 2 × 2^k: the same for n = 2, fewer for n > 2)
  const ev = count?.because.evidence ?? []
  const kEv = (ev.some((x) => x.startsWith('res:part-referent')) ? 1 : 0) + (ev.some((x) => x.startsWith('res:schema')) ? 1 : 0)
  const groups = p.n * 2 ** kEv
  const total = p.n * groups
  const others = total - p.n
  // work in the whole's em: the field's lattice is the units' own arrangement inside the whole, a pitch along
  // each axis (§9.1: a unit keeps its place in the character), so the whole, drawn at its size, stands with its
  // units on the field's points. Along an axis the units do not step, the pitch is their nearest distance; a
  // pitch is never less than a unit's own ink (a character unit is its glyph at nn / UNIT_SPACING)
  const nn = p.groupGeometry.nn > 0 ? p.groupGeometry.nn : 45
  const e = input.align.entry(p.whole.char)
  const half = e?.whole?.half ?? { w: 45, h: 45 }
  const offs = p.groupGeometry.offsets
  const stroke = p.unitTier === 'stroke'
  const alike = e?.ink?.alike.find((a2) => a2.members.length === p.n)
  const islands = stroke && alike && e?.ink ? alike.members.map((i) => e.ink!.islands[i]) : []
  const uEm = nn / K('UNIT_SPACING')
  const unitHalf = islands.length
    ? islands.reduce((m, isl) => ({
      x: Math.max(m.x, ...isl.keep.map((r) => Math.max(Math.abs(r.x - isl.centroid.x), Math.abs(r.x + r.w - isl.centroid.x)))),
      y: Math.max(m.y, ...isl.keep.map((r) => Math.max(Math.abs(r.y - isl.centroid.y), Math.abs(r.y + r.h - isl.centroid.y)))),
    }), { x: 0, y: 0 })
    : (() => {
      const uh = input.align.entry(p.unit.char)?.whole?.half ?? { w: 45, h: 45 }
      return { x: (uh.w / 100) * uEm, y: (uh.h / 100) * uEm }
    })()
  const gapEm = stroke ? 0 : (K('UNIT_SPACING') - 1) * uEm
  const stepOf = (axis: 'x' | 'y') => {
    const ds = offs.flatMap((o, i) => offs.slice(i + 1).map((q) => Math.abs(o[axis] - q[axis]))).filter((v) => v > nn / 4)
    return Math.max(ds.length ? Math.min(...ds) : nn, 2 * unitHalf[axis] + gapEm)
  }
  const pitch = { x: stepOf('x'), y: stepOf('y') }
  const phase = { x: offs.length ? offs[0].x - Math.floor(offs[0].x / pitch.x) * pitch.x : 0, y: offs.length ? offs[0].y - Math.floor(offs[0].y / pitch.y) * pitch.y : 0 }
  const box = { x0: -half.w, x1: half.w, y0: -half.h, y1: half.h }
  // the whole closes where its remainder stands in it: the field lies away from that side (TODO-1: else round it)
  const remainder = input.constraints.find((c) => c.kind === 'remainder-site')
  const remRow = remainder?.kind === 'remainder-site' ? e?.rows.find((r) => r.depth === 1 && r.node.kind === 'leaf' && r.node.char === remainder.remainder) : undefined
  const centre = remRow?.box ? { x: -(remRow.box.x + remRow.box.w / 2), y: -(remRow.box.y + remRow.box.h / 2) } : { x: 0, y: 0 }
  // §9.1 the road is left open: no unit whose ink box touches the whole's ink box; the others take the lattice
  // points nearest the field's centre (in pitches, so that a close axis is not preferred)
  const pts: { x: number; y: number; d: number }[] = []
  const R = Math.ceil(Math.max(box.x1 / pitch.x, box.y1 / pitch.y) + Math.sqrt(total) + 2)
  for (let j = -R; j <= R; j++)
    for (let i = -R; i <= R; i++) {
      const x = i * pitch.x + phase.x
      const y = j * pitch.y + phase.y
      if (x + unitHalf.x > box.x0 && x - unitHalf.x < box.x1 && y + unitHalf.y > box.y0 && y - unitHalf.y < box.y1) continue
      pts.push({ x, y, d: Math.hypot((x - centre.x) / pitch.x, (y - centre.y) / pitch.y) })
    }
  pts.sort((a2, b2) => a2.d - b2.d || a2.y - b2.y || a2.x - b2.x)
  const chosen = pts.slice(0, others)
  // the whole and its units, fitted to the frame
  const xs = [box.x0, box.x1, ...chosen.map((q) => q.x - unitHalf.x), ...chosen.map((q) => q.x + unitHalf.x)]
  const ys = [box.y0, box.y1, ...chosen.map((q) => q.y - unitHalf.y), ...chosen.map((q) => q.y + unitHalf.y)]
  const span = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }
  const k = Math.min(frame.w / (span.x1 - span.x0), frame.h / (span.y1 - span.y0))
  const ox = frame.x + (frame.w - (span.x1 - span.x0) * k) / 2 - span.x0 * k
  const oy = frame.y + (frame.h - (span.y1 - span.y0) * k) / 2 - span.y0 * k
  const u = uEm * k
  const W = 100 * k
  const extent: PageRect = { x: ox + span.x0 * k, y: oy + span.y0 * k, w: (span.x1 - span.x0) * k, h: (span.y1 - span.y0) * k }
  const points = chosen.map((q) => ({ x: r1(ox + q.x * k), y: r1(oy + q.y * k) }))
  b.set('extent', extent, b.c('whole-emerges'), b.c('count'))
  b.set('count', total, b.c('count'), b.c('repeated'), ...ev.map((x): CauseRef => ({ kind: 'evidence', id: x as never })))
  b.set('unitSize', r1(u), b.const('UNIT_SPACING'), b.c('same-scale'))
  b.set('orientation', 'blocks', b.c('count'))
  b.set('pitch', { x: r3(pitch.x / nn), y: r3(pitch.y / nn) }, b.c('repeated'))
  b.set('singleton', { item: p.whole.char, point: { x: r1(ox), y: r1(oy) }, size: r1(W) }, b.c('whole-emerges'), remainder ? b.c('remainder-site') : null)
  b.set('scale', { whole: r1(W / u) }, b.c('whole-emerges'), b.c('same-scale'))
  b.keep('repeated', 'count', 'same-scale', 'whole-emerges', 'remainder-site')
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

/**
 * The period of a reduplication on the line (ころころ: ころ | ころ): the shortest run of its members that repeats,
 * or null. Only a repetition in immediate succession has one; an echo, a mirror or a voicing does not.
 */
function periodOf(input: FieldInput, c: Constraint): number[] {
  if (c.kind !== 'recurrence' || c.unit !== 'token') return []
  const ms = [...c.members].sort((a, b) => a - b)
  const ch = ms.map((g) => input.language.graphemes[g]?.char)
  for (let p = 1; p <= ms.length / 2; p++) {
    if (ms.length % p) continue
    if (ch.every((x, i) => x === ch[i % p])) return ms.filter((_, i) => i > 0 && i % p === 0)
  }
  return []
}

function lineOf(input: FieldInput, frame: PageRect, graphemes: readonly number[], role: 'word' | 'context'): FieldDetail['line'] {
  const splits = input.constraints.filter((c) => c.kind === 'split').map((c) => (c.kind === 'split' ? c.at : -1))
  // a reduplication parts at each return of its unit, as a split parts the line (the same half unit)
  const returns = input.constraints.flatMap((c) => periodOf(input, c))
  const axis = input.language.direction === 'vertical' ? 'vertical' : 'horizontal'
  const breaks = graphemes.filter((g) => (splits.includes(g) || returns.includes(g)) && g !== graphemes[0])
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
  // a break is caused by the split or the reduplication it stands for; a recurrence the line does not show is not kept
  const splitAt = new Set(input.constraints.flatMap((c) => (c.kind === 'split' ? [c.at] : [])))
  const shown = input.constraints.filter((c) => c.kind === 'recurrence' && periodOf(input, c).some((g) => line.breaks.includes(g)))
  if (line.breaks.some((g) => splitAt.has(g))) b.causes.push({ property: 'whitespace', value: { breaks: line.breaks.filter((g) => splitAt.has(g)) }, because: b.c('split')! })
  for (const c of shown) b.causes.push({ property: 'whitespace', value: { breaks: periodOf(input, c) }, because: { kind: 'constraint', id: c.id } })
  b.keep('sequence', 'split')
  for (const c of shown) if (!b.satisfies.includes(c.id)) b.satisfies.push(c.id)
  return b.done({ name: 'the words in a line', extent: line.rect, count: s.graphemes.length, unitSize: line.size, orientation: line.axis === 'horizontal' ? 'rows' : 'columns', detail: { line } })
}

function absent(input: FieldInput): FieldGeometry {
  const b = new Build(input.constraints)
  const gs = input.language.graphemes.filter((g) => g.char.trim()).map((g) => g.index)
  const why: CauseRef = { kind: 'fallback', reason: 'no relation was found: the title once, small, away from the centre (§10, TODO-9)' }
  const axis = input.language.direction === 'vertical' ? 'vertical' : 'horizontal'
  // v1's pages that found nothing: the title took about 16% of the page, 0.85 of the way out from the centre
  const span = PAGE * K('FALLBACK_SPAN')
  // the title keeps the ink of a one-character title: its line's area is FALLBACK_SPAN² of the page, so a longer
  // title is written longer, not smaller (Stage 9: a long title had shrunk to a caption), within the frame
  const size = Math.min(span / Math.sqrt(Math.max(1, gs.length)), (axis === 'horizontal' ? FRAME.w : FRAME.h) / Math.max(1, gs.length))
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
 * the rest written once beside the figure, in reading order (TODO-10, Stage 10): the figure gives way
 * along the writing axis just as far as the rest needs at the figure's own measure (its unit, at most the
 * measure of a written character), so the title's characters on a page share one size; a half unit of
 * white parts the words from the figure, as a split parts a line.
 */
export function geometry(input: FieldInput): GeometrySelection & { geometry: FieldGeometry } {
  const pick = (cs: readonly FieldGeometry[]) => [...cs].sort((a, b) => a.unmotivated.length - b.unmotivated.length || b.satisfies.length - a.satisfies.length)[0]
  const first = byRule(input, FRAME)
  let candidates = first.length ? [...first, ...(['FieldSingleton', 'FieldInterleave', 'WholeEmerges', 'CrossRoads', 'NestedRegions'].includes(input.plan.rule) ? [fullDense(first[0])] : [])] : [absent(input)]
  let chosen = pick(candidates)
  if (!input.rest.length || chosen.name === 'nothing found') return { candidates, chosen: chosen.name, geometry: chosen }
  const primaryAt = input.primary?.graphemes[0] ?? 0
  const before = input.rest.filter((g) => g < primaryAt)
  const after = input.rest.filter((g) => g > primaryAt)
  const horizontal = input.language.direction !== 'vertical'
  const measure = Math.min(FRAME.w, FRAME.h) * K('SEQUENCE_MAX_UNIT')
  const along = horizontal ? FRAME.w : FRAME.h
  const f0 = horizontal ? FRAME.x : FRAME.y
  const lines = (before.length ? 1 : 0) + (after.length ? 1 : 0)
  // the size of a character the figure writes: its unit, or — where the units are strokes — the whole
  const sizeOf = (g: FieldGeometry) => Math.min(g.detail?.strokeUnit && g.singleton ? g.unitSize * g.singleton.scale : g.unitSize, measure)
  const frameOf = (len: number): PageRect => {
    const start = f0 + (along - len) / 2
    return horizontal ? { x: start, y: FRAME.y, w: len, h: FRAME.h } : { x: FRAME.x, y: start, w: FRAME.w, h: len }
  }
  // the longest figure whose rest still fits beside it at the figure's measure (that measure grows with the
  // figure, the room beside it shrinks): where they cross. A rest too long to fit even so is written at the room
  const perChar = (before.length + after.length) * K('UNIT_SPACING') + lines * 0.5
  const at = (len: number) => {
    const g = byRule(input, frameOf(len))
    if (!g.length) return null
    const c = pick(g)
    const room = (along - (figureLength(c, horizontal) ?? len)) / perChar
    return { g, c, want: sizeOf(c), room }
  }
  let lo = along * 0.1
  let hi = along
  for (let i = 0; i < 24; i++) {
    const len = (lo + hi) / 2
    const x = at(len)
    if (!x) break
    if (x.want <= x.room) lo = len
    else hi = len
  }
  const best = at(lo)
  let size = measure
  if (best) {
    candidates = [...best.g, ...candidates.filter((c) => c.name.includes('dense'))]
    chosen = best.c
    size = Math.max(0, Math.min(best.want, best.room))
  }
  const fig = figureSpan(chosen, horizontal) ?? { lo: f0 + along / 2, hi: f0 + along / 2 }
  // centre the figure and its words together on the writing axis
  const nB = before.length * size * K('UNIT_SPACING') + (before.length ? 0.5 * size : 0)
  const nA = after.length * size * K('UNIT_SPACING') + (after.length ? 0.5 * size : 0)
  const shift = f0 + (along - (nB + (fig.hi - fig.lo) + nA)) / 2 + nB - fig.lo
  chosen = shiftGeometry(chosen, horizontal ? shift : 0, horizontal ? 0 : shift)
  const lineAt = (gs: readonly number[], from: number): NonNullable<FieldDetail['line']> => {
    const len = gs.length * size * K('UNIT_SPACING')
    const rect: PageRect = horizontal ? { x: from, y: FRAME.y + (FRAME.h - size) / 2, w: len, h: size } : { x: FRAME.x + (FRAME.w - size) / 2, y: from, w: size, h: len }
    return { graphemes: gs, breaks: [], rect, size: r1(size), axis: horizontal ? 'horizontal' : 'vertical', role: 'context' }
  }
  const lo2 = fig.lo + shift
  const hi2 = fig.hi + shift
  const rest = [
    before.length ? lineAt(before, lo2 - 0.5 * size - before.length * size * K('UNIT_SPACING')) : null,
    after.length ? lineAt(after, hi2 + 0.5 * size) : null,
  ].filter((x): x is NonNullable<FieldDetail['line']> => !!x)
  const seq = input.constraints.find((c) => c.kind === 'sequence')
  const same = input.constraints.find((c) => c.kind === 'same-scale')
  chosen = {
    ...chosen,
    detail: { ...chosen.detail, ...(rest.length ? { rest } : {}) } as FieldDetail,
    causes: [
      ...chosen.causes,
      { property: 'extent', value: { rest: input.rest }, because: seq ? { kind: 'constraint', id: seq.id } : { kind: 'const', name: 'SEQUENCE_MAX_UNIT' } },
      { property: 'unitSize', value: { rest: r1(size) }, because: same ? { kind: 'constraint', id: same.id } : { kind: 'const', name: 'SEQUENCE_MAX_UNIT' } },
    ],
  }
  return { candidates, chosen: chosen.name, geometry: chosen }
}

/** the figure's span on the writing axis: its extent, or the character itself */
function figureSpan(g: FieldGeometry, horizontal: boolean): { lo: number; hi: number } | null {
  const r = g.extent ?? g.detail?.parts?.[0]?.rect ?? null
  if (!r) return null
  let lo = horizontal ? r.x : r.y
  let hi = horizontal ? r.x + r.w : r.y + r.h
  // a singleton reaches out of the field on the delta's side (淋's 氵): the figure is as long as its ink
  for (const w of g.whitespace) if (w.cause.kind === 'constraint' && w.cause.id.startsWith('c:boundary-side')) {
    const s = g.singleton
    if (s?.point) {
      const half = (g.unitSize * s.scale) / 2
      lo = Math.min(lo, (horizontal ? s.point.x : s.point.y) - half)
      hi = Math.max(hi, (horizontal ? s.point.x : s.point.y) + half)
    }
  }
  return { lo, hi }
}
function figureLength(g: FieldGeometry, horizontal: boolean): number | null {
  const s = figureSpan(g, horizontal)
  return s ? s.hi - s.lo : null
}

/** a geometry moved on the page (the figure and everything that stands with it) */
function shiftGeometry(g: FieldGeometry, dx: number, dy: number): FieldGeometry {
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
    },
  }
}
