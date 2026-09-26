/**
 * Build time only: where the structure's components lie in the whole's ink —
 * the joint fit (spec-1 §2.1, §16 Stage 3).
 *
 *   linguistic input   the character's structure (structure-1): its operators and components
 *   transformation     each component's own glyph, scaled per axis and moved, searched only in the
 *                      region its operator gives it; then all the components of the character
 *                      chosen together, so that they explain the whole's ink between them without
 *                      claiming the same ink twice and without breaking their operators
 *   visual output      a placement (box, scale, shift) per component, and how well it fits
 *
 * The structure is the truth of what exists: a poor fit is recorded as poor,
 * never as absence.
 */
import type { IdsNode, IdsOperator } from '../../types/structure'
import { A } from '../constants'
import { CELLS, cellOf, distance, GRID_N, type Glyph } from './raster'
import { keeps, regions, siblingRule, splitAxis, splits, type Box, type Region } from './regions'

export interface Whole {
  glyph: Glyph
  dist: Float32Array
  box: Box
}

export function wholeOf(glyph: Glyph): Whole {
  return { glyph, dist: distance(glyph.grid), box: { x0: -glyph.half.w, y0: -glyph.half.h, x1: glyph.half.w, y1: glyph.half.h } }
}

export interface Placement {
  box: Box
  sx: number
  sy: number
  dx: number
  dy: number
}

export interface Candidate extends Placement {
  /** placed ink on / off the whole's ink (em², within TOLERANCE) */
  on: number
  off: number
  net: number
  /** the whole's ink cells this placement explains (within one cell of its placed ink) */
  claim: Int32Array
  /** what each em² of its ink off the whole's ink costs (by the component's tier) */
  offCost: number
  /** what each cell of ink it explains is worth to the joint fit (a stroke's less: its glyph fits almost any ink) */
  weight: number
}

/** a node of the structure, as the fit sees it */
export interface FitNode {
  path: string
  node: IdsNode
  /** the region its parent's operator gives it (null for the root) */
  region: Region | null
  /** the parent's region box (the box the region was cut from) */
  parent: Box
  /** its own box to cut its children's regions from */
  own: Box
  children: FitNode[]
  /** the operator of its parent */
  parentOp: IdsOperator | null
  index: number
  depth: number
  /** a leaf with a glyph in the reading face */
  glyph?: Glyph
  candidates?: Candidate[]
}

const placement = (g: Glyph, b: Box): Placement => ({
  box: b,
  sx: (b.x1 - b.x0) / (2 * g.half.w),
  sy: (b.y1 - b.y0) / (2 * g.half.h),
  dx: (b.x0 + b.x1) / 2,
  dy: (b.y0 + b.y1) / 2,
})

/**
 * placed ink on and off the whole's ink, area-weighted (em²); with `claimed`, ink on cells another
 * component already explains is counted apart (dup), not as on
 */
function score(w: Whole, p: Placement, pts: Float64Array, weight: number, tol: number, claimed?: Uint8Array): { on: number; off: number; dup: number } {
  let on = 0
  let dup = 0
  let n = 0
  for (let k = 0; k < pts.length; k += 2) {
    const c = cellOf(pts[k] * p.sx + p.dx, pts[k + 1] * p.sy + p.dy)
    n++
    if (c >= 0 && w.dist[c] <= tol) {
      if (claimed && claimed[c]) dup++
      else on++
    }
  }
  const a = weight * p.sx * p.sy
  return { on: on * a, off: (n - on - dup) * a, dup: dup * a }
}

/** what ink placed off the whole costs (one cost for every tier: a lower one for strokes let 丿 shrink onto any ink) */
export const offCostOf = (_tier: string): number => A('OFF_COST')

/** what a cell of ink explained by a component of this tier is worth to the joint fit */
export const weightOf = (tier: string): number => (tier === 'stroke' ? A('STROKE_WEIGHT') : 1)

const netOf = (v: { on: number; off: number; dup: number }, offCost: number) => v.on - offCost * v.off - A('OVERLAP_COST') * v.dup

