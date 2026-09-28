/**
 * serif-ink-1: the fixed observations of the writing face (Noto Serif JP 300) that the serif-aware typography
 * (B3a) reads, so that a structure drawn in the serif is laid out from the serif's own ink without measuring
 * anything in the reader's browser. Made once, on the canonical environment (tools/v2/serif-ink.mjs), and frozen.
 *
 *   structure-1   the truth of what exists in a character (never read from here)
 *   align-1       where it stands in the reading face, Noto Sans JP 500 (unchanged, never regenerated)
 *   serif-ink-1   what the writing face draws: its v1 measure of a glyph, its v1 ink raster, and where
 *                 structure-1's direct components lie in it (align-1's own fit, run on the serif's rasters,
 *                 projected to what FieldGeometry reads)
 *
 * serif-ink-1 is not a structure source. A row never says a component exists: it is keyed by structure-1's tree
 * (path, index, char) and only says where the serif draws what structure-1 already says is there. What is not
 * observed here (a character outside the domain, a glyph the serif does not have, a row the fit could not place)
 * is not observed: nothing is filled in, and B3a keeps that structure in the reading face.
 *
 * Geometry is v1's em space (EM = 100, the ink centre at the origin, y down), as in align-1.
 */
import type { Rect } from '../../render/stage'
import type { AlignStatus, AlignReason, EntryStatus, FontMeta, RenderEnvironment } from '../align/table'
import type { EmPoint } from '../types/observation'
import type { IdsOperator, Tier } from '../types/structure'

/** a direct component (depth 1, a leaf) of structure-1's tree, where the serif draws it (align-1's fit, serif rasters) */
export interface SerifRow {
  /** the node's path in structure-1's canonical tree ('0', '1', …) */
  path: string
  depth: 1
  node: { kind: 'leaf'; char: string; tier: Tier }
  parentOp: IdsOperator
  index: number
  status: AlignStatus
  because: readonly AlignReason[]
  /** placed: its own em space into the whole's (x' = x·sx + dx, y' = y·sy + dy) */
  transform?: { sx: number; sy: number; dx: number; dy: number }
  box?: Rect
  /**
   * placed: how its ink lies on the whole's (as align-1 records it). No run-time rule reads these yet: they are kept
   * so that a serif placement can be told apart from a fit that took a neighbour's ink (the 辻 / 十 audit) without
   * measuring again
   */
  ink?: { explained: number; precision?: number; lift?: number; shared?: number }
  confidence?: number
  /** placed: the whole without it (what FieldGeometry reads: the delta's box, centroid and pieces) */
  residual?: { share: number; box: Rect | null; centroid: EmPoint | null; pieces: readonly { centroid: EmPoint }[] }
}

export interface SerifEntry {
  char: string
  /** the fit's status, as align-1's builder gives it for the serif (atomic, no-structure: no rows; whole-not-in-face: the serif has no glyph) */
  status: EntryStatus
  /** v1 measure of the glyph in the serif: half its ink box (em) and its ink per em square (every glyph the serif has) */
  measure?: { half: { w: number; h: number }; density: number }
  /** as align-1's builder records the whole it fitted (only a fitted entry has one, exactly as in align-1) */
  whole?: { half: { w: number; h: number }; ink: number }
  /** sha256 of the glyph's raster record as measured (rasters/NN.json): the glyph's fingerprint */
  raster?: string
  rows: readonly SerifRow[]
}

/** v1 measure's ink raster (alpha > 127), one bit per pixel, row-major, base64, as tools/v2/align/page.ts packs it */
export interface SerifRaster {
  w: number
  h: number
  left: number
  top: number
  px: number
  bits: string
}

export interface SerifEntryShard {
  entries: Readonly<Record<string, SerifEntry>>
}

export interface SerifRasterShard {
  entries: Readonly<Record<string, SerifRaster>>
}

/**
 * Which characters the writing face writes with a glyph of its own (v1 poem/face.ts writable), for every code point
 * the face declares: the declared ranges, and the few of them it draws empty where the reading face draws ink.
 */
export interface SerifWriting {
  /** the unicode ranges the face's CSS declares, merged, as [first, last] code points */
  ranges: readonly (readonly [number, number])[]
  /** how many code points the ranges hold, and how many of them were measured (every one but blank space) */
  codePoints: number
  measured: number
  /** declared, but drawn empty in the serif while the reading face draws ink: not written in the serif */
  unwritable: readonly string[]
  /** declared and drawn empty in both faces (v1 counts it as written) */
  emptyInBoth: readonly string[]
}

export interface ShardFile {
  name: string
  entries: number
  bytes: number
  sha256: string
}

export interface SerifInkManifest {
  id: 'serif-ink-1'
  spec: 'spec-1'
  /** the schema of the files; a change of schema or of any input is a new table (serif-ink-2 …) */
  schema: 1
  /**
   * true only when made on the canonical environment and every check passed (tools/v2/serif-ink.mjs); the runtime
   * refuses anything else
   */
  canonical: boolean
  generator: {
    tool: string
    version: string
    /** align-1's builder, run on the serif's rasters: its version and the sha256 of its sources */
    fit: { module: string; version: string; sha256: string }
    /** the projection from the fit to the rows kept here */
    project: { module: string; sha256: string }
  }
  face: string
  /** the writing face measured */
  font: FontMeta
  /** the reading face, measured only where the serif draws a declared character empty (writing.emptyInBoth) */
  readingFont: Omit<FontMeta, 'fetched'>
  render: RenderEnvironment
  /** the canonical environment the table was required to be made on, and what was found */
  environment: {
    required: { os: string; browser: string; font: string; weight: number; devicePixelRatio: number }
    found: { os: string; arch: string; node: string; browser: string; userAgent: string; devicePixelRatio: number }
  }
  /** the fixed tables read while building (structure-1) and checked unchanged (align-1, resonance-1) */
  inputs: {
    structure: { id: 'structure-1'; sha256: string }
    unchanged: readonly { id: string; sha256: string }[]
  }
  /** align-1's fit constants, as the fit ran with them (calibrated on Noto Sans JP 500; not re-fitted for the serif) */
  constants: unknown
  rules: Readonly<Record<string, string>>
  serialization: string
  domain: { of: string; entries: number; rasters: number }
  shards: { count: number; of: string; entries: readonly ShardFile[]; rasters: readonly ShardFile[] }
  writing: { file: string; bytes: number; sha256: string; codePoints: number; unwritable: number; emptyInBoth: number }
  status: Readonly<Record<EntryStatus, number>>
  rows: Readonly<Record<AlignStatus, number>>
  /** sha256 over every entry shard's sha256, then every raster shard's, then writing's, joined in that order */
  sha256: string
}
