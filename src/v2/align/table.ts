/**
 * align-1: the fixed table of where structure-1's components lie in the
 * reading face (spec-1 §2.1 ink, §11.3, §16 Stage 3).
 *
 *   structure-1 = the truth of what exists
 *   align-1     = where, how deformed, and how much of the glyph it explains
 *
 * A row never says a component is absent. A component the fit could not place
 * well is `approximate`; one it could not place at all (no glyph of its own in
 * the reading face, or unencoded) is `unavailable` — and still exists.
 *
 * Geometry is in the whole glyph's em space as v1 measures it (EM = 100, the
 * ink centre at the origin, y down). A component's placement maps its own
 * glyph's em space into the whole's: x' = x·sx + dx, y' = y·sy + dy.
 */
import type { Rect } from '../../render/stage'
import type { EmPoint, Island } from '../types/observation'
import type { Provenance } from '../types/provenance'
import type { IdsOperator, Tier } from '../types/structure'

/** where an operator puts a child (build/regions.ts cuts the rectangle for it) */
export type RegionName =
  | 'left' | 'middle' | 'right' | 'top' | 'bottom'
  | 'surround' | 'inside'
  | 'surround-open-below' | 'inside-below'
  | 'surround-open-above' | 'inside-above'
  | 'surround-open-right' | 'inside-right'
  | 'wrap-upper-left' | 'inside-lower-right'
  | 'wrap-upper-right' | 'inside-lower-left'
  | 'wrap-lower-left' | 'inside-upper-right'
  | 'overlay'

export type AlignStatus = 'aligned' | 'approximate' | 'unavailable'

/** why a row is unavailable */
export type UnavailableReason =
  /** an unencoded component ({nn}): there is no glyph to place */
  | 'unencoded'
  /** the component's own code point is not in the reading face: no other character stands in for it */
  | 'not-in-face'
  /** the component has a glyph, but its region is smaller than the scale limits (SCALE_MIN) let it be drawn */
  | 'no-room'
  /** the whole character is not in the reading face */
  | 'whole-not-in-face'
  /** a subtree none of whose components could be placed */
  | 'no-part-placed'

/** why a row is approximate rather than aligned */
export type ApproximateReason =
  /** much of the placed glyph lies off the whole's ink */
  | 'low-precision'
  /** it lies on the ink little better than chance would */
  | 'low-lift'
  /** its scale reached the search's limit on an axis */
  | 'at-scale-limit'
  /** another placement explains the ink almost as well */
  | 'ambiguous'
  /** a stroke: its glyph is the stroke drawn alone (丶 a dot, 丿 short), not the form it takes in the character */
  | 'stroke-form'
  /** a sibling under its operator (not ⿻) has nothing placed: nothing held this placement on that side */
  | 'sibling-unplaced'
  /** no placement found keeps its operator (order, inside, anchors): the best that breaks it least */
  | 'operator-broken'
  /** a subtree: some of its parts are approximate */
  | 'part-approximate'
  /** a subtree: some of its parts are unavailable */
  | 'part-unavailable'

export type AlignReason = UnavailableReason | ApproximateReason

export type Side = 'left' | 'right' | 'above' | 'below' | 'within'

/** a piece of ink left over, with where it lies against the component taken away */
export interface ResidualPiece extends Island {
  side: Side
}

/** the whole's ink without a component (or without every placed component) */
export interface Residual {
  /** share of the whole's ink left, in pieces (slivers of a misfit excluded, as v1 relate does) */
  share: number
  box: Rect | null
  centroid: EmPoint | null
  pieces: readonly ResidualPiece[]
  /** how the pieces lie: none, one, in a row, in a column, or otherwise */
  distribution: 'none' | 'single' | 'row' | 'column' | 'scattered'
  /** a row or column of pieces with the component's own ink between each two (州 − 川: the dots between the strokes) */
  interleaved: boolean
}

export type AlignNode =
  | { kind: 'leaf'; char: string; tier: Tier }
  | { kind: 'op'; op: IdsOperator; ids: string }