/** the cells a placement inks (its points, grown by one cell) */
export function placedMask(g: Glyph, p: Placement): Uint8Array {
  const hit = new Uint8Array(CELLS)
  const pts = g.points
  // a component drawn larger than itself leaves gaps between its points: fill them
  const fill = Math.max(p.sx, p.sy) > 1 ? 1 : 0
  for (let k = 0; k < pts.length; k += 2) {
    const x = pts[k] * p.sx + p.dx
    const y = pts[k + 1] * p.sy + p.dy
    for (let a = -fill; a <= fill; a++)
      for (let b = -fill; b <= fill; b++) {
        const c = cellOf(x + a * 0.5, y + b * 0.5)
        if (c >= 0) hit[c] = 1
      }
  }
  const out = new Uint8Array(CELLS)
  const N = GRID_N
  for (let c = 0; c < CELLS; c++) {
    if (!hit[c]) continue
    const i = c % N
    const j = (c - i) / N
    for (let b = Math.max(0, j - 1); b <= Math.min(N - 1, j + 1); b++)
      for (let a = Math.max(0, i - 1); a <= Math.min(N - 1, i + 1); a++) out[b * N + a] = 1
  }
  return out
}

function claimOf(g: Glyph, w: Whole, p: Placement): Int32Array {
  const m = placedMask(g, p)
  const out: number[] = []
  const wg = w.glyph.grid
  for (let c = 0; c < CELLS; c++) if (m[c] && wg[c]) out.push(c)
  return Int32Array.from(out)
}

const scaleOk = (g: Glyph, b: Box): boolean => {
  const sx = (b.x1 - b.x0) / (2 * g.half.w)
  const sy = (b.y1 - b.y0) / (2 * g.half.h)
  const lo = A('SCALE_MIN')
  const hi = A('SCALE_MAX')
  return sx >= lo - 1e-9 && sx <= hi + 1e-9 && sy >= lo - 1e-9 && sy <= hi + 1e-9 && Math.max(sx / sy, sy / sx) <= A('ASPECT_MAX') + 1e-9
}

const near = (a: Box, b: Box, d: number) => Math.abs(a.x0 - b.x0) <= d && Math.abs(a.x1 - b.x1) <= d && Math.abs(a.y0 - b.y0) <= d && Math.abs(a.y1 - b.y1) <= d

/** a range from lo to hi by step, both ends included */
function steps(lo: number, hi: number, step: number): number[] {
  if (hi < lo) return []
  const out: number[] = []
  for (let v = lo; v < hi - 1e-9; v += step) out.push(v)
  out.push(hi)
  return out
}

/** every placement of one component in its region: a coarse pass, then the best few refined */
export function searchLeaf(g: Glyph, w: Whole, r: Region, parent: Box, offCost: number, weight: number, claimed?: Uint8Array): Candidate[] {
  const S = A('COARSE_STEP')
  const lo = A('SCALE_MIN')
  const hi = A('SCALE_MAX')
  const W = r.within
  // a first look at twice the step, with the thinnest sample and a looser eye
  const S2 = 2 * S
  const widths = steps(Math.max(1, 2 * g.half.w * lo), Math.min(W.x1 - W.x0, 2 * g.half.w * hi), S2)
  const heights = steps(Math.max(1, 2 * g.half.h * lo), Math.min(W.y1 - W.y0, 2 * g.half.h * hi), S2)
  const first: { b: Box; net: number }[] = []
  for (const bw of widths)
    for (const bh of heights)
      for (const x0 of steps(W.x0, W.x1 - bw, S2))
        for (const y0 of steps(W.y0, W.y1 - bh, S2)) {
          const b = { x0, y0, x1: x0 + bw, y1: y0 + bh }
          if (!scaleOk(g, b) || !keeps(r, b, parent, true)) continue
          first.push({ b, net: netOf(score(w, placement(g, b), g.thin, g.thinWeight, A('FIRST_TOLERANCE'), claimed), offCost) })
        }
  first.sort(order)
  const looks: Box[] = []
  for (const c of first) {
    if (looks.length >= 3 * A('SEEDS')) break
    if (!looks.some((s) => near(s, c.b, S2))) looks.push(c.b)
  }
  // then the coarse pass around each: the step, the sparse sample
  const coarseNet = (b: Box) => ({ net: netOf(score(w, placement(g, b), g.sparse, 4, A('COARSE_TOLERANCE'), claimed), offCost) })
  const coarse = looks.map((b) => climbIn(g, r, parent, b, [S], coarseNet)).sort(order)
  const seeds: Box[] = []
  for (const c of coarse) {
    if (seeds.length >= A('SEEDS')) break
    if (!seeds.some((s) => near(s, c.b, S))) seeds.push(c.b)
  }
  const netWith = (pts: Float64Array, weight: number) => (b: Box) => {
    const v = score(w, placement(g, b), pts, weight, A('TOLERANCE'), claimed)
    return { ...v, net: netOf(v, offCost) }
  }
  const climb = (start: Box, stepsOf: readonly number[], value: (b: Box) => { net: number }) => climbIn(g, r, parent, start, stepsOf, value)
  // first with the coarse sample at 2 em, then the best with every ink cell at 1 and 0.5 em
  const rough = seeds.map((seed) => climb(seed, [2], netWith(g.sparse, 4))).sort(order)
  const kept: Box[] = []
  for (const c of rough) {
    if (kept.length >= A('CANDIDATES')) break
    if (!kept.some((k) => near(k, c.b, 2))) kept.push(c.b)
  }
  const refined = kept.map((b) => climb(b, [1, 0.5], netWith(g.points, 1))).sort(order)
  const out: Candidate[] = []
  for (const c of refined) {
    if (out.some((o) => near(o.box, c.b, 1.5))) continue
    const p = placement(g, c.b)
    // what the candidate is, on its own (claimed ink only steers the search)
    const v = score(w, p, g.points, 1, A('TOLERANCE'))
    out.push({ ...p, on: v.on, off: v.off, net: v.on - offCost * v.off, claim: claimOf(g, w, p), offCost, weight })
  }
  return out
}

