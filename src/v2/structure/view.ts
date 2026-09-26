/**
 * Runtime: seeing through a structure to a homogeneous repetition (spec-1 §2.2
 * rule 2). A character or a variant is kept whole in the normalised tree; only
 * here, to read a repetition, is it seen through — 森 = ⿱木林 reads as 木×3
 * through 林 — and the characters seen through are named.
 *
 * The unit's tier is carried, so a repetition of strokes (心 丶×2, 皿 丨×2, 雨
 * 丶×4) is never mistaken for a repetition of characters (品 口×3). This is a
 * view of the structure, not a Discovery: it chooses nothing.
 */
import type { IdsNode, IdsOperator, Tier } from '../types/structure'
import type { StructureLookup } from './lookup'

export interface Homogeneous {
  unit: string
  tier: Tier
  n: number
  /** the operators the repeated units are joined by, in the tree's order */
  ops: readonly IdsOperator[]
  /** the characters seen through to reach the units (林 for 森) */
  through: readonly string[]
}

export type Lookup = (char: string) => StructureLookup

/** a subtree written back as IDS (its identity as a unit) */
export function idsOf(n: IdsNode): string {
  return n.kind === 'leaf' ? n.char : n.op + n.children.map(idsOf).join('')
}

/** the units a subtree is made of, if they are all one unit; characters and variants are seen through only if they themselves repeat */
export function homogeneous(node: IdsNode, lookup: Lookup, seen: ReadonlySet<string> = new Set()): Homogeneous | null {
  if (node.kind === 'op') {
    const parts = node.children.map((c) => homogeneous(c, lookup, seen))
    const ps = parts.filter((p): p is Homogeneous => p !== null)
    if (ps.length !== parts.length || new Set(ps.map((p) => p.unit)).size !== 1) {
      // failing that, children that are the same subtree are one unit repeated, even an opened
      // component (羽 = ⿰习习, 习 opened): read only after the leaves, so 雨's dots stay 丶×4
      const shapes = node.children.map(idsOf)
      if (node.children.every((c) => c.kind === 'op') && new Set(shapes).size === 1) {
        return { unit: shapes[0], tier: 'component', n: node.children.length, ops: [node.op], through: [] }
      }
      return null
    }
    return {
      unit: ps[0].unit, tier: ps[0].tier, n: ps.reduce((s, p) => s + p.n, 0),
      ops: [node.op, ...ps.flatMap((p) => p.ops)],
      through: ps.flatMap((p) => p.through),
    }
  }
  const single: Homogeneous = { unit: node.char, tier: node.tier, n: 1, ops: [], through: [] }
  if ((node.tier === 'character' || node.tier === 'variant' || node.tier === 'component') && !seen.has(node.char)) {
    const r = lookup(node.char)
    if (r.status === 'found' && r.structure.tree.kind === 'op') {
      const inner = homogeneous(r.structure.tree, lookup, new Set([...seen, node.char]))
      if (inner && inner.n >= 2) return { ...inner, through: [node.char, ...inner.through] }
    }
  }
  return single
}

/** every subtree (the whole included) that is one unit repeated, outermost first; a repeated subtree's own parts are not listed again */
export function repeatedSubtrees(tree: IdsNode, lookup: Lookup): { path: string; repetition: Homogeneous }[] {
  const out: { path: string; repetition: Homogeneous }[] = []
  const walk = (n: IdsNode, path: string) => {
    if (n.kind !== 'op') return
    const h = homogeneous(n, lookup, new Set())
    if (h && h.n >= 2) {
      out.push({ path, repetition: h })
      return
    }
    n.children.forEach((c, i) => walk(c, path === '' ? String(i) : `${path}.${i}`))
  }
  walk(tree, '')
  return out
}
