/**
 * Discovery candidates inside one character of the title (spec-1 §3). Every
 * candidate comes from the structure (structure-1); ink (align-1) is attached
 * as an observation and never decides whether a relation exists. Candidates
 * are not dropped here: whether one may be the primary is Selection's (§4.1).
 *
 *   linguistic input   the character's normalised IDS tree and its components' own structures
 *   rule (one per type)
 *     internal_repetition  a subtree (or the whole, or the whole less one leaf) made of one unit
 *                          repeated, read at the leaves first (雨: 丶×4, not two pairs)
 *     addition             the root's children: exactly one character, the rest the difference
 *     composition          the root splits (⿰⿱⿲⿳) into leaves
 *     enclosure            the root is ⿴⿵⿶⿷ of two leaves; partial_enclosure: ⿸⿹⿺
 *     intersection         a ⿻ of two strokes: the character's own, or a component's (辻 → 十)
 *     nested               a component that is a character with a repetition or crossing of its own
 *   output             typed Discoveries with their terms, evidence and basis; no coordinate of the page
 */
import { compose, IDENTITY, type Transform } from '../align/compose'
import { CONSTANTS } from '../spec'
import type { AlignEntry, AlignRow } from '../align/table'
import type { StructureLookup } from '../structure/lookup'
import type { StructureEntry } from '../structure/table'
import { homogeneous, idsOf, type Homogeneous } from '../structure/view'
import type { Addition, AdditionSide, Composition, Discovery, DiscoveryId, Enclosure, InternalRepetition, Intersection, Nested, PartialEnclosure, RepetitionArrangement, Role, Term } from '../types/discovery'
import type { EmPoint } from '../types/observation'
import type { Evidence } from '../types/provenance'
import type { IdsNode, IdsOperator, Tier } from '../types/structure'
import type { Rect } from '../../render/stage'
import { inkEvidence, placementEvidence, structureEvidence } from './evidence'
import type { DiscoveryInput } from './input'

const r2 = (v: number) => Math.round(v * 100) / 100
const r3 = (v: number) => Math.round(v * 1000) / 1000

const FULL = new Set<IdsOperator>(['⿴', '⿵', '⿶', '⿷'])
const PARTIAL = new Set<IdsOperator>(['⿸', '⿹', '⿺'])
const SPLIT = new Set<IdsOperator>(['⿰', '⿱', '⿲', '⿳'])

/** the nodes of a tree with their paths ('' the root), pre-order */
function walk(tree: IdsNode): { path: string; node: IdsNode }[] {
  const out: { path: string; node: IdsNode }[] = []
  const go = (n: IdsNode, p: string) => {
    out.push({ path: p, node: n })
    if (n.kind === 'op') n.children.forEach((c, i) => go(c, p === '' ? String(i) : `${p}.${i}`))
  }
  go(tree, '')
  return out
}

const child = (path: string, i: number) => (path === '' ? String(i) : `${path}.${i}`)
const center = (r: Rect): EmPoint => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })

/** the form a character has in the table's stroke list (a stroke tier for a named delta) */
function tierOfNamed(char: string, strokes: readonly string[]): Tier {
  const cp = char.codePointAt(0)!
  if (strokes.includes(char) || (cp >= 0x31c0 && cp <= 0x31ef)) return 'stroke'
  return 'unknown'
}

interface Context {
  g: number
  char: string
  entry: StructureEntry
  tree: IdsNode
  align: AlignEntry | null
  input: DiscoveryInput
  lookup: (c: string) => StructureLookup
}

const rowAt = (cx: Context, path: string): AlignRow | undefined => cx.align?.rows.find((r) => r.path === path)

/** a term: a leaf as itself, a subtree as its IDS; with its box only where the placement is aligned */
function term<R extends Role>(cx: Context, node: IdsNode, role: R, path: string): Term<R> {
  const row = rowAt(cx, path)
  const t: Term<R> = node.kind === 'leaf' ? { char: node.char, role, tier: node.tier } : { char: idsOf(node), role, tier: 'component' }
  return row?.status === 'aligned' && row.box ? { ...t, box: row.box } : t
}

function placed(cx: Context, paths: readonly string[]): Evidence[] {
  return paths.flatMap((p) => {
    const row = rowAt(cx, p)
    return row ? [placementEvidence(cx.char, row)] : []
  })
}

// ------------------------------------------------------------------ repetition

