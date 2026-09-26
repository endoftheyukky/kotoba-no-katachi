/**
 * SpatialPlan (spec-1 §7): a relational grammar. Rules compile constraints into
 * primitives; one Discovery may give several candidates; the choice is
 * deterministic (§7.3), never random and never by look.
 */
import type { RULE_ORDER } from '../spec'
import type { ConstraintId, ConstraintKind } from './constraints'
import type { IdsOperator } from './structure'

export type RuleName = (typeof RULE_ORDER)[number]

export type Primitive =
  | { kind: 'field'; unit: string; role: 'base' | 'container' | 'contained' | 'core' | 'unit' }
  | { kind: 'singleton'; item: string; locus: 'side' | 'crossing' | 'site' | 'remainder' }
  | { kind: 'region'; item: string; place: 'band' | 'outer' | 'inner' | 'part' }
  | { kind: 'boundary'; between: readonly [string, string]; axis: 'vertical' | 'horizontal' | 'ring' | 'u' }
  | { kind: 'enclosure'; op: IdsOperator }
  | { kind: 'intersection'; as: 'absence-roads' }
  | { kind: 'separation'; axis: 'vertical' | 'horizontal' }
  | { kind: 'sequence'; of: readonly string[] }
  | { kind: 'repetition'; n: number; arrangement: string }
  /** defined, used by no v2.0 rule (reserved for relations between words and sounds) */
  | { kind: 'gradient'; from: string; to: string; axis: 'vertical' | 'horizontal' }

export type PrimitiveKind = Primitive['kind']

export interface PlanCandidate {
  rule: RuleName
  primitives: readonly Primitive[]
  /** the constraint kinds this rule exists to realise */
  realises: readonly ConstraintKind[]
  /** the constraints of this Discovery it does realise */
  satisfied: readonly ConstraintId[]
  /** primitives or properties no constraint asked for */
  unmotivated: readonly string[]
}

/** §7.3: sort by (unmotivated ASC, satisfied DESC, RULE_ORDER ASC) */
export interface PlanSelection {
  candidates: readonly PlanCandidate[]
  chosen: RuleName
  order: 'unmotivated-asc,satisfied-desc,rule-order'
}
