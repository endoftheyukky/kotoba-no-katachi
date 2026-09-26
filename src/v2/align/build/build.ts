/**
 * Build time only: one entry of align-1 from a structure-1 entry and the
 * measured glyphs. Pure: the same structure and rasters give the same entry.
 */
import type { StructureEntry } from '../../structure/table'
import { idsOf } from '../../structure/view'
import type { Provenance } from '../../types/provenance'
import type { IdsNode } from '../../types/structure'
import { A } from '../constants'
import type { AlignEntry, AlignReason, AlignRow, Residual } from '../table'
import { boxOf, brokenNodes, commonOp, fitTree, searchLeaf, unplacedSibling, joint, leavesOf, measures, placedMask, refine, violations, wholeOf, type Candidate, type Choice, type FitNode, type Whole } from './fit'
import { CELLS, type Glyph } from './raster'
import { regionName } from './regions'
import { rectOf, residual } from './residual'

export const TOOL_VERSION = '1'

const r2 = (v: number) => Math.round(v * 100) / 100
const r3 = (v: number) => Math.round(v * 1000) / 1000

const MEASURE: Provenance = { kind: 'v1', module: 'glyph/metrics', detail: 'measure, in the reading face (Noto Sans JP 500)' }

/**
 * How close a rival place comes (0: none near; 1: as good). The rival is looked for in the
 * component's region with its own ink and its siblings' ink counted as taken — its best other
 * place — and among its candidates; its cost is what the joint fit loses there.
 */
function ambiguity(root: FitNode, leaf: FitNode, choice: Choice, w: Whole): number {
  const stamp = new Int32Array(CELLS)
  const c = choice.get(leaf.path)!
  const here = joint(root.node, choice, stamp).value
  const cx = (c.box.x0 + c.box.x1) / 2
  const cy = (c.box.y0 + c.box.y1) / 2
  const far = Math.max(4, 0.25 * Math.max(c.box.x1 - c.box.x0, c.box.y1 - c.box.y0))
  const taken = new Uint8Array(CELLS)
  for (const [p, o] of choice) if (p === leaf.path || commonOp(root.node, p, leaf.path) !== '⿻') for (const k of o.claim) taken[k] = 1
  const rivals = [...leaf.candidates!, ...searchLeaf(leaf.glyph!, w, leaf.region!, leaf.parent, c.offCost, c.weight, taken)]
  let alt = -Infinity
  for (const a of rivals) {
    if (Math.hypot((a.box.x0 + a.box.x1) / 2 - cx, (a.box.y0 + a.box.y1) / 2 - cy) < far) continue
    choice.set(leaf.path, a)
    if (!violations(root, choice)) alt = Math.max(alt, joint(root.node, choice, stamp).value)
  }
  choice.set(leaf.path, c)
  if (alt === -Infinity) return 0
  // a rival loses little of what the component explains; one that loses AMBIGUITY_SPAN of it or more is none
  return Math.min(1, Math.max(0, 1 - (here - alt) / Math.max(1, c.claim.length) / A('AMBIGUITY_SPAN')))
}

function sharedShare(root: FitNode, leaf: FitNode, choice: Choice): number {
  const mine = choice.get(leaf.path)!.claim
  if (!mine.length) return 0
  const others = new Uint8Array(CELLS)
  for (const [p, c] of choice) {
    if (p === leaf.path) continue
    // siblings under ⿻ lie over each other by definition
    if (commonOp(root.node, p, leaf.path) === '⿻') continue
    for (const k of c.claim) others[k] = 1
  }
  let n = 0
  for (const k of mine) if (others[k]) n++
  return n / mine.length
}

const atLimit = (c: Candidate): boolean => {
  const lo = A('SCALE_MIN')
  const hi = A('SCALE_MAX')
  const e = 0.01
  return c.sx <= lo + e || c.sy <= lo + e || c.sx >= hi - e || c.sy >= hi - e || Math.max(c.sx / c.sy, c.sy / c.sx) >= A('ASPECT_MAX') - e
}

