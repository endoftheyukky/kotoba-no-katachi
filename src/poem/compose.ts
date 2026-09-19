/**
 * Title → analysis → proposals → primary operation (+ modifiers)
 *       → material → spatial composition → one page.
 *
 * Nothing about WHAT the poem is about is left to chance:
 *   - the primary operation is the proposal with the highest salience
 *     (variant n takes the (n+1)-th as an alternative reading);
 *   - a modifier is adopted when its salience reaches MODIFIER_SALIENCE and it
 *     can act on the material without replacing the subject;
 *   - the space is the one whose relations fit best.
 * The seed only moves plastic (造形) decisions inside the chosen space.
 */
import { Rng } from '../core/random'
import { readRelations } from '../glyph/relation'
import { GlyphLibrary } from '../glyph/source'
import { analyzeLanguage } from '../language/analysis'
import type { Segmenter } from '../language/segment'
import { titleSeed, type TitleInput } from '../title'
import { absence } from './operations/absence'
import { decomposition } from './operations/decomposition'
import { proliferation } from './operations/proliferation'
import { transformation } from './operations/transformation'
import { axis } from './spatial/axis'
import { band } from './spatial/band'
import { centre } from './spatial/centre'
import { cluster } from './spatial/cluster'
import { field } from './spatial/field'
import { radial } from './spatial/radial'
import { scattered } from './spatial/scattered'
import { voidSpace } from './spatial/void'
import type {
  Analysis,
  Composition,
  Fit,
  Material,
  OperationId,
  PoeticOperation,
  Proposal,
  Rejection,
  SpatialComposition,
  SpatialId,
  Unit,
} from './types'

export const OPERATIONS: readonly PoeticOperation[] = [proliferation, decomposition, transformation, absence]
export const SPACES: readonly SpatialComposition[] = [field, band, radial, axis, centre, voidSpace, scattered, cluster]

/** a modifier must be at least this salient to enter the poem */
export const MODIFIER_SALIENCE = 0.4
const MATERIAL = new Set<OperationId>(['decomposition', 'transformation'])

export async function analyze(input: TitleInput, segmenter?: Segmenter): Promise<Analysis> {
  const language = analyzeLanguage(input, segmenter)
  const glyphs = new GlyphLibrary()
  await glyphs.prepare(language.graphemes.map((g) => g.char))
  const letters = new Map([...glyphs.metrics()].filter(([c]) => c.trim()))
  return { ...language, glyphs, glyphRelations: readRelations(letters) }
}

export interface Force {
  op?: OperationId
  space?: SpatialId
}

export function compose(a: Analysis, force: Force = {}): Composition {
  const seed = titleSeed(a.input)
  const variant = a.input.variant ?? 0
  const byId = new Map(OPERATIONS.map((op) => [op.id, op]))
  const proposals = OPERATIONS.flatMap((op) => op.propose(a)).sort((p, q) => q.salience.value - p.salience.value)

  // primary: the most salient; variant n → the (n+1)-th
  const ranked = force.op ? proposals.filter((p) => p.op === force.op) : proposals
  const primary = ranked[variant % ranked.length]
  const spaceRank = Math.floor(variant / ranked.length)

  let tokens: Unit[][] = a.tokens.map((t) =>
    Array.from({ length: t.end - t.start }, (_, i) => ({ grapheme: t.start + i, token: t.index, char: a.graphemes[t.start + i].char })),
  )
  if (primary.op === 'absence') tokens = absence.apply(a, primary, tokens) ?? tokens

  // modifiers: decided by salience and fit with the primary, never by chance
  const rejected: Rejection[] = []
  const modifiers: Proposal[] = []
  // a primary that already changes the material (cut, subtracted) keeps that role to itself
  let materialSlot: Proposal | null = MATERIAL.has(primary.op) ? primary : null
  let subtractiveSlot: Proposal | null = null
  for (const p of proposals) {
    if (p === primary) continue
    const reject = (reason: string) => rejected.push({ proposal: p, reason })
    if (p.op === primary.op) { reject('主操作と同じ操作'); continue }
    if (p.op === 'proliferation') { reject('反復は紙面構成が担う（修飾にならない）'); continue }
    if (p.salience.value < MODIFIER_SALIENCE) { reject(`salience ${p.salience.value.toFixed(2)} < ${MODIFIER_SALIENCE}`); continue }
    const slot = MATERIAL.has(p.op) ? 'material' : 'subtractive'
    const taken = slot === 'material' ? materialSlot : subtractiveSlot
    if (taken) { reject(taken === primary ? '主操作がすでに素材を変えている（字形を二重に壊さない）' : `より強い「${taken.op}」が同じ役割を占める`); continue }
    const next = byId.get(p.op)!.apply(a, p, tokens)
    if (!next) { reject('素材の中に作用する対象がない'); continue }
    tokens = next
    modifiers.push(p)
    if (slot === 'material') materialSlot = p
    else subtractiveSlot = p
  }

  const material: Material = { tokens, primary, modifiers }
  const fits = SPACES.map((s) => s.fit(a, material))
    .filter((f): f is Fit => !!f)
    .sort((x, y) => y.score - x.score)
  const spatial = (force.space && fits.find((f) => f.id === force.space)) || fits[Math.min(spaceRank, fits.length - 1)]
  const space = SPACES.find((s) => s.id === spatial.id)!
  const marks = space.realize(a, material, new Rng(seed).fork(spatial.id))

  return { input: a.input, seed, primary, modifiers, spatial, proposals, fits, rejected, draft: { marks } }
}
