/**
 * v4 — the lattice: one parametric arrangement that contains a grid, a warped
 * lattice and a field.
 *
 * v1 holds repetition in separate compositions — a grid (cells all the same
 * size at the same interval, an empty cell readable as empty), a band (one row
 * stepping away from the edge), a field (the title written on and on until it
 * covers a share of the page) — and the v2 lattice grammar adds a decay to the
 * grid's rows. Here they are one generator:
 *
 *   rows 1, regularity 1                a row (the band, the written line)
 *   rows 2–4, regularity 1, decay 0     a grid
 *   regularity < 1                      cells sized by what stands in them
 *   shear > 0                           rows offset: the repetition steps
 *   decay > 0                           the rows dwindle (the lattice grammar)
 *   rows many, spacing tight            a field
 *   curl > 0                            the rows bend as the reading returns
 *
 * A cell holds one unit of the title; a row is the title written once. Nothing
 * is random: every parameter is derived in parametric/params.ts.
 */
import { PAGE } from '../../render/stage'
import type { Analysis, Mark, Unit, Vec } from '../types'
import { directions, isWritten, unitMarks } from '../spatial/common'

export interface LatticeParams {
  /** how many times the title is written, one row each */
  rows: number
  /** 1: every cell the same width; 0: each cell as wide as its unit takes to say */
  regularity: number
  /** how far each row is offset along the writing, as a share of a cell */
  shear: number
  /** how much smaller each row is than the one before it */
  decay: number
  /** how far a row bends across its length, in turns */
  curl: number
  /** rows away from the first, as a share of a cell: how far apart the rows stand */
  spacing: number
  /** per unit: how long its cell is (its beats) */
  weights: number[]
}

const MARGIN = 0.07
const MIN_SIZE = 0.02

export function latticeMarks(a: Analysis, units: Unit[], p: LatticeParams, ): { marks: Mark[]; put: { grapheme: number; x: number; y: number; size: number; rotate: number }[] } {
  const { along, across } = directions(a)
  const n = units.length
  if (!n) return { marks: [], put: [] }
  const rows = Math.max(1, Math.round(p.rows))

  // cell lengths along the writing: even, or as long as each unit takes to say
  const cells = units.map((_, i) => p.regularity + (p.weights[i] ?? 1) * (1 - p.regularity))
  const rowLength = cells.reduce((s, c) => s + c, 0)
  const width = rowLength + Math.abs(p.shear) * (rows - 1)
  const height = 1 + p.spacing * (rows - 1)
  const room = (1 - 2 * MARGIN) * PAGE
  const cell = Math.min(room / Math.max(width, 1e-6), room / Math.max(height, 1e-6))
  const size = cell * 0.9

  const marks: Mark[] = []
  const put: { grapheme: number; x: number; y: number; size: number; rotate: number }[] = []
  // the figure is laid out around the page's centre
  const originAlong = -(rowLength * cell) / 2
  const originAcross = -((height - 1) * cell) / 2
  for (let r = 0; r < rows; r++) {
    const shrink = (1 - p.decay) ** r
    let atAlong = originAlong + p.shear * r * cell
    const atAcross = originAcross + p.spacing * r * cell
    for (const [i, u] of units.entries()) {
      const c = cells[i] * cell * shrink
      const centreAlong = atAlong + c / 2
      atAlong += c
      // the row bends: its own turning, spread along it
      const t = rowLength ? (centreAlong - originAlong) / (rowLength * cell) : 0
      const turn = 2 * Math.PI * p.curl * (t - 0.5)
      const dxAlong = centreAlong
      const dxAcross = atAcross + Math.sin(turn) * rowLength * cell * p.curl * 0.5
      const at: Vec = {
        x: PAGE / 2 + along.x * dxAlong + across.x * dxAcross,
        y: PAGE / 2 + along.y * dxAlong + across.y * dxAcross,
      }
      if (!isWritten(u)) continue
      const em = Math.max(MIN_SIZE * PAGE, size * shrink * (cells[i] >= 1 ? 1 : cells[i]))
      marks.push(...unitMarks(a, u, at, em))
      put.push({ grapheme: u.grapheme, x: at.x, y: at.y, size: em, rotate: 0 })
    }
  }
  return { marks, put }
}
