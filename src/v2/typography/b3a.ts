/**
 * The serif-aware typography, B3a (after Stage 11; SwoN's direction of 2026-09-27): in principle the serif; the
 * reading face only for a structure that depends on the sans's anatomy, or that the serif does not hold as
 * surely as the sans. Prepared, not in use: v2 writes with B (the Safe Hybrid, c311b7c) until the canonical
 * serif-ink-1 exists and B3a is accepted (TYPOGRAPHY below). B3b (WholeEmerges in the serif) is not adopted.
 *
 *   linguistic input   the plan the title's relation chose (never the title itself), its geometry read in each face
 *   rule               the words: the serif, where the serif writes them (fixed: serif-ink-1 writing) and they are
 *                      at least SMALLEST_WRITING (layout/face.ts, unchanged). The structure (the figure, the units,
 *                      the repeats) is written in one face, all of it:
 *                        sans   the plan places a character by its sans anatomy: a base part on a unit
 *                               (FieldSingleton), the units' own lattice and cuts of the whole (WholeEmerges),
 *                               a band across the derived character (RegionSplit, SwoN 2026-09-27)
 *                        sans   a mark of it is cut (keep, shift, minus): a cut is a reading of the sans's ink
 *                        sans   the serif does not write one of its characters (fixed: serif-ink-1 writing)
 *                        sans   its geometry, read in the serif, asks for a character serif-ink-1 does not hold
 *                               where align-1 does (nothing is filled in)
 *                        sans   the relation it draws between two of the title's characters is not read in the
 *                               serif's own ink (v1 readRelations on serif-ink-1's rasters: the same kind, the same
 *                               two characters, at least RELATION_THRESHOLD)
 *                        sans   read in the serif, its geometry is another rule's, keeps fewer of the constraints,
 *                               has more unmotivated properties, or falls out of the visibility band the sans's did
 *                        serif  otherwise: the structure is laid out from the serif's own observation (the same
 *                               FieldGeometry rules, serif-ink-1 in place of align-1) and drawn in the serif
 *   visual output      the words and, where it holds, the structure in the thin serif; a structure that stands
 *                      on the sans's anatomy in the heavy sans
 *   sound output       none
 *
 * Every condition is a condition of the plan, its geometry or the fixed observations: no title, no character is
 * named, and nothing is measured in the reader's browser. Discovery, Selection and the Plan are not changed by the
 * face: they read structure-1 and align-1 only.
 */
import type { GlyphMetrics } from '../../glyph/metrics'
import { readRelations, RELATION_THRESHOLD, type GlyphRelation } from '../../glyph/relation'
import type { LanguageAnalysis } from '../../language/analysis'
import type { Meaning } from '../../language/semantic/axes'
import { geometry } from '../field'
import { layoutWithFaces } from '../layout'
import type { SerifInkIndex } from '../serif/lookup'
import type { Constraint } from '../types/constraints'
import type { Discovery } from '../types/discovery'
import { recording, type InkView } from '../types/ink'
import type { PlanCandidate, RuleName } from '../types/plan'

export type Typography = 'B' | 'B3a'

/** the typography v2 writes with. B3a only once the canonical serif-ink-1 exists and it is accepted (SwoN, 2026-09-27) */
export const TYPOGRAPHY: Typography = 'B'

/** plans whose structure stands on the reading face's anatomy (or, RegionSplit, is weaker in the serif): never serif */
export const SANS_PLANS: Readonly<Partial<Record<RuleName, B3aCause>>> = {
  FieldSingleton: 'anatomy:base-part',
  WholeEmerges: 'anatomy:lattice',
  RegionSplit: 'band',
}

/** plans with no structure to draw: the words only */
const NO_STRUCTURE: readonly RuleName[] = ['Sequence', 'Absent']

export type B3aCause =
  /** the structure drawn in the serif, laid out from serif-ink-1 */
  | 'serif'
  /** a Sequence or nothing found: there is no structure, only words */
  | 'no-structure'
  /** FieldSingleton: the derived character placed so that its base part lies on a unit */
  | 'anatomy:base-part'
  /** WholeEmerges: the units' own lattice in the whole, and stroke units cut from it (B3b not adopted) */
  | 'anatomy:lattice'
  /** RegionSplit: the band across the derived character (SwoN 2026-09-27) */
  | 'band'
  /** a mark of the structure is cut from a glyph's ink */
  | 'cut'
  /** the serif does not write a character of the structure */
  | 'no-writing-glyph'
  /** the serif geometry asked for a character serif-ink-1 does not hold, where align-1 answered */
  | 'not-observed'
  /** the relation drawn is not read in the serif's own ink */
  | 'relation-not-read'
  /** read in the serif, the geometry is another rule's, keeps fewer constraints or has more unmotivated properties */
  | 'geometry-differs'
  /** read in the serif, the geometry falls out of the visibility band the sans's was in */
  | 'visibility'

