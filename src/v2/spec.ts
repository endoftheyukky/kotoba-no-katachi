/**
 * The fixed orders and named constants of v2 GENERATOR SPEC spec-1.
 *
 * These are the spec's own values, written once so that every later stage
 * refers to them by name (appendix A). The provisional ones are marked with
 * the TODO that will settle them; settling one changes a value here, never the
 * architecture.
 */

/** the spec this code implements */
export const SPEC = 'spec-1' as const

/** Discovery Selection: the order types are tried in (§4.3); within one character addition and internal_repetition tie, and this order breaks the tie */
export const TYPE_ORDER = [
  'addition',
  'internal_repetition',
  'inter_containment',
  'inter_similarity',
  'enclosure',
  'composition',
  'partial_enclosure',
  'intersection',
] as const

/** SpatialPlan Selection: the last key of the order (§7.3) */
export const RULE_ORDER = [
  'FieldSingleton',
  'RegionSplit',
  'FieldInterleave',
  'NestedRegions',
  'Frame',
  'GlyphItself',
  'CrossRoads',
  'Separation',
  'WholeEmerges',
  'ScaleTransfer',
  'Sequence',
  'Absent',
] as const

/** Phonological Discovery types whose shape is reserved, not yet produced (TODO-6) */
export const RESERVED_PHONOLOGICAL = ['resegmentation', 'cycle', 'permutation', 'homophony'] as const

/** the structure × schema pairs whose L1 evidence is admitted in v2.0 (§5.2); others wait for TODO-8 */
export const ACTIVE_L1_PAIRS = [
  { structure: 'enclosure', schema: 'CONTAINER' },
  { structure: 'internal_repetition', schema: 'MULTITUDE' },
] as const

/** the local decisions the spec leaves open (§14); an expectation may hold only once one is settled */
export const TODOS = [
  'TODO-1', 'TODO-2', 'TODO-3', 'TODO-4', 'TODO-5', 'TODO-6', 'TODO-7',
  'TODO-8', 'TODO-9', 'TODO-10', 'TODO-11', 'TODO-12', 'TODO-13', 'TODO-14',
] as const
export type TodoId = (typeof TODOS)[number]

/** appendix A: every number a later stage uses, by name, with the TODO that may still move it */
export const CONSTANTS = {
  /** a difference must reach this many page units to be seen at all */
  TAU: { value: 10, todo: 'TODO-4' },
  /** up to this many units a single difference is seen at once */
  IMMEDIATE: { value: 40, todo: 'TODO-4' },
  /** up to this many it is hidden but can be found */
  HIDDEN: { value: 250, todo: 'TODO-4' },
  /** the composite at an interface, as a share of the unit */
  INTERFACE_SCALE: { value: 0.62, todo: 'TODO-5' },
  /** WholeEmerges: units apart, in units */
  UNIT_SPACING: { value: 1.3, todo: 'TODO-5' },
  /** groups apart, in units */
  GROUP_GAP: { value: 1.0, todo: 'TODO-5' },
  /** composition: the seam, as a share of the frame's height, before × (1 + severance) */
  SEAM_COEF: { value: 0.12, todo: 'TODO-5' },
  /** the frame's margin, page units */
  FRAME_MARGIN: { value: 80, todo: null },
  /** addition gate: the base stands at least this large in the derived character */
  ADDITION_MIN_BASE_SCALE: { value: 0.85, todo: null },
  /** addition gate: the base is distorted at most this much (|ln(sx / sy)|) */
  ADDITION_MAX_BASE_ASPECT: { value: 0.35, todo: null },
  /** addition gate: the delta takes at most this share of the ink */
  ADDITION_MAX_DELTA_SHARE: { value: 0.25, todo: null },
  /** addition gate: the delta is at most this many pieces */
  ADDITION_MAX_DELTA_PIECES: { value: 3, todo: null },
  /** internal repetition of strokes: fewer than this is never a Discovery (心, 皿) */
  STROKE_REPETITION_MIN: { value: 3, todo: null },
  /** L1: a schema percentile at or above this */
  L1_MIN_PERCENTILE: { value: 90, todo: null },
  // added at Stage 8, the page's few stylistic constants (docs/v2-decisions.md)
  /** GlyphItself: the character's side, as a share of the frame */
  GLYPH_ITSELF_SCALE: { value: 0.72, todo: 'TODO-5' },
  /** Sequence and the rest of a title: a character is at most this share of the frame */
  SEQUENCE_MAX_UNIT: { value: 0.16, todo: 'TODO-5' },
  /** Absent: the title's span, as a share of the page (v1's pages that found nothing: about 16%) */
  FALLBACK_SPAN: { value: 0.16, todo: 'TODO-9' },
  /** Absent: how far out from the centre toward the corner where reading ends (v1: about 0.85) */
  FALLBACK_OFFSET: { value: 0.85, todo: 'TODO-9' },
} as const satisfies Record<string, { value: number; todo: TodoId | null }>

export type ConstName = keyof typeof CONSTANTS