/**
 * how the units stand (§3): four joined by ⿰ and ⿱, a 2 × 2; three or more joined by one operator
 * only (⿲ ⿳, or ⿰ ⿱ again and again), a line (row, stack); otherwise the operator that joins them
 * at the top (森 = 木 over 林: ⿱)
 */
function arrangementOf(h: Homogeneous): RepetitionArrangement | null {
  const ops = new Set(h.ops)
  if (h.n === 4 && ops.has('⿰') && ops.has('⿱') && ops.size === 2) return '2x2'
  if (h.n >= 3 && [...ops].every((o) => o === '⿰' || o === '⿲')) return 'row'
  if (h.n >= 3 && [...ops].every((o) => o === '⿱' || o === '⿳')) return 'stack'
  const first = h.ops[0]
  if (first === '⿰' || first === '⿱') return first
  return null
}

/** the half size of a unit drawn alone, from any placement of it the table holds */
function unitHalf(unit: string, seen: readonly AlignEntry[]): { w: number; h: number } | null {
  for (const e of seen) for (const r of e.rows) if (r.glyph && r.glyph.char === unit) return r.glyph.half
  return null
}

/**
 * Where each unit of a repetition stands in the whole. From the whole's own ink when it shows the
 * units as n alike islands; else from the placements (carried through a character seen through:
 * 森's 木 inside 林), whatever their status; the source is said in the evidence.
 */
function unitBoxes(cx: Context, path: string, node: IdsNode, h: Homogeneous): { boxes: Rect[]; source: 'ink' | 'placement' | 'none'; statuses: string[]; seen: AlignEntry[] } {
  const seen: AlignEntry[] = cx.align ? [cx.align] : []
  const ink = cx.align?.ink
  const statuses: string[] = []
  // placements, carried through characters
  const boxes: Rect[] = []
  const collect = (n: IdsNode, p: string, entry: AlignEntry | null, t: Transform, depth: number) => {
    if (depth > 4) return
    if (n.kind === 'op') {
      n.children.forEach((c, i) => collect(c, child(p, i), entry, t, depth))
      return
    }
    const row = entry?.rows.find((r) => r.path === p)
    if (n.char === h.unit || h.through.length === 0) {
      if (row?.box) {
        boxes.push({ x: row.box.x * t.sx + t.dx, y: row.box.y * t.sy + t.dy, w: row.box.w * t.sx, h: row.box.h * t.sy })
        statuses.push(row.status)
      }
      return
    }
    // a character seen through: its own entry's placements, carried by this one's
    const inner = cx.input.align.entry(n.char)
    const tree = cx.lookup(n.char)
    if (!row?.transform || !inner || tree.status !== 'found') return
    seen.push(inner)
    collect(tree.structure.tree, '', inner, compose(t, row.transform), depth + 1)
  }
  collect(node, path, cx.align, IDENTITY, 0)
  // the ink's own islands, when they show exactly n alike ones
  if (ink) {
    const groups = ink.alike.filter((a) => a.members.length === h.n)
    // the group lying in the repeated subtree's region, if the table knows it
    const region = path === '' ? null : rowAt(cx, path)?.box ?? null
    const inside = (m: readonly number[]) => !region || m.every((i) => { const c = ink.islands[i].centroid; return c.x >= region.x - 4 && c.x <= region.x + region.w + 4 && c.y >= region.y - 4 && c.y <= region.y + region.h + 4 })
    const g = groups.find((a) => inside(a.members))
    if (g) return { boxes: g.members.map((i) => ink.islands[i].keep[0]), source: 'ink', statuses, seen }
  }
  if (boxes.length === h.n) return { boxes, source: 'placement', statuses, seen }
  return { boxes: [], source: 'none', statuses, seen }
}

