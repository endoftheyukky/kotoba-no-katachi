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
import { latticeParams, materialParams, traceParams } from './params'
import { latticeMarks, type LatticeParams } from './lattice'
import { figureOf, materialMarks, type MaterialParams } from './material'
import { traceGeometry, traceMarks, type TraceParams } from './trace'

export type ParametricKind = 'trace' | 'lattice' | 'auto'

export interface ParametricApplied {
  kind: 'trace' | 'lattice'
  params: TraceParams | LatticeParams
  /** what the page is made of, and where it stands (poem/parametric/material.ts) */
  material: MaterialParams
  /** how many small marks the material field put on the page */
  grains: number
  /** what each placement asked for before the page sifted it (review) */
  placed: { form: number; ring: number; dust: number }
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
  material: Partial<MaterialParams> | null = null,
  /** the faces the page will be written in, applied to the figure before the material is placed */
  faces: (marks: Mark[]) => Mark[] = (marks) => marks,
): { marks: Mark[]; applied: ParametricApplied } {
  const units = m.tokens.flat()
  const lattice = latticeParams(a, m)
  const chosen = kind === 'auto' ? (lattice.params.rows >= 2 ? 'lattice' : 'trace') : kind
  // the figure: the title's own characters, on a curve or in a lattice
  const drawn =
    chosen === 'lattice'
      ? (() => {
          const p = { ...lattice.params, ...(override as Partial<LatticeParams>) }
          const { marks, put } = latticeMarks(a, units, p)
          return { kind: 'lattice' as const, params: p as TraceParams | LatticeParams, grounds: lattice.grounds, marks, put, curve: { at: [] as { x: number; y: number }[], k: 0, em: 0 } }
        })()
      : (() => {
          const t = traceParams(a, m, rng)
          const p = { ...t.params, ...(override as Partial<TraceParams>) }
          const { marks, put } = traceMarks(a, units, p)
          const g = traceGeometry(a, units, p)
          return { kind: 'trace' as const, params: p as TraceParams | LatticeParams, grounds: t.grounds, marks, put, curve: { at: g?.path.at ?? [], k: g?.k ?? 0, em: g?.em ?? 0 } }
        })()

  // the material: small marks in the figure's own geometry — on its ink, on the
  // loop at a fixed distance from the reading, or in dust that runs along it.
  // The figure is put in its faces first: which face a character is written in
  // decides its ink, and the material must not stand on ink that will be there.
  const figure = figureOf(faces(drawn.marks))
  const mat = materialParams(a, m, figure.nucleus?.char ?? null, figure.nucleus?.grapheme)
  const mp = { ...mat.params, ...(material ?? {}) }
  // the frame the material is placed in: where the reading itself went
  const made = materialMarks(a, figure, mp, mat.chars, drawn.put)
  return {
    marks: [...made.figure, ...made.marks],
    applied: {
      kind: drawn.kind,
      params: drawn.params,
      material: mp,
      grains: made.grains,
      placed: made.placed,
      grounds: [...drawn.grounds, ...mat.grounds],
      put: drawn.put,
      curve: drawn.curve,
    },
  }
}

export type { TraceParams } from './trace'
export type { LatticeParams } from './lattice'
export type { MaterialParams } from './material'