/** hill-climb a box: each edge and the whole box, one step at a time, while the value rises; steps from coarse to fine */
function climbIn<V extends { net: number }>(g: Glyph, r: Region, parent: Box, start: Box, stepsOf: readonly number[], value: (b: Box) => V): V & { b: Box } {
  let b = start
  let best = value(b)
  for (const step of stepsOf) {
    for (let moved = true, guard = 0; moved && guard < 40; guard++) {
      moved = false
      for (const [k, d] of MOVES) {
        const t = { ...b }
        if (k === 'm') {
          t.x0 += d * step
          t.x1 += d * step
        } else if (k === 'n') {
          t.y0 += d * step
          t.y1 += d * step
        } else t[k] += d * step
        if (t.x1 - t.x0 < 1 || t.y1 - t.y0 < 1 || !scaleOk(g, t) || !keeps(r, t, parent, true)) continue
        const v = value(t)
        if (v.net > best.net + 1e-9) {
          b = t
          best = v
          moved = true
        }
      }
    }
  }
  return { ...best, b }
}

const MOVES = [['x0', -1], ['x0', 1], ['x1', -1], ['x1', 1], ['y0', -1], ['y0', 1], ['y1', -1], ['y1', 1], ['m', -1], ['m', 1], ['n', -1], ['n', 1]] as const

/** best first; ties by position, so the order never depends on how the search ran */
const order = (a: { b: Box; net: number }, b: { b: Box; net: number }) => b.net - a.net || a.b.x0 - b.b.x0 || a.b.y0 - b.b.y0 || a.b.x1 - b.b.x1 || a.b.y1 - b.b.y1

export const leavesOf = (f: FitNode): FitNode[] => (f.children.length ? f.children.flatMap(leavesOf) : [f])

const union = (bs: Box[]): Box | null =>
  bs.length ? { x0: Math.min(...bs.map((b) => b.x0)), y0: Math.min(...bs.map((b) => b.y0)), x1: Math.max(...bs.map((b) => b.x1)), y1: Math.max(...bs.map((b) => b.y1)) } : null

/** the chosen placements: leaf path → candidate */
export type Choice = Map<string, Candidate>

/** the box of a node under a choice: its own placement, or the union of its placed parts */
export function boxOf(f: FitNode, choice: Choice): Box | null {
  if (!f.children.length) return choice.get(f.path)?.box ?? null
  return union(f.children.map((c) => boxOf(c, choice)).filter((b): b is Box => b !== null))
}

