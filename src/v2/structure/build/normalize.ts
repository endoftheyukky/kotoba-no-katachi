/**
 * Build time only: normalisation (spec-1 §2.2).
 *   1. a component (no reading of its own) is opened into its own structure;
 *   2. a character or a variant is kept whole (the runtime view sees through it only to
 *      read a homogeneous repetition: src/v2/structure/view.ts);
 *   3. strokes appear only where the data writes them: nothing is opened into strokes
 *      unless its own IDS is written in strokes;
 *   4. a component never opens into itself (cycle guard), and never deeper than MAX_DEPTH.
 * The same parsed tree and the same source always give the same normalised tree.
 */
import type { IdsNode } from '../../types/structure'
import type { NormalizationStep } from '../table'

export const MAX_DEPTH = 8

/** how a component opens: its own parsed tree, or null when it has none (atomic, unsupported, unknown) */
export type Opener = (char: string) => { ids: string; tree: IdsNode } | null

export function normalize(tree: IdsNode, self: string, open: Opener): { tree: IdsNode; steps: NormalizationStep[] } {
  const steps: NormalizationStep[] = []
  const walk = (n: IdsNode, path: string, ancestry: ReadonlySet<string>, depth: number): IdsNode => {
    if (n.kind === 'op') {
      return { kind: 'op', op: n.op, children: n.children.map((c, i) => walk(c, path === '' ? String(i) : `${path}.${i}`, ancestry, depth + 1)) }
    }
    if (n.tier !== 'component') return n
    if (ancestry.has(n.char)) {
      steps.push({ kind: 'cycle-stop', path, char: n.char })
      return n
    }
    if (depth >= MAX_DEPTH) {
      steps.push({ kind: 'depth-stop', path, char: n.char })
      return n
    }
    const inner = open(n.char)
    if (!inner) return n
    steps.push({ kind: 'open-component', path, char: n.char, ids: inner.ids })
    return walk(inner.tree, path, new Set([...ancestry, n.char]), depth + 1)
  }
  return { tree: walk(tree, '', new Set([self]), 0), steps }
}
