/**
 * FieldGeometry (spec-1 §8): how much of the page a plan uses and how it
 * breathes — each property with the cause that sets it. The minimum carrier is
 * the default; anything larger must be asked for.
 */
import type { SemanticAxis } from '../../language/semantic/axes'
import type { ConstName } from '../spec'
import type { ConstraintId } from './constraints'
import type { EvidenceId } from './provenance'
import type { ResonanceId } from './resonance'

/** a rectangle on the page (PAGE = 1000 units) */
export interface PageRect {
  x: number
  y: number
  w: number
  h: number
}

export type CauseRef =
  | { kind: 'constraint'; id: ConstraintId }
  | { kind: 'evidence'; id: EvidenceId | ResonanceId }
  | { kind: 'const'; name: ConstName }
  | { kind: 'aux'; table: 'axes-1'; axis: SemanticAxis }

export interface Cause {
  property: FieldProperty
  value: unknown
  because: CauseRef
}

export type FieldProperty =
  | 'extent' | 'inner' | 'count' | 'rows' | 'cols' | 'unitSize'
  | 'groups' | 'orientation' | 'singleton' | 'whitespace' | 'visibility' | 'scale'

export type Visibility = 'immediate' | 'hidden' | 'too-small' | 'too-many'

export interface FieldGeometry {
  name: string
  /** null for GlyphItself and Absent */
  extent: PageRect | null
  inner?: readonly PageRect[]
  count: number
  cols?: number
  rows?: number
  /** em size of a unit, page units */
  unitSize: number
  groups?: { n: number; op: string; gapUnits: number }
  orientation: 'rows' | 'columns' | 'blocks' | 'none'
  singleton?: {
    item: string
    cell?: { row: number; col: number }
    point?: { x: number; y: number }
    scale: number
    /** the derived character placed so that its base part lies where a base unit would */
    align?: 'base-part'
  }
  whitespace: readonly { region: PageRect; cause: CauseRef }[]
  visibility?: Visibility
  causes: readonly Cause[]
  satisfies: readonly string[]
  unmotivated: readonly string[]
}

/** §8.3: every candidate is kept; the chosen one has the fewest unmotivated properties, then the most satisfied */
export interface GeometrySelection {
  candidates: readonly FieldGeometry[]
  chosen: string
}