function groupGeometry(boxes: readonly Rect[], n: number, unitTier: 'character' | 'stroke', half: { w: number; h: number } | null): InternalRepetition['groupGeometry'] {
  if (boxes.length !== n) return { gapRatio: 0, nn: 0, across: 0, compression: 1, offsets: Array.from({ length: n }, () => ({ x: 0, y: 0 })) }
  const cs = boxes.map(center)
  let nn = 0
  let gap = 0
  for (let i = 0; i < n; i++) {
    let j = -1
    let d = Infinity
    for (let k = 0; k < n; k++) if (k !== i) { const dd = Math.hypot(cs[k].x - cs[i].x, cs[k].y - cs[i].y); if (dd < d) { d = dd; j = k } }
    nn += d
    const a = boxes[i]
    const b = boxes[j]
    const horizontal = Math.abs(cs[j].x - cs[i].x) >= Math.abs(cs[j].y - cs[i].y)
    const white = horizontal ? Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w) : Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h)
    gap += Math.max(0, white) / Math.max(1e-6, horizontal ? a.w : a.h)
  }
  const hs = boxes.map((b) => b.h).sort((x, y) => x - y)
  const tol = 0.5 * hs[hs.length >> 1]
  const across = Math.max(...cs.map((c) => cs.filter((o) => Math.abs(o.y - c.y) <= tol).length))
  const compression = unitTier === 'stroke' || !half ? 1 : boxes.reduce((s, b) => s + Math.sqrt((b.w / (2 * half.w)) * (b.h / (2 * half.h))), 0) / n
  return { gapRatio: r3(gap / n), nn: r2(nn / n), across, compression: r3(compression), offsets: cs.map((c) => ({ x: r2(c.x), y: r2(c.y) })) }
}

function repetition(cx: Context, path: string, node: IdsNode, h: Homogeneous, remainder: { node: IdsNode; path: string } | null, whole: Term<'whole'>, basisUnit: string): InternalRepetition | null {
  const arrangement = arrangementOf(h)
  if (!arrangement) return null
  const unitTier = h.tier === 'stroke' ? 'stroke' : 'character'
  // strokes twice (心 丶×2, 皿 丨×2) are not a candidate at all (§4.1)
  if (unitTier === 'stroke' && h.n < CONSTANTS.STROKE_REPETITION_MIN.value) return null
  const where = unitBoxes(cx, path, node, h)
  const half = unitHalf(h.unit, where.seen)
  const evidence: Evidence[] = [structureEvidence(cx.entry)]
  for (const t of h.through) {
    const e = cx.lookup(t)
    if (e.status === 'found') evidence.push(structureEvidence(e.entry, `through`))
  }
  if (cx.align) {
    const alike = cx.align.ink?.alike.find((a) => a.members.length === h.n)
    evidence.push(inkEvidence(cx.align, 'alike', alike ? `${h.n} alike islands of ink (${alike.share} of the ink each)` : `no group of ${h.n} alike islands in the ink`, alike ? h.n : 0))
    if (where.source !== 'ink') evidence.push(inkEvidence(cx.align, 'units', `unit positions: ${where.source === 'placement' ? `placements (${[...new Set(where.statuses)].join(', ')})` : 'none placed'}`))
  }
  const terms = `${h.unit}×${h.n}${remainder ? `+${remainder.node.kind === 'leaf' ? remainder.node.char : idsOf(remainder.node)}` : ''}${path && !remainder ? `@${path}` : ''}`
  return {
    id: `internal_repetition:${cx.g}:${whole.char === cx.char ? '' : `${whole.char}=`}${terms}` as DiscoveryId,
    type: 'internal_repetition',
    level: 'character',
    graphemes: [cx.g],
    evidence,
    basis: [`repetition:${basisUnit}:${h.unit}×${h.n}`],
    unit: { char: h.unit, role: 'unit', tier: h.tier },
    n: h.n,
    arrangement,
    whole,
    remainder: remainder ? term(cx, remainder.node, 'remainder', remainder.path) : null,
    unitTier,
    groupGeometry: groupGeometry(where.boxes, h.n, unitTier, half),
  }
}