export interface B3aInput {
  plan: PlanCandidate
  constraints: readonly Constraint[]
  primary: Discovery | null
  /** align-1 (the reading face) */
  align: InkView
  serif: SerifInkIndex
  language: LanguageAnalysis
  rest: readonly number[]
  meaning?: Meaning | null
}

type Geometry = ReturnType<typeof geometry>

export interface B3aDecision {
  structure: 'serif' | 'sans'
  because: B3aCause
  /** the geometry the page is written with (the serif's where the structure is serif) */
  geometry: Geometry
  /** the primary the geometry was read with (an inter-character relation: its placement read in the serif) */
  primary: Discovery | null
  /** the face's ink the geometry was read in */
  ink: InkView
  /** the characters each geometry asked of its face's table, and whether it answered */
  reads: { sans: Readonly<Record<string, boolean>>; serif: Readonly<Record<string, boolean>> | null }
  /** the serif relation, where the plan draws one between two of the title's characters */
  relation?: GlyphRelation | null
}

/** v1 readRelations on the serif's own ink, from serif-ink-1's rasters (v1 relate reads only ink and density) */
export function serifRelation(p: Discovery, serif: SerifInkIndex): GlyphRelation | null {
  if (p.type !== 'inter_containment' && p.type !== 'inter_similarity') return null
  const r = p.relation
  const a = serif.glyph(r.inner)
  const b = serif.glyph(r.outer)
  if (!a || !b) return null
  // the first of the pair first, as v1 reads the title in its order (a similarity names the first as inner)
  const glyphs = new Map([[r.inner, a], [r.outer, b]]) as unknown as ReadonlyMap<string, GlyphMetrics>
  return readRelations(glyphs).find((x) => x.kind === r.kind && x.inner === r.inner && x.outer === r.outer && x.score >= RELATION_THRESHOLD) ?? null
}

const band = new Set(['too-small', 'too-many'])

export function b3a(a: B3aInput): B3aDecision {
  const sansInk = recording(a.align)
  const sans = geometry({ plan: a.plan, constraints: a.constraints, primary: a.primary, align: sansInk, language: a.language, rest: a.rest, meaning: a.meaning })
  const base = { geometry: sans, primary: a.primary, ink: a.align as InkView }
  const readsOf = (m: Map<string, boolean>) => Object.fromEntries([...m].sort(([x], [y]) => x.codePointAt(0)! - y.codePointAt(0)!))
  const keep = (because: B3aCause, serifReads: Record<string, boolean> | null = null, relation?: GlyphRelation | null): B3aDecision => ({
    structure: 'sans', because, ...base, reads: { sans: readsOf(sansInk.asked), serif: serifReads }, ...(relation !== undefined ? { relation } : {}),
  })
  const rule = a.plan.rule
  if (NO_STRUCTURE.includes(rule) || sans.chosen === 'nothing found') return keep('no-structure')
  const planCause = SANS_PLANS[rule]
  if (planCause) return keep(planCause)
  // the relation between two of the title's characters, read in the serif's own ink
  let primary = a.primary
  let relation: GlyphRelation | null | undefined
  if (primary && (primary.type === 'inter_containment' || primary.type === 'inter_similarity')) {
    relation = serifRelation(primary, a.serif)
    if (!relation) return keep('relation-not-read', null, null)
    primary = { ...primary, relation }
  }
  const serifInk = recording(a.serif.view)
  const serif = geometry({ plan: a.plan, constraints: a.constraints, primary, align: serifInk, language: a.language, rest: a.rest, meaning: a.meaning })
  const reads = readsOf(serifInk.asked)
  if ([...serifInk.asked].some(([c, got]) => !got && sansInk.asked.get(c))) return keep('not-observed', reads, relation)
  const s = sans.geometry
  const f = serif.geometry
  if (serif.chosen !== sans.chosen || !s.satisfies.every((id) => f.satisfies.includes(id)) || f.unmotivated.length > s.unmotivated.length) return keep('geometry-differs', reads, relation)
  if (f.visibility && band.has(f.visibility) && f.visibility !== s.visibility) return keep('visibility', reads, relation)
  // the structure's marks, as the serif geometry writes them: uncut, and every character written by the serif
  const laid = layoutWithFaces({ plan: a.plan, geometry: f, primary, align: a.serif.view, language: a.language, rest: a.rest })
  const structure = laid.marks.filter((_, i) => laid.layers[i] !== 'words')
  if (structure.some((m) => m.keep || m.shift || m.minus)) return keep('cut', reads, relation)
  if (structure.some((m) => !a.serif.writable(m.char))) return keep('no-writing-glyph', reads, relation)
  return { structure: 'serif', because: 'serif', geometry: serif, primary, ink: a.serif.view, reads: { sans: readsOf(sansInk.asked), serif: reads }, ...(relation !== undefined ? { relation } : {}) }
}
