/**
 * Build time only (tools/v2/structure.mjs): reading IDS strings. The runtime
 * never parses IDS; it reads structure-1.
 */
import type { IdsNode, IdsOperator, Tier } from '../../types/structure'

/** spec-1's operators and their arity */
export const ARITY: Readonly<Record<IdsOperator, number>> = {
  '⿰': 2, '⿱': 2, '⿲': 3, '⿳': 3, '⿴': 2, '⿵': 2, '⿶': 2, '⿷': 2, '⿸': 2, '⿹': 2, '⿺': 2, '⿻': 2,
}

/** IDCs the source uses that spec-1 does not name (Unicode 15.1+): an IDS with one is not made into a structure */
export const UNSUPPORTED_IDC: readonly string[] = ['⿼', '⿽', '⿾', '⿿', '㇯']

/** stroke tier (spec-1 §2.2): 一 丨 丿 丶 乙 and the other single strokes, and the CJK strokes block */
export const STROKES: readonly string[] = ['一', '丨', '丿', '丶', '乙', '亅', '乚', '乛']
export const isStroke = (c: string): boolean => STROKES.includes(c) || (c.length === 1 && c.codePointAt(0)! >= 0x31c0 && c.codePointAt(0)! <= 0x31ef)

export const isUnknown = (t: string): boolean => /^\{\d+\}$/.test(t)

/** code points, with {nn} kept whole */
export function tokens(ids: string): string[] {
  return ids.match(/\{\d+\}|[\s\S]/gu) ?? []
}

export interface TierRules {
  /** standalone characters (KANJIDIC2 grade 1–10) */
  graded: ReadonlySet<string>
  /** forms written as a character of another code point (囗 → 口) */
  writtenAs: ReadonlyMap<string, readonly string[]>
  /** forms a character takes as a radical (氵 → 水) */
  variantOf: ReadonlyMap<string, readonly string[]>
}

/** the tier of a leaf inside a structure (spec-1 §2.2): 一 inside a character is a stroke */
export function tierOf(char: string, r: TierRules): Tier {
  if (isUnknown(char)) return 'unknown'
  if (isStroke(char)) return 'stroke'
  if (r.graded.has(char) || r.writtenAs.has(char)) return 'character'
  if (r.variantOf.has(char)) return 'variant'
  return 'component'
}

export type ParseResult =
  | { status: 'ok'; tree: IdsNode }
  | { status: 'atomic'; tree: IdsNode }
  | { status: 'unsupported-operator' }
  | { status: 'malformed' }

/** parse one IDS; `self` is the character it describes (an IDS equal to it is atomic) */
export function parseIds(ids: string, self: string, r: TierRules, rootTier: Tier): ParseResult {
  const ts = tokens(ids)
  if (ts.length === 0) return { status: 'malformed' }
  if (ts.some((t) => UNSUPPORTED_IDC.includes(t))) return { status: 'unsupported-operator' }
  if (ts.length === 1 && ts[0] === self) return { status: 'atomic', tree: { kind: 'leaf', char: self, tier: rootTier } }
  let pos = 0
  const node = (): IdsNode | null => {
    const t = ts[pos++]
    if (t === undefined) return null
    if (t in ARITY) {
      const children: IdsNode[] = []
      for (let i = 0; i < ARITY[t as IdsOperator]; i++) {
        const c = node()
        if (!c) return null
        children.push(c)
      }
      return { kind: 'op', op: t as IdsOperator, children }
    }
    return { kind: 'leaf', char: t, tier: tierOf(t, r) }
  }
  const tree = node()
  if (!tree || pos !== ts.length) return { status: 'malformed' }
  if (tree.kind === 'leaf') return { status: 'malformed' }
  return { status: 'ok', tree }
}

/** a tree written back as IDS */
export function idsOf(n: IdsNode): string {
  return n.kind === 'leaf' ? n.char : n.op + n.children.map(idsOf).join('')
}

/** the leaves of a tree with their paths ('' is the root) */
export function leaves(n: IdsNode, path = ''): { path: string; char: string }[] {
  if (n.kind === 'leaf') return [{ path, char: n.char }]
  return n.children.flatMap((c, i) => leaves(c, path === '' ? String(i) : `${path}.${i}`))
}

/** two trees of the same shape except where `a` has an unknown leaf: those places in `b`, by path (null when the shapes differ) */
export function namedAtUnknowns(a: IdsNode, b: IdsNode, path = ''): { path: string; unknown: string; named: IdsNode }[] | null {
  if (a.kind === 'leaf' && isUnknown(a.char)) return [{ path, unknown: a.char, named: b }]
  if (a.kind === 'leaf' || b.kind === 'leaf') return a.kind === 'leaf' && b.kind === 'leaf' && a.char === b.char ? [] : null
  if (a.op !== b.op || a.children.length !== b.children.length) return null
  const out: { path: string; unknown: string; named: IdsNode }[] = []
  for (let i = 0; i < a.children.length; i++) {
    const r = namedAtUnknowns(a.children[i], b.children[i], path === '' ? String(i) : `${path}.${i}`)
    if (r === null) return null
    out.push(...r)
  }
  return out
}