function repetitions(cx: Context): InternalRepetition[] {
  const out: InternalRepetition[] = []
  const whole: Term<'whole'> = { char: cx.char, role: 'whole', tier: 'character' }
  const root = cx.tree
  const h = homogeneous(root, cx.lookup)
  if (h && h.n >= 2) {
    const d = repetition(cx, '', root, h, null, whole, cx.char)
    if (d) out.push(d)
    return out
  }
  if (root.kind !== 'op') return out
  // the whole less one leaf (淋 = 氵 + 林 = 木×2)
  root.children.forEach((rem, k) => {
    if (rem.kind !== 'leaf') return
    const rest = root.children.map((c, i) => ({ c, i })).filter((x) => x.i !== k)
    const hs = rest.map((x) => homogeneous(x.c, cx.lookup))
    if (hs.some((x) => !x) || new Set(hs.map((x) => x!.unit)).size !== 1) return
    const n = hs.reduce((s, x) => s + x!.n, 0)
    if (n < 2) return
    const joined: Homogeneous = rest.length === 1
      ? hs[0]!
      : { unit: hs[0]!.unit, tier: hs[0]!.tier, n, ops: [root.op, ...hs.flatMap((x) => x!.ops)], through: hs.flatMap((x) => x!.through) }
    // one child: the repetition is that child's (its own path); several: they stand under the root
    const at = rest.length === 1 ? child('', rest[0].i) : ''
    const node = rest.length === 1 ? rest[0].c : root
    const basisUnit = rest.length === 1 && rest[0].c.kind === 'leaf' ? rest[0].c.char : cx.char
    const d = repetition(cx, at, node, joined, { node: rem, path: child('', k) }, whole, basisUnit)
    if (d) out.push(d)
  })
  if (out.length) return out
  // a subtree of its own (雨: the four dots under 冂)
  const visit = (n: IdsNode, p: string) => {
    if (n.kind !== 'op') return
    const hh = p === '' ? null : homogeneous(n, cx.lookup)
    if (hh && hh.n >= 2) {
      const parent = p.includes('.') ? p.slice(0, p.lastIndexOf('.')) : ''
      const pn = walk(cx.tree).find((x) => x.path === parent)!.node
      const sib = pn.kind === 'op' && pn.children.length === 2 ? { node: pn.children[1 - Number(p.split('.').pop())], path: child(parent, 1 - Number(p.split('.').pop())) } : null
      const d = repetition(cx, p, n, hh, sib && sib.node.kind === 'leaf' ? sib : null, whole, `${cx.char}@${p}`)
      if (d) out.push(d)
      return
    }
    n.children.forEach((c, i) => visit(c, child(p, i)))
  }
  visit(root, '')
  return out
}

// ------------------------------------------------------------------ addition

const SIDES: Partial<Record<IdsOperator, readonly AdditionSide[]>> = {
  '⿰': ['left', 'right'],
  '⿱': ['top', 'bottom'],
  '⿲': ['left', 'wrap', 'right'],
  '⿳': ['top', 'wrap', 'bottom'],
}

function addition(cx: Context): Addition | null {
  const root = cx.tree
  if (root.kind !== 'op') return null
  const chars = root.children.map((c, i) => ({ c, i })).filter((x) => x.c.kind === 'leaf' && x.c.tier === 'character')
  if (chars.length !== 1 || root.children.length < 2) return null
  const b = chars[0]
  const basePath = child('', b.i)
  const deltas = root.children.map((c, i) => ({ c, i })).filter((x) => x.i !== b.i)
  // the side: the IDS place of the delta against the base
  let side: AdditionSide
  if (root.op === '⿻') side = 'interleaved'
  else if (SIDES[root.op] && deltas.length === 1) side = SIDES[root.op]![deltas[0].i]
  else side = 'wrap'
  // the delta's units: an unencoded one named by another region's IDS of the same shape (州: ⿲丶丶丶)
  const strokes = cx.input.structure.manifest.tiers.stroke
  const evidence: Evidence[] = [structureEvidence(cx.entry)]
  const delta: Term<'delta'>[] = []
  for (const d of deltas) {
    const p = child('', d.i)
    const sup = cx.entry.supplements.find((s) => s.path === p)
    if (d.c.kind === 'leaf' && d.c.tier === 'unknown' && sup) {
      for (const ch of [...sup.named].filter((x) => { const cp = x.codePointAt(0)!; return cp < 0x2ff0 || cp > 0x2fff }))
        delta.push({ char: ch, role: 'delta', tier: tierOfNamed(ch, strokes) })
      evidence.push({ id: `ev:${cx.char}:supplement`, kind: 'structure', provenance: sup.provenance, detail: `${sup.unknown} named ${sup.named} by ${sup.from}` })
    } else delta.push(term(cx, d.c, 'delta', p))
  }
  const row = rowAt(cx, basePath)
  if (row) evidence.push(placementEvidence(cx.char, row))
  const t = row?.transform
  const res = row?.residual
  const ink = t && res
    ? {
        deltaShare: res.share,
        deltaPieces: res.pieces.length,
        baseScale: r3(Math.max(t.sx, t.sy)),
        baseAspect: r3(1 - Math.min(t.sx, t.sy) / Math.max(t.sx, t.sy)),
        residueCentroid: res.centroid ?? { x: 0, y: 0 },
      }
    : { deltaShare: 0, deltaPieces: 0, baseScale: 0, baseAspect: 0, residueCentroid: { x: 0, y: 0 } }
  if (!(t && res)) evidence.push({ id: `ev:${cx.char}:no-ink`, kind: 'ink', provenance: { kind: 'table', table: 'align-1', key: `${cx.char}#${basePath}` }, detail: 'the base has no placement: its ink measures are not observed' })
  const arrangement = res && res.pieces.length === 1 ? 'single' : res && (res.distribution === 'row' || res.distribution === 'column') ? res.distribution : undefined
  const base = term(cx, b.c, 'base', basePath)
  return {
    id: `addition:${cx.g}:${base.char}+${delta.map((d) => d.char).join('')}` as DiscoveryId,
    type: 'addition',
    level: 'character',
    graphemes: [cx.g],
    evidence,
    basis: [`structure:${cx.char}`],
    base,
    derived: { char: cx.char, role: 'derived', tier: 'character' },
    delta: delta as [Term<'delta'>, ...Term<'delta'>[]],
    side,
    count: delta.length,
    ...(arrangement ? { arrangement } : {}),
    ink,
  }
}

