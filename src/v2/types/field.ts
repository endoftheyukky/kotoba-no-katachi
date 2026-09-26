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
  /** added at Stage 8: a property of the fallback page, caused by nothing having been found (§10) */
  | { kind: 'fallback'; reason: string }

export interface Cause {
  property: FieldProperty
  value: unknown
  because: CauseRef
}

export type FieldProperty =
  | 'extent' | 'inner' | 'count' | 'rows' | 'cols' | 'unitSize'
  | 'groups' | 'orientation' | 'singleton' | 'whitespace' | 'visibility' | 'scale'
  // added at Stage 9
  | 'pitch' | 'titleUnit'

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
  /** added at Stage 8: what each rule's page is made of, decided here so that Layout decides nothing */
  detail?: FieldDetail
}

/** a field's grid on the page: the first cell's corner, the pitch along each axis, columns in groups of n with a gap */
export interface FieldGrid {
  x0: number
  y0: number
  sx: number
  sy: number
  n: number
  gap: number
}

/** the rule-specific parts of a geometry, all already caused by the properties above */
export interface FieldDetail {
  /** the grid a field's units stand on (FieldSingleton, FieldInterleave, RegionSplit, CrossRoads) */
  grid?: FieldGrid
  /** the unit a field repeats (a character, or a stroke unit cut from the whole) */
  unit?: string
  /** a stroke unit: the whole it is cut from, and the islands of its ink that are the units (align-1 ink) */
  strokeUnit?: { whole: string; islands: readonly number[] }
  /** unit points on the page, where a field is not a full grid (WholeEmerges: the lattice round the whole) */
  points?: readonly { x: number; y: number }[]
  /** grid cells left empty: the roads of CrossRoads, the clearance round an emerging whole */
  empty?: readonly { row: number; col: number }[]
  /** a mark that takes cells in place of units: the singleton, the emerging whole, the crossing */
  span?: { item: string; row: number; col: number; rows: number; cols: number; role: 'singleton' | 'whole' | 'interface' }
  /** a derived character written among the units of a row, at these column positions (FieldInterleave) */
  interleave?: { item: string; row: number; cols: readonly number[] }
  /** container units stand on these sides of the page's field (NestedRegions) */
  ring?: { item: string; sides: readonly ('top' | 'bottom' | 'left' | 'right')[]; inner: PageRect; innerCols: number; innerRows: number; innerItem: string }
  /** a band of the derived character on the delta's side (RegionSplit) */
  band?: { item: string; rect: PageRect; count: number }
  /** regions each holding marks of one item (Separation, the parts; GlyphItself, the whole) */
  parts?: readonly { item: string; rect: PageRect; count: number }[]
  /** a line of the title's graphemes (Sequence, Absent, and the rest of a longer title) */
  line?: { graphemes: readonly number[]; breaks: readonly number[]; rect: PageRect; size: number; axis: 'horizontal' | 'vertical'; role: 'word' | 'context' }
  /** the title's graphemes walked as a flow (field/flow.ts): each at its point, one size */
  flow?: { points: readonly { grapheme: number; x: number; y: number }[]; size: number; behaviours: readonly string[] }
  /** the rest of a longer title as flows, each attached to the figure (TODO-10) */
  flows?: readonly { points: readonly { grapheme: number; x: number; y: number }[]; size: number; behaviours: readonly string[] }[]
  /** the rest of a longer title, beside the figure in reading order (TODO-10) */
  rest?: readonly { graphemes: readonly number[]; breaks: readonly number[]; rect: PageRect; size: number; axis: 'horizontal' | 'vertical'; role: 'word' | 'context' }[]
  /** the interface whole of NestedRegions: its point and size, in the contained field's cell it takes */
  interfaceAt?: { item: string; x: number; y: number; size: number; cell?: { row: number; col: number } }
  /** title characters the figure's unit is: the unit at each point writes it (the others repeat it) */
  titleUnits?: readonly { grapheme: number; x: number; y: number }[]
}

/** §8.3: every candidate is kept; the chosen one has the fewest unmotivated properties, then the most satisfied */
export interface GeometrySelection {
  candidates: readonly FieldGeometry[]
  chosen: string
}