export interface AlignRow {
  /** the node's path in structure-1's canonical tree ('0' the first child, '1.0' the first child of the second) */
  path: string
  depth: number
  node: AlignNode
  /** the operator this node stands under, and its place there */
  parentOp: IdsOperator
  index: number
  /** where the operator puts it: the expected region, and the rectangle the search was held to (none when there was no search) */
  region: { name: RegionName; within?: Rect }
  status: AlignStatus
  /** empty when aligned */
  because: readonly AlignReason[]
  /** a leaf placed: the glyph of its own code point (never another character's) */
  glyph?: { char: string; half: { w: number; h: number } }
  /** a leaf placed: its own em space into the whole's */
  transform?: { sx: number; sy: number; dx: number; dy: number }
  /** where it lies (a subtree: the union of its placed parts) */
  box?: Rect
  ink?: {
    /** share of the whole's ink it explains */
    explained: number
    /** a leaf: share of its placed ink that lies on the whole's ink */
    precision?: number
    /** a leaf: precision beyond what chance gives in its box (v1 relate's containment) */
    lift?: number
    /** a leaf: share of the ink it explains that a sibling explains too (not under ⿻) */
    shared?: number
  }
  /**
   * How sure the location and shape are (0–1): lift, less what another
   * placement would explain as well (a subtree: its least sure part).
   * Not whether the component exists.
   */
  confidence?: number
  /** a direct component (depth 1) placed: the whole without it (for addition: whole − base) */
  residual?: Residual
  /** an unavailable leaf: the whole's ink in its region that no placed component explains — ink, not a stand-in glyph */
  unexplainedInRegion?: Residual
}

export type EntryStatus =
  /** the structure's components were fitted (rows say how well) */
  | 'fitted'
  /** structure-1 has the character as a single component: nothing to place */
  | 'atomic'
  /** structure-1 has no structure for it (unsupported operator, malformed) */
  | 'no-structure'
  /** the character itself is not in the reading face */
  | 'whole-not-in-face'

export interface AlignEntry {
  char: string
  status: EntryStatus
  /** what every row of the entry was read from: structure-1's entry, and v1's measure of the glyphs */
  provenance: readonly Provenance[]
  /** v1 measure of the whole: half its ink box (em) and its ink area (em², on the 1 em grid) */
  whole?: { half: { w: number; h: number }; ink: number }
  /** share of the whole's ink its placed components explain together */
  explained?: number
  /** what none of them explains */
  unexplained?: Residual
  rows: readonly AlignRow[]
}

export interface AlignShard {
  entries: Readonly<Record<string, AlignEntry>>
}

export interface FontMeta {
  family: string
  weight: number
  style: string
  package: { name: string; version: string; integrity: string; license: string }
  /** sha256 of the face's CSS as bundled (its @font-face rules and unicode ranges) */
  css: { file: string; sha256: string }
  /** the face's font files: how many, and one sha256 over every file's name and sha256 in name order */
  files: { count: number; format: string; sha256: string }
  /** the files the render fetched (the subsets the table's glyphs came from) */
  fetched: readonly string[]
}

export interface RenderEnvironment {
  browser: { product: string; revision: string; userAgent: string; jsVersion: string }
  launcher: { file: string; sha256: string; flags: readonly string[] }
  page: { file: string; sha256: string }
  measure: { module: string; sha256: string; pxPerEm: number; canvas: number; ink: string; box: string }
  devicePixelRatio: number
  antialiasing: string
  platform: { os: string; arch: string }
  /** sha256 of every measured glyph as measured: the render's fingerprint */
  rasters: { glyphs: number; notInFace: readonly string[]; sha256: string }
}

export interface AlignManifest {
  id: 'align-1'
  spec: 'spec-1'
  generator: { tool: string; version: string }
  /** a font change is a new table: align-1 holds for this face and no other */
  face: string
  font: FontMeta
  render: RenderEnvironment
  structure: { id: 'structure-1'; sha256: string }
  grid: { cell: number; radius: number; inkCell: string }
  constants: Readonly<Record<string, { value: unknown; source: string }>>
  rules: Readonly<Record<string, string>>
  shards: { count: number; of: string; files: readonly { name: string; entries: number; bytes: number; sha256: string }[] }
  entries: number
  status: Readonly<Record<EntryStatus, number>>
  rows: { direct: Readonly<Record<AlignStatus, number>>; nested: Readonly<Record<AlignStatus, number>> }
  /** sha256 of the shard hashes, in shard order */
  sha256: string
}