// ------------------------------------------------------------------ the root's own operator

function operatorDiscoveries(cx: Context): Discovery[] {
  const root = cx.tree
  if (root.kind !== 'op') return []
  const leaves = root.children.every((c) => c.kind === 'leaf')
  const out: Discovery[] = []
  const paths = root.children.map((_, i) => child('', i))
  const ev = () => [structureEvidence(cx.entry), ...placed(cx, paths)]
  if (SPLIT.has(root.op) && leaves) {
    const parts = root.children.map((c, i) => term(cx, c, 'part', paths[i])) as [Term<'part'>, Term<'part'>, ...Term<'part'>[]]
    const d: Composition = {
      id: `composition:${cx.g}:${parts.map((p) => p.char).join('+')}` as DiscoveryId,
      type: 'composition', level: 'character', graphemes: [cx.g], evidence: ev(), basis: [`structure:${cx.char}`],
      parts, operator: root.op as Composition['operator'], axis: root.op === '⿰' || root.op === '⿲' ? 'horizontal' : 'vertical',
    }
    out.push(d)
  }
  if (FULL.has(root.op) && leaves && root.children.length === 2) {
    const d: Enclosure = {
      id: `enclosure:${cx.g}:${idsOf(root.children[0])}⊃${idsOf(root.children[1])}` as DiscoveryId,
      type: 'enclosure', level: 'character', graphemes: [cx.g], evidence: ev(), basis: [`structure:${cx.char}`],
      container: term(cx, root.children[0], 'container', paths[0]), contained: term(cx, root.children[1], 'contained', paths[1]),
      operator: root.op as Enclosure['operator'],
    }
    out.push(d)
  }
  if (PARTIAL.has(root.op) && leaves && root.children.length === 2) {
    const d: PartialEnclosure = {
      id: `partial_enclosure:${cx.g}:${idsOf(root.children[0])}⊃${idsOf(root.children[1])}` as DiscoveryId,
      type: 'partial_enclosure', level: 'character', graphemes: [cx.g], evidence: ev(), basis: [`structure:${cx.char}`],
      wrapper: term(cx, root.children[0], 'wrapper', paths[0]), core: term(cx, root.children[1], 'core', paths[1]),
      operator: root.op as PartialEnclosure['operator'],
    }
    out.push(d)
  }
  return out
}

// ------------------------------------------------------------------ crossing strokes

/** a ⿻ of two strokes (十) */
function crossingStrokes(tree: IdsNode): [IdsNode & { kind: 'leaf' }, IdsNode & { kind: 'leaf' }] | null {
  if (tree.kind !== 'op' || tree.op !== '⿻' || tree.children.length !== 2) return null
  const [a, b] = tree.children
  return a.kind === 'leaf' && b.kind === 'leaf' && a.tier === 'stroke' && b.tier === 'stroke' ? [a, b] : null
}