/** how many of its operator's demands a set of sibling boxes breaks: order along a split, the enclosed inside its wrapper */
export function siblingsBreak(op: IdsOperator, boxes: readonly (Box | null)[]): number {
  const rule = siblingRule(op)
  if (rule.kind === 'order') {
    const mid = (b: Box) => (rule.axis === 'x' ? (b.x0 + b.x1) / 2 : (b.y0 + b.y1) / 2)
    const placed = boxes.filter((b): b is Box => b !== null)
    let v = 0
    for (let i = 1; i < placed.length; i++) if (mid(placed[i - 1]) >= mid(placed[i]) - 1) v++
    return v
  }
  if (rule.kind === 'inside') {
    const [a, b] = boxes
    if (a && b) {
      const t = 0.1 * Math.max(a.x1 - a.x0, a.y1 - a.y0)
      if (b.x0 < a.x0 - t || b.x1 > a.x1 + t || b.y0 < a.y0 - t || b.y1 > a.y1 + t) return 1
    }
  }
  return 0
}

/**
 * Does some operator above this node (not ⿻) have a child none of whose parts is placed (an
 * unencoded component, one not in the face)? Then nothing holds this node's placement on that
 * side: the joint fit is one-sided there.
 */
export function unplacedSibling(root: FitNode, path: string, choice: Choice): boolean {
  let f = root
  for (const step of path.split('.')) {
    if (f.node.kind === 'op' && f.node.op !== '⿻') {
      for (const c of f.children) if (c.index !== Number(step) && !leavesOf(c).some((l) => choice.has(l.path))) return true
    }
    f = f.children[Number(step)]
  }
  return false
}

/** the nodes whose operator's demand a choice breaks: a node whose children break it, a subtree off its anchors */
export function brokenNodes(root: FitNode, choice: Choice): FitNode[] {
  const out: FitNode[] = []
  const walk = (f: FitNode) => {
    if (!f.children.length || f.node.kind !== 'op') return
    const boxes = f.children.map((c) => boxOf(c, choice))
    if (siblingsBreak(f.node.op, boxes)) out.push(f)
    f.children.forEach((c, i) => {
      const b = boxes[i]
      if (c.children.length && b && c.region && !keeps(c.region, b, c.parent, false)) out.push(c)
      walk(c)
    })
  }
  walk(root)
  return out
}

/** how many of the operators' demands a choice breaks: order, inside, and a subtree's anchors */
export function violations(root: FitNode, choice: Choice): number {
  let v = 0
  const walk = (f: FitNode) => {
    if (!f.children.length || f.node.kind !== 'op') return
    const boxes = f.children.map((c) => boxOf(c, choice))
    v += siblingsBreak(f.node.op, boxes)
    f.children.forEach((c, i) => {
      const b = boxes[i]
      if (c.children.length && b && c.region && !keeps(c.region, b, c.parent, false)) v++
      walk(c)
    })
  }
  walk(root)
  return v
}

/** the lowest common operator of two nodes (by path) */
export function commonOp(tree: IdsNode, a: string, b: string): IdsOperator | null {
  const pa = a === '' ? [] : a.split('.')
  const pb = b === '' ? [] : b.split('.')
  let n = tree
  for (let i = 0; i < Math.min(pa.length, pb.length) && pa[i] === pb[i] && n.kind === 'op'; i++) n = n.children[Number(pa[i])]
  return n.kind === 'op' ? n.op : null
}

/** the joint objective: ink explained once, minus ink placed off the whole, minus ink two components both claim */
export function joint(tree: IdsNode, choice: Choice, stamp: Int32Array): { value: number; explained: number; overlap: number } {
  const entries = [...choice]
  stamp.fill(0)
  WORTH.fill(0)
  let explained = 0
  let worth = 0
  let off = 0
  for (const [, c] of entries) {
    off += c.offCost * c.off
    for (const k of c.claim) {
      if (stamp[k]++ === 0) explained++
      // a cell is worth what its strongest claimant makes it worth
      if (c.weight > WORTH[k]) {
        worth += c.weight - WORTH[k]
        WORTH[k] = c.weight
      }
    }
  }
  let overlap = 0
  for (let i = 0; i < entries.length; i++)
    for (let j = i + 1; j < entries.length; j++) {
      if (commonOp(tree, entries[i][0], entries[j][0]) === '⿻') continue
      overlap += shared(entries[i][1].claim, entries[j][1].claim)
    }
  return { value: worth - off - A('OVERLAP_COST') * overlap, explained, overlap }
}

