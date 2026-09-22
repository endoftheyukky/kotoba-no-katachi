/**
 * v4 — parametric generators (experiment, review only).
 *
 * Instead of choosing between separate compositions, a page is generated from
 * continuous parameters read from the title. The trace (line → arc → ring, with
 * corners, branches and eccentricity) is the first; the lattice (grid → warped
 * lattice → field) follows the same idea in two dimensions.
 */
import type { Rng } from '../../core/random'
import type { Analysis, Mark, Material } from '../types'
import { latticeParams, traceParams } from './params'
import { latticeMarks, type LatticeParams } from './lattice'
import { traceGeometry, traceMarks, type TraceParams } from './trace'

export type ParametricKind = 'trace' | 'lattice' | 'auto'

export interface ParametricApplied {
  kind: 'trace' | 'lattice'
  params: TraceParams | LatticeParams
  grounds: string[]
  /** where each written unit went (review: the study sheet) */
  put: { grapheme: number; x: number; y: number; size: number; rotate: number }[]
  /** the curve in unit space, and the scale it was fitted by (review) */
  curve: { at: { x: number; y: number }[]; k: number; em: number }
}

/**
 * Which generator: a title whose repetition fills more than one row is held as
 * a lattice; everything else is a trace. At one row the two meet — a lattice of
 * one row is a trace that does not turn — so the choice is not a jump.
 */
export function parametricPage(
  a: Analysis,
  m: Material,
  kind: ParametricKind,
  rng: Rng,
  override: Partial<TraceParams> & Partial<LatticeParams> = {},
): { marks: Mark[]; applied: ParametricApplied } {
  const units = m.tokens.flat()
  const lattice = latticeParams(a, m)
  const chosen = kind === 'auto' ? (lattice.params.rows >= 2 ? 'lattice' : 'trace') : kind
  if (chosen === 'lattice') {
    const p = { ...lattice.params, ...(override as Partial<LatticeParams>) }
    const { marks, put } = latticeMarks(a, units, p)
    return { marks, applied: { kind: 'lattice', params: p, grounds: lattice.grounds, put, curve: { at: [], k: 0, em: 0 } } }
  }
  const { params, grounds } = traceParams(a, m, rng)
  const p = { ...params, ...(override as Partial<TraceParams>) }
  const { marks, put } = traceMarks(a, units, p)
  const g = traceGeometry(a, units, p)
  return { marks, applied: { kind: 'trace', params: p, grounds, put, curve: { at: g?.path.at ?? [], k: g?.k ?? 0, em: g?.em ?? 0 } } }
}

export type { TraceParams } from './trace'
export type { LatticeParams } from './lattice'
