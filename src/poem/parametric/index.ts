/**
 * v4 — one parametric generator (experiment, review only).
 *
 * Instead of choosing between separate compositions, a page is generated from
 * continuous parameters read from the title:
 *
 *   the figure    the title walked as one curve — line → arc → ring, with
 *                 corners, branches and eccentricity — and written `rows`
 *                 times, each writing a row of its own. At one row it is v1's
 *                 band or path; at many with no turning it is the grid; at many
 *                 with turning, a warped lattice. There is no threshold
 *                 between them (parametric/trace.ts).
 *   the page       how much of it the figure takes, where it stands, whether
 *                  the edge cuts it (parametric/paper.ts).
 *   the material   what the page is made of, placed in the figure's own
 *                  geometry (parametric/material.ts, parametric/frame.ts).
 */
import type { Rng } from '../../core/random'
import type { Analysis, Mark, Material } from '../types'
import { materialParams, traceParams } from './params'
import { figureOf, materialMarks, type MaterialParams } from './material'
import { traceGeometry, traceMarks, type TraceParams } from './trace'
import type { PaperParams } from './paper'

export type ParametricKind = 'trace' | 'lattice' | 'auto'

export interface ParametricApplied {
  /** kept for the study sheets: a figure of more than one row reads as a lattice */
  kind: 'trace' | 'lattice'
  params: TraceParams
  /** where the figure stands on the page */
  paper: PaperParams
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
 * One page: the figure, the page it stands on, and the material it is made of.
 * `kind` only forces the old reading for the sheets — 'trace' holds the figure
 * to one row, 'lattice' asks for at least two.
 */
export function parametricPage(
  a: Analysis,
  m: Material,
  kind: ParametricKind,
  rng: Rng,
  override: Partial<TraceParams> = {},
  material: Partial<MaterialParams> | null = null,
  /** the faces the page will be written in, applied to the figure before the material is placed */
  faces: (marks: Mark[]) => Mark[] = (marks) => marks,
): { marks: Mark[]; applied: ParametricApplied } {
  const units = m.tokens.flat()
  const t = traceParams(a, m, rng)
  const forced = kind === 'trace' ? { rows: 1 } : kind === 'lattice' ? { rows: Math.max(2, t.params.rows) } : {}
  const p: TraceParams = { ...t.params, ...forced, ...override }
  const { marks: drawn, put } = traceMarks(a, units, p)
  const g = traceGeometry(a, units, p)

  // the material: small marks in the figure's own geometry — on its ink, on the
  // loop at a fixed distance from the reading, or in dust that runs along it.
  // The figure is put in its faces first: which face a character is written in
  // decides its ink, and the material must not stand on ink that will be there.
  const figure = figureOf(faces(drawn))
  const mat = materialParams(a, m, figure.nucleus?.char ?? null, figure.nucleus?.grapheme)
  const mp = { ...mat.params, ...(material ?? {}) }
  // the frame the material is placed in: where the reading itself went
  const made = materialMarks(a, figure, mp, mat.chars, put)
  return {
    marks: [...made.figure, ...made.marks],
    applied: {
      kind: p.rows >= 2 ? 'lattice' : 'trace',
      params: p,
      paper: p.paper,
      material: mp,
      grains: made.grains,
      placed: made.placed,
      grounds: [...t.grounds, ...mat.grounds],
      put,
      curve: { at: g?.path.at ?? [], k: g?.k ?? 0, em: g?.em ?? 0 },
    },
  }
}

export type { TraceParams } from './trace'
export type { PaperParams } from './paper'
export type { MaterialParams } from './material'