const WORTH = new Float32Array(CELLS)

/** cells in both of two sorted claims */
export function shared(a: Int32Array, b: Int32Array): number {
  let i = 0
  let j = 0
  let n = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      n++
      i++
      j++
    } else if (a[i] < b[j]) i++
    else j++
  }
  return n
}

/**
 * What cutting a region costs: SEAM_COST for each of the whole's ink cells a cut runs through
 * (within the region). A split between two components runs where the ink is thinnest — the
 * seam v1 reads between 偏 and 旁 (glyph/metrics) — not through one of them.
 */
function seamCost(w: Whole, own: Box, axis: 'x' | 'y', cuts: readonly number[]): number {
  let n = 0
  for (const t of cuts) {
    const at = axis === 'x' ? own.x0 + t * (own.x1 - own.x0) : own.y0 + t * (own.y1 - own.y0)
    const [lo, hi] = axis === 'x' ? [own.y0, own.y1] : [own.x0, own.x1]
    for (let v = Math.ceil(lo - 0.5) + 0.5; v < hi; v++) {
      const k = axis === 'x' ? cellOf(at, v) : cellOf(v, at)
      if (k >= 0 && w.glyph.grid[k]) n++
    }
  }
  return A('SEAM_COST') * n
}

/** a way to place a subtree: its leaves' placements, and the regions its nodes were searched in */
interface Solution {
  /** what the cuts of its splits cost: the whole's ink they run through */
  seam: number
  choice: Choice
  regions: Map<string, { region: Region; parent: Box }>
  box: Box | null
  value: number
}

/** what breaking an operator's demand costs a combination: more than any ink can win back */
const BROKEN = 1e6

const keyOf = (b: Box) => `${b.x0.toFixed(2)},${b.y0.toFixed(2)},${b.x1.toFixed(2)},${b.y1.toFixed(2)}`

/**
 * The structure fitted top down. A leaf is searched in its region. A node tries every
 * way its operator may cut its region (⿰ ⿲ ⿱ ⿳: each cut in SPLITS; the others: their one
 * layout), fits each child in its part, and keeps the best few combinations of its children's
 * best few — so that the parts of a character are chosen together, each in its own place,
 * and a large part cannot spread over its neighbour's place while the neighbour shrinks into a
 * dense spot.
 */