/** where the whole's ink crosses: nearest the centre of `within` (the whole, or an aligned component's box) */
function crossingPoint(cx: Context, within: Rect | null): { point: EmPoint; found: boolean } {
  const cs = cx.align?.ink?.crossings ?? []
  const box = within ?? (cx.align?.whole ? { x: -cx.align.whole.half.w, y: -cx.align.whole.half.h, w: 2 * cx.align.whole.half.w, h: 2 * cx.align.whole.half.h } : null)
  const inBox = box ? cs.filter((c) => c.x >= box.x && c.x <= box.x + box.w && c.y >= box.y && c.y <= box.y + box.h) : cs
  if (!inBox.length) return { point: { x: 0, y: 0 }, found: false }
  const o = box ? center(box) : { x: 0, y: 0 }
  const best = [...inBox].sort((p, q) => Math.hypot(p.x - o.x, p.y - o.y) - Math.hypot(q.x - o.x, q.y - o.y) || p.x - q.x || p.y - q.y)[0]
  return { point: best, found: true }
}

function intersection(cx: Context, within: string, strokes: readonly [IdsNode & { kind: 'leaf' }, IdsNode & { kind: 'leaf' }], box: Rect | null): Intersection {
  const { point, found } = crossingPoint(cx, box)
  const evidence: Evidence[] = [structureEvidence(cx.entry)]
  if (within !== cx.char) {
    const e = cx.lookup(within)
    if (e.status === 'found') evidence.push(structureEvidence(e.entry, 'inner'))
  }
  if (cx.align) evidence.push(inkEvidence(cx.align, 'crossing', found ? `the ink crosses at (${point.x}, ${point.y})` : 'no crossing of long runs found in the ink', found ? 1 : 0))
  return {
    id: `intersection:${cx.g}:${within}:${strokes[0].char}×${strokes[1].char}` as DiscoveryId,
    type: 'intersection', level: 'character', graphemes: [cx.g], evidence, basis: [`crossing:${within}`],
    strokes: [{ char: strokes[0].char, role: 'stroke', tier: strokes[0].tier }, { char: strokes[1].char, role: 'stroke', tier: strokes[1].tier }],
    within,
    point,
  }
}

// ------------------------------------------------------------------ the character, all together

export function characterDiscoveries(g: number, char: string, input: DiscoveryInput): Discovery[] {
  const lookup = (c: string) => input.structure.lookup(c)
  const found = lookup(char)
  if (found.status !== 'found' || found.structure.tree.kind !== 'op') return []
  const cx: Context = { g, char, entry: found.entry, tree: found.structure.tree, align: input.align.entry(char), input, lookup }
  const out: Discovery[] = [...repetitions(cx)]
  const add = addition(cx)
  if (add) out.push(add)
  out.push(...operatorDiscoveries(cx))
  const own = crossingStrokes(cx.tree)
  if (own) out.push(intersection(cx, char, own, null))

  // nested: a component that is a character with a repetition or a crossing of its own
  const nested: Nested[] = []
  for (const { path, node } of walk(cx.tree)) {
    if (path === '' || node.kind !== 'leaf' || node.tier !== 'character') continue
    const inner = lookup(node.char)
    if (inner.status !== 'found' || inner.structure.tree.kind !== 'op') continue
    const row = rowAt(cx, path)
    let held: Discovery | null = null
    const h = homogeneous(node, lookup)
    if (h && h.n >= 2) held = repetition(cx, path, node, h, null, term(cx, node, 'whole', path), node.char)
    const cross = crossingStrokes(inner.structure.tree)
    if (!held && cross) held = intersection(cx, node.char, cross, row?.status === 'aligned' && row.box ? row.box : null)
    if (!held) continue
    if (!out.some((d) => d.id === held!.id)) out.push(held)
    nested.push({
      id: `nested:${g}:${node.char}@${path}` as DiscoveryId,
      type: 'nested', level: 'character', graphemes: [g],
      evidence: [structureEvidence(cx.entry), structureEvidence(inner.entry, 'inner')],
      basis: held.basis,
      term: node.char,
      holds: held.id,
    })
  }
  out.push(...nested)
  // an outer Discovery names the nested ones found in its terms (淋's addition holds 林 = 木×2)
  const termsOf = (d: Discovery): string[] => {
    switch (d.type) {
      case 'addition': return [d.base.char, ...d.delta.map((x) => x.char)]
      case 'composition': return d.parts.map((p) => p.char)
      case 'enclosure': return [d.container.char, d.contained.char]
      case 'partial_enclosure': return [d.wrapper.char, d.core.char]
      case 'internal_repetition': return d.remainder ? [d.remainder.char] : []
      default: return []
    }
  }
  return out.map((d) => {
    const ns = nested.filter((n) => termsOf(d).includes(n.term)).map((n) => n.id)
    return ns.length ? { ...d, nested: ns } : d
  })
}
