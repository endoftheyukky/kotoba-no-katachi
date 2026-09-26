/**
 * Discovery Selection (spec-1 §4): gates per type, an order of types, a
 * canonical tie-break. Rarity is recorded, never weighed.
 */
import type { DiscoveryId } from './discovery'

/** the gates of §4.1, by name */
export type GateName =
  // internal repetition
  | 'repetition:unit-is-character'
  | 'repetition:homogeneous'
  | 'repetition:ink-alike-count'
  | 'repetition:stroke-explicit-subtree'
  | 'repetition:stroke-min-count'
  | 'repetition:stroke-regular'
  // addition
  | 'addition:one-character-base'
  | 'addition:delta-tier'
  | 'addition:delta-not-same-unit'
  | 'addition:base-scale'
  | 'addition:base-aspect'
  | 'addition:delta-share'
  | 'addition:delta-pieces'
  | 'addition:side-agrees'
  // enclosure and the rest
  | 'enclosure:contained-is-character'
  | 'enclosure:container-writable'
  | 'partial-enclosure:wrapper-is-variant'
  | 'partial-enclosure:core-is-character'
  | 'composition:distinct-characters'
  | 'intersection:two-strokes'
  | 'inter:both-written'
  | 'inter:relation-threshold'
  // added at Stage 11: a containment is an addition between two written characters
  | 'inter:structure-names-inner'
  | 'inter:delta-share'
  | 'inter:delta-pieces'
  // may never be primary in v2.0
  | 'type:not-primary-capable'

export interface Selection {
  /** null: nothing passed its gates (§10: the fallback, never a made-up Discovery) */
  primary: DiscoveryId | null
  /** Discoveries sharing a term with the primary */
  secondary: readonly DiscoveryId[]
  rejected: readonly { id: DiscoveryId; failed: readonly GateName[] }[]
  /** kept from the primary by F (a pictograph's graphic decomposition, §4.2) */
  demoted: readonly { id: DiscoveryId; by: 'origin:pictograph' }[]
  /** when primary is null: which gates the candidates stopped at */
  none?: { reason: string }
  /** rarity, recorded only (§4.3) */
  rarity?: Readonly<Record<string, number>>
}
