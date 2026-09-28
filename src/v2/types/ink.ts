/**
 * What FieldGeometry and Layout read of a face's ink observation (after Stage 11, for B3a): a character's whole
 * (its em box) and its direct components' placements and residuals, and — for the reading face only — its
 * islands. align-1 (the reading face) is such a view as it stands; serif-ink-1 (the writing face) gives the same
 * view of the serif, without islands. The rules that read it do not know which face it is: the face is chosen
 * before them, and the rules are the same.
 */
import type { Rect } from '../../render/stage'
import type { AlignEntry, AlignNode, AlignReason, AlignStatus } from '../align/table'
import type { IdsOperator } from './structure'
import type { EmPoint } from './observation'

export interface InkRowView {
  path: string
  depth: number
  node: AlignNode
  parentOp: IdsOperator
  index: number
  status: AlignStatus
  because: readonly AlignReason[]
  transform?: { sx: number; sy: number; dx: number; dy: number }
  box?: Rect
  residual?: { share: number; box: Rect | null; centroid: EmPoint | null; pieces: readonly { centroid: EmPoint }[] }
}

export interface InkEntryView {
  char: string
  whole?: { half: { w: number; h: number } }
  rows: readonly InkRowView[]
  /** the reading face only (align-1): islands, alike islands, crossings */
  ink?: AlignEntry['ink']
}

export interface InkView {
  /** the character's entry, or null when the table has none */
  entry(char: string): InkEntryView | null
}

/**
 * A view that records every character asked of it and whether it answered (B3a compares what the serif's
 * geometry read with what the reading face's read: a fact the serif does not hold is not filled in).
 */
export function recording(view: InkView): InkView & { asked: Map<string, boolean> } {
  const asked = new Map<string, boolean>()
  return {
    asked,
    entry(char: string) {
      const e = view.entry(char)
      asked.set(char, (asked.get(char) ?? false) || e !== null)
      return e
    },
  }
}