export function fitTree(tree: IdsNode, w: Whole, glyphOf: (char: string) => Glyph | null): { root: FitNode; choice: Choice } {
  const stamp = new Int32Array(CELLS)
  const searched = new Map<string, Candidate[]>()
  const search = (g: Glyph, r: Region, parent: Box, tier: string): Candidate[] => {
    const k = `${g.char}|${tier}|${r.name}|${keyOf(r.within)}|${r.anchors.join('')}|${r.minSpan ? 1 : 0}|${keyOf(parent)}`
    let c = searched.get(k)
    if (!c) searched.set(k, (c = searchLeaf(g, w, r, parent, offCostOf(tier), weightOf(tier))))
    return c
  }
  const K = A('CANDIDATES')
  // a subtree in the same region gets the same solutions (⿲ ⿳: an outer child's region depends on one cut only)
  const solved = new Map<string, Solution[]>()
  const solve = (node: IdsNode, path: string, region: Region, parent: Box): Solution[] => {
    const k = `${path}|${region.name}|${keyOf(region.within)}|${region.anchors.join('')}|${region.minSpan ? 1 : 0}|${keyOf(parent)}`
    let s = solved.get(k)
    if (!s) solved.set(k, (s = solveHere(node, path, region, parent)))
    return s
  }
  const solveHere = (node: IdsNode, path: string, region: Region, parent: Box): Solution[] => {
    const here = new Map([[path, { region, parent }]])
    if (node.kind === 'leaf') {
      const g = node.tier === 'unknown' ? null : glyphOf(node.char)
      const cs = g ? search(g, region, parent, node.tier) : []
      if (!cs.length) return [{ seam: 0, choice: new Map(), regions: here, box: null, value: 0 }]
      return cs.map((c) => ({ seam: 0, choice: new Map([[path, c]]), regions: here, box: c.box, value: c.net }))
    }
    const own = region.within
    const n = node.children.length
    const strokes = node.children.map((c) => c.kind === 'leaf' && c.tier === 'stroke')
    const depth = path === '' ? 0 : path.split('.').length
    const axis = splitAxis(node.op)
    const layouts = axis
      ? splits(n, depth).map((cuts) => ({ rs: regions(node.op, n, own, cuts, strokes, depth === 0), seam: seamCost(w, own, axis, cuts) }))
      : [{ rs: regions(node.op, n, own, [], [], depth === 0), seam: 0 }]
    const found: Solution[] = []
    for (const { rs, seam } of layouts) {
      const parts = node.children.map((c, i) => solve(c, path === '' ? String(i) : `${path}.${i}`, rs[i], own))
      const at = new Array(parts.length).fill(0)
      for (;;) {
        const pick = parts.map((p, i) => p[at[i]])
        const boxes = pick.map((p) => p.box)
        let bad = siblingsBreak(node.op, boxes)
        pick.forEach((p, i) => {
          if (node.children[i].kind === 'op' && p.box && !keeps(rs[i], p.box, own, false)) bad++
        })
        // a combination that breaks its operator is kept, but behind every one that does not:
        // the structure says the parts are there, so some placement is always given
        const choice: Choice = new Map(pick.flatMap((p) => [...p.choice]))
        const regionsOf = new Map([...here, ...pick.flatMap((p) => [...p.regions])])
        const seams = seam + pick.reduce((t, p) => t + p.seam, 0)
        found.push({ seam: seams, choice, regions: regionsOf, box: union(boxes.filter((b): b is Box => b !== null)), value: joint(tree, choice, stamp).value - seams - BROKEN * bad })
        let i = 0
        while (i < parts.length && ++at[i] >= parts[i].length) at[i++] = 0
        if (i === parts.length) break
      }
    }
    // stable: equal values keep the order the layouts and candidates were tried in
    found.sort((a, b) => b.value - a.value)
    const out: Solution[] = []
    const seen = new Set<string>()
    for (const f of found) {
      if (out.length >= K) break
      const k = [...f.choice].map(([p, c]) => p + ':' + keyOf(c.box)).join(';')
      if (seen.has(k)) continue
      seen.add(k)
      out.push(f)
    }
    return out
  }
  const top: Region = { name: 'overlay', within: w.box, anchors: [] }
  const best = solve(tree, '', top, w.box)[0] ?? { seam: 0, choice: new Map(), regions: new Map(), box: null, value: 0 }
  // the tree, with the regions of the chosen solution and each leaf's candidates there
  const build = (node: IdsNode, path: string, parentOp: IdsOperator | null, index: number, depth: number): FitNode => {
    const at = best.regions.get(path)
    const region = path === '' ? null : (at?.region ?? null)
    const parent = at?.parent ?? w.box
    const f: FitNode = { path, node, region, parent, own: region ? region.within : w.box, children: [], parentOp, index, depth }
    if (node.kind === 'op') f.children = node.children.map((c, i) => build(c, path === '' ? String(i) : `${path}.${i}`, node.op, i, depth + 1))
    else if (region && node.tier !== 'unknown') {
      const g = glyphOf(node.char)
      if (g) {
        f.glyph = g
        f.candidates = search(g, region, parent, node.tier)
      }
    }
    return f
  }
  const root = build(tree, '', null, 0, 0)
  return { root, choice: reconsider(root, w, best.choice) }
}

/**
 * Each placed component searched again in its region, the others held still: ink they already
 * explain counts against it, not for it (so it looks for the ink nobody explains — 厂's 丿 beside
 * 火's, not on it). A new place is taken only when the whole fit is better for it.
 */
