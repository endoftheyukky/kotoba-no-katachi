/**
 * Rationale (spec-1 §12): what decided what, from observation to marks. It
 * never acts on the page; the archive's output hash is of the marks alone.
 */
import type { Constraint } from './constraints'
import type { DiscoveryId } from './discovery'
import type { FieldGeometry } from './field'
import type { PlanCandidate, RuleName } from './plan'
import type { DataVersions } from './provenance'
import type { ExcludedAssociation, SemanticEvidence } from './resonance'
import type { GateName } from './selection'

export interface Rationale {
  version: 'v2'
  spec: 'spec-1'
  data: DataVersions
  observation: {
    /** character → the IDS it was read with (or null) */
    structure: Readonly<Record<string, string | null>>
    inkNotes: readonly string[]
  }
  discoveries: readonly { id: DiscoveryId; eligible: boolean; failed: readonly GateName[] }[]
  selection: { primary: DiscoveryId | null; secondary: readonly DiscoveryId[]; reason: string }
  resonance: readonly SemanticEvidence[]
  /** what a page does not claim (L2 / L3), when a reader might expect it to */
  excluded?: readonly ExcludedAssociation[]
  constraints: readonly Constraint[]
  plans: readonly PlanCandidate[]
  plan: RuleName
  geometries: readonly FieldGeometry[]
  geometry: string
  layout: { marks: number; notes: readonly string[] }
}
