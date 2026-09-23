import type { Relation } from '../../language/analysis'
import type { Analysis } from '../types'

type Of<K extends Relation['kind']> = Extract<Relation, { kind: K }>

export function relationsOf<K extends Relation['kind']>(a: Analysis, kind: K): Of<K>[] {
  return a.relations.filter((r): r is Of<K> => r.kind === kind)
}

/** tokens joined by coordination (A と B と C) */
export function coordinated(a: Analysis): number[] {
  const members = new Set<number>()
  for (const r of relationsOf(a, 'coordination')) members.add(r.left).add(r.right)
  return [...members].sort((x, y) => x - y)
}

/** a dependency marked by one of these particles */
export function dependencyBy(a: Analysis, markers: string[]): Of<'dependency'> | undefined {
  return relationsOf(a, 'dependency').find((r) => markers.includes(a.tokens[r.marker].surface))
}

export const has = (a: Analysis, kind: Relation['kind']) => a.relations.some((r) => r.kind === kind)