export function reconsider(root: FitNode, w: Whole, choice: Choice): Choice {
  const stamp = new Int32Array(CELLS)
  const value = (ch: Choice) => joint(root.node, ch, stamp).value - BROKEN * violations(root, ch)
  let v = value(choice)
  const leaves = leavesOf(root).filter((l) => choice.has(l.path) && l.glyph && l.region)
  for (let sweep = 0; sweep < A('RECONSIDER'); sweep++) {
    let moved = false
    for (const l of leaves) {
      const claimed = new Uint8Array(CELLS)
      for (const [p, c] of choice) {
        if (p === l.path || commonOp(root.node, p, l.path) === '⿻') continue
        for (const k of c.claim) claimed[k] = 1
      }
      const was = choice.get(l.path)!
      let keep = was
      // looked for across its parent's whole region, not only the part a cut left it: the joint fit,
      // with the others' ink counted against it and the operators kept, decides whether it moves
      const s = A('SLACK')
      const p = l.parent
      const wide: Region = { ...l.region!, within: { x0: p.x0 - s * (p.x1 - p.x0), y0: p.y0 - s * (p.y1 - p.y0), x1: p.x1 + s * (p.x1 - p.x0), y1: p.y1 + s * (p.y1 - p.y0) } }
      // (only where every part around it is placed and can push back: an unplaced sibling's place is nobody's to take)
      const tries = searchLeaf(l.glyph!, w, l.region!, l.parent, was.offCost, was.weight, claimed)
      if (!unplacedSibling(root, l.path, choice)) tries.push(...searchLeaf(l.glyph!, w, wide, l.parent, was.offCost, was.weight, claimed))
      for (const c of tries) {
        choice.set(l.path, c)
        const nv = value(choice)
        if (nv > v + 1e-9) {
          v = nv
          keep = c
          moved = true
        }
      }
      choice.set(l.path, keep)
      if (keep !== was) l.candidates = [keep, ...(l.candidates ?? [])]
    }
    if (!moved) break
  }
  return choice
}

/** the chosen placements refined together: each component nudged while the others hold still */
export function refine(root: FitNode, w: Whole, choice: Choice): Choice {
  const stamp = new Int32Array(CELLS)
  const leaves = leavesOf(root).filter((l) => choice.has(l.path))
  const tol = A('TOLERANCE')
  const value = (ch: Choice) => joint(root.node, ch, stamp).value - BROKEN * violations(root, ch)
  let v = value(choice)
  for (const l of leaves) {
    const g = l.glyph!
    for (const step of [1, 0.5]) {
      for (let moved = true, guard = 0; moved && guard < 20; guard++) {
        moved = false
        for (const [k, d] of [['x0', -1], ['x0', 1], ['x1', -1], ['x1', 1], ['y0', -1], ['y0', 1], ['y1', -1], ['y1', 1]] as const) {
          const t = { ...choice.get(l.path)!.box }
          t[k] += d * step
          if (t.x1 - t.x0 < 1 || t.y1 - t.y0 < 1 || !scaleOk(g, t) || !keeps(l.region!, t, l.parent, true)) continue
          const p = placement(g, t)
          const s = score(w, p, g.points, 1, tol)
          const { offCost: cost, weight } = choice.get(l.path)!
          const c: Candidate = { ...p, on: s.on, off: s.off, net: s.on - cost * s.off, claim: claimOf(g, w, p), offCost: cost, weight }
          const was = choice.get(l.path)!
          choice.set(l.path, c)
          const nv = value(choice)
          if (nv > v + 1e-9) {
            v = nv
            moved = true
          } else choice.set(l.path, was)
        }
      }
    }
  }
  return choice
}

/** how a placement lies on the whole: precision, lift over chance (v1 relate's reading), explained share */
export function measures(w: Whole, c: Candidate): { precision: number; lift: number; explained: number } {
  const tol = A('TOLERANCE')
  const precision = c.on + c.off > 0 ? c.on / (c.on + c.off) : 0
  // chance: how much of the placed box, grown by LIFT_MARGIN, is within reach of the whole's ink
  // (grown: a stroke's own box is nothing but ink, and chance there would be all of it)
  let area = 0
  let dense = 0
  const g = A('LIFT_MARGIN')
  const b = { x0: c.box.x0 - g, y0: c.box.y0 - g, x1: c.box.x1 + g, y1: c.box.y1 + g }
  for (let y = Math.ceil(b.y0 - 0.5) + 0.5; y < b.y1; y++)
    for (let x = Math.ceil(b.x0 - 0.5) + 0.5; x < b.x1; x++) {
      const k = cellOf(x, y)
      if (k < 0) continue
      area++
      if (w.dist[k] <= tol) dense++
    }
  const chance = area ? dense / area : 1
  const lift = chance < 1 ? Math.max(0, (precision - chance) / (1 - chance)) : 0
  return { precision, lift, explained: c.claim.length / w.glyph.cells }
}