/** the rows of a fitted structure: every node below the root, in path order */
function rowsOf(w: Whole, root: FitNode, choice: Choice): { rows: AlignRow[]; explained: number; unexplained: Residual } {
  const masks = new Map<string, Uint8Array>()
  for (const l of leavesOf(root)) if (choice.has(l.path)) masks.set(l.path, placedMask(l.glyph!, choice.get(l.path)!))
  const unionOf = (f: FitNode): Uint8Array | null => {
    const ls = leavesOf(f).filter((l) => masks.has(l.path))
    if (!ls.length) return null
    const u = new Uint8Array(CELLS)
    for (const l of ls) {
      const m = masks.get(l.path)!
      for (let k = 0; k < CELLS; k++) if (m[k]) u[k] = 1
    }
    return u
  }
  const all = unionOf(root) ?? new Uint8Array(CELLS)
  const cells = w.glyph.cells
  let explained = 0
  for (let k = 0; k < CELLS; k++) if (all[k] && w.glyph.grid[k]) explained++
  // leaves under an operator the placement still breaks (kept: the structure says they are there)
  const broken = new Set(brokenNodes(root, choice).flatMap((f) => leavesOf(f).map((l) => l.path)))
  const nodes: FitNode[] = []
  const collect = (f: FitNode) => f.children.forEach((c) => (nodes.push(c), collect(c)))
  collect(root)
  const rowOf = (c: FitNode, leafRows: ReadonlyMap<string, AlignRow>): AlignRow => {
    const region = { name: c.region!.name, within: rectOf(c.region!.within) }
    const base = { path: c.path, depth: c.depth, parentOp: c.parentOp!, index: c.index, region }
    if (c.node.kind === 'leaf') {
      const node = { kind: 'leaf' as const, char: c.node.char, tier: c.node.tier }
      const chosen = choice.get(c.path)
      if (!chosen) {
        // no glyph to place (unencoded, or not in the face), or a glyph with no room: the region the
        // structure leaves it is smaller than the scale limits let it be drawn
        const because: AlignReason[] = [c.node.tier === 'unknown' ? 'unencoded' : c.glyph ? 'no-room' : 'not-in-face']
        return { ...base, node, status: 'unavailable', because, unexplainedInRegion: residual(w.glyph.grid, cells, all, null, all, c.region!.within) }
      }
      const m = measures(w, chosen)
      const amb = ambiguity(root, c, choice, w)
      const because: AlignReason[] = []
      if (m.precision < A('PRECISION_MIN')) because.push('low-precision')
      if (m.lift < A('LIFT_MIN')) because.push('low-lift')
      if (atLimit(chosen)) because.push('at-scale-limit')
      if (amb > A('AMBIGUITY_MAX')) because.push('ambiguous')
      if (broken.has(c.path)) because.push('operator-broken')
      if (c.node.tier === 'stroke') because.push('stroke-form')
      if (unplacedSibling(root, c.path, choice)) because.push('sibling-unplaced')
      const mask = masks.get(c.path)!
      return {
        ...base,
        node,
        status: because.length ? 'approximate' : 'aligned',
        because,
        glyph: { char: c.glyph!.char, half: { w: r2(c.glyph!.half.w), h: r2(c.glyph!.half.h) } },
        transform: { sx: r3(chosen.sx), sy: r3(chosen.sy), dx: r2(chosen.dx), dy: r2(chosen.dy) },
        box: rectOf(chosen.box),
        ink: { explained: r3(m.explained), precision: r3(m.precision), lift: r3(m.lift), shared: r3(sharedShare(root, c, choice)) },
        confidence: r3(m.lift * (1 - amb)),
        residual: c.depth === 1 ? residual(w.glyph.grid, cells, mask, chosen.box, mask) : undefined,
      }
    }
    // a subtree has no glyph of its own: its box is the union of its placed parts, its status follows from theirs
    const node = { kind: 'op' as const, op: c.node.op, ids: idsOf(c.node) }
    const parts = leavesOf(c).map((l) => leafRows.get(l.path)!)
    const u = unionOf(c)
    const box = boxOf(c, choice)
    if (!u || !box) return { ...base, node, status: 'unavailable', because: ['no-part-placed'] }
    const because: AlignReason[] = []
    if (parts.some((p) => p.status === 'approximate')) because.push('part-approximate')
    if (parts.some((p) => p.status === 'unavailable')) because.push('part-unavailable')
    let ex = 0
    for (let k = 0; k < CELLS; k++) if (u[k] && w.glyph.grid[k]) ex++
    const placed = parts.filter((p) => p.confidence !== undefined)
    return {
      ...base,
      node,
      status: because.length ? 'approximate' : 'aligned',
      because,
      box: rectOf(box),
      ink: { explained: r3(ex / cells) },
      confidence: Math.min(...placed.map((p) => p.confidence!)),
      residual: c.depth === 1 ? residual(w.glyph.grid, cells, u, box, u) : undefined,
    }
  }
  const leafRows = new Map<string, AlignRow>()
  for (const c of nodes) if (c.node.kind === 'leaf') leafRows.set(c.path, rowOf(c, leafRows))
  const rows = nodes.map((c) => leafRows.get(c.path) ?? rowOf(c, leafRows))
  const unexplained = residual(w.glyph.grid, cells, all, null, all)
  return { rows, explained: r3(explained / cells), unexplained }
}

/** the align-1 entry of one character */
export function alignEntry(entry: StructureEntry, glyphOf: (char: string) => Glyph | null): AlignEntry {
  const char = entry.char
  const provenance: Provenance[] = [{ kind: 'table', table: 'structure-1', key: char }]
  if (!entry.structure) return { char, status: 'no-structure', provenance, rows: [] }
  const tree = entry.structure.tree
  if (tree.kind === 'leaf') return { char, status: 'atomic', provenance, rows: [] }
  const g = glyphOf(char)
  if (!g) {
    const rows: AlignRow[] = []
    const walk = (n: IdsNode, path: string, depth: number) => {
      if (n.kind !== 'op') return
      n.children.forEach((c, i) => {
        const p = path === '' ? String(i) : `${path}.${i}`
        const node = c.kind === 'leaf' ? { kind: 'leaf' as const, char: c.char, tier: c.tier } : { kind: 'op' as const, op: c.op, ids: idsOf(c) }
        rows.push({ path: p, depth: depth + 1, node, parentOp: n.op, index: i, region: { name: regionName(n.op, i) }, status: 'unavailable', because: ['whole-not-in-face'] })
        walk(c, p, depth + 1)
      })
    }
    walk(tree, '', 0)
    return { char, status: 'whole-not-in-face', provenance, rows }
  }
  const w = wholeOf(g)
  const { root, choice: fitted } = fitTree(tree, w, glyphOf)
  const choice = refine(root, w, fitted)
  const { rows, explained, unexplained } = rowsOf(w, root, choice)
  return { char, status: 'fitted', provenance: [...provenance, MEASURE], whole: { half: { w: r2(g.half.w), h: r2(g.half.h) }, ink: g.cells }, explained, unexplained, rows }
}
