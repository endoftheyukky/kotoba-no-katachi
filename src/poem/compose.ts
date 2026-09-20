/**
 * Title → analysis → proposals → primary operation (+ modifiers)
 *       → material → spatial composition → one page.
 *
 * Nothing about WHAT the poem is about is left to chance:
 *   - every proposal carries two separate measures: linguisticSalience (how
 *     prominent the relation is, as language) and visualPotential (how far the
 *     present operations and spaces can make it a strong, still legible
 *     structure). The primary operation is the proposal allowed to be primary
 *     with the highest poeticPotential = √(both); variant n takes the (n+1)-th;
 *   - a modifier is adopted when its linguistic salience reaches
 *     MODIFIER_SALIENCE and it can act on the material without replacing the
 *     subject;
 *   - the space is the one whose relations fit best; the scale regime is then
 *     decided on its own (poem/scale.ts).
 * The seed only moves plastic (造形) decisions inside the chosen space.
 */
import { Rng } from '../core/random'
import { COMPONENTS, STROKES } from '../glyph/legibility'
import { readInventory, readRelations, relate, RELATION_THRESHOLD, type GlyphRelation } from '../glyph/relation'
import { GlyphLibrary } from '../glyph/source'
import { analyzeLanguage } from '../language/analysis'
import type { Segmenter } from '../language/segment'
import { titleSeed, type TitleInput } from '../title'
import { absence } from './operations/absence'
import { decomposition } from './operations/decomposition'
import { proliferation } from './operations/proliferation'
import { transformation } from './operations/transformation'
import { poeticPotential, visualPotential } from './potential'
import { decideScale } from './scale'
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
/**
 * Feature descent. Below this, nothing found at the level above has reached
 * the page, and the poem may be built from what lies below it: the sound of
 * the title (level 3), and last of all a reading against a component the
 * title never writes (exogenous). Provisional heuristic (v1), not a
 * principle of the work.
 */
export const DESCENT_FLOOR = 0.32
const MATERIAL = new Set<OperationId>(['decomposition', 'transformation'])

export async function analyze(input: TitleInput, segmenter?: Segmenter): Promise<Analysis> {
  const language = analyzeLanguage(input, segmenter)
  const glyphs = new GlyphLibrary()
  const own = language.graphemes.map((g) => g.char)
  // a kana written with a voicing mark needs the unvoiced character it
  // decomposes into: not an outside component, the character's own base
  const bases = [...new Set(language.phonology.flatMap((f) => (f.kind === 'voicing' ? [f.base] : [])))]
  await glyphs.prepare([...own, ...COMPONENTS, ...STROKES, ...bases])
  const letters = new Map(own.filter((c) => c.trim()).map((c) => [c, glyphs.get(c).metrics]))
  // what a part of a glyph may be read as: the inventory, and the title's own characters
  const readables = new Map([...COMPONENTS, ...STROKES, ...letters.keys()].map((c) => [c, glyphs.get(c).metrics]))
  const inventory = new Map([...COMPONENTS, ...STROKES].map((c) => [c, glyphs.get(c).metrics]))
  const glyphRelations = [...readRelations(letters), ...readInventory(letters, inventory)].sort(
    (x, y) => y.score - x.score,
  )
  // ぜ = せ + ゛: read the voiced glyph against its own base, so that the
  // difference the poem draws is the voicing mark itself
  const voicing = new Map<string, GlyphRelation>()
  for (const f of language.phonology) {
    if (f.kind !== 'voicing' || voicing.has(f.voiced)) continue
    const inner = glyphs.get(f.base).metrics
    const outer = glyphs.get(f.voiced).metrics
    if (!inner.density || !outer.density) continue
    const r = relate(f.base, inner, f.voiced, outer)
    // the font must actually show the base inside the voiced character
    if (r.containment < RELATION_THRESHOLD) continue
    voicing.set(f.voiced, { ...r, kind: 'containment', origin: 'decomposition', score: r.containment })
  }
  return { ...language, glyphs, glyphRelations, readables, voicing }
}

export interface Force {
  op?: OperationId
  space?: SpatialId
}

export function compose(a: Analysis, force: Force = {}): Composition {
  const seed = titleSeed(a.input)
  const variant = a.input.variant ?? 0
  const byId = new Map(OPERATIONS.map((op) => [op.id, op]))
  const proposals = OPERATIONS.flatMap((op) => op.propose(a))
  for (const p of proposals) {
    p.visualPotential = visualPotential(a, p)
    p.poeticPotential = poeticPotential(p)
  }
  proposals.sort((p, q) => q.poeticPotential! - p.poeticPotential!)

  // primary: the highest poetic potential among those allowed to be primary;
  // variant n → the (n+1)-th.
  //
  // Feature descent. The poem is built from the highest layer that reaches
  // the page, and each layer is opened only when the one above it does not:
  //
  //   1  what the title writes, between words and between characters
  //   2  + a reading against a component the title never writes (exogenous)
  //   3  + the sound of the title
  //
  // A variant is free to read any layer: that is what a variant is for.
  const capable = proposals.filter((p) => p.roles.primary)
  const exogenous = proposals.filter((p) => p.origin === 'exogenous')
  const rank = (ps: Proposal[]) => [...ps].sort((p, q) => q.poeticPotential! - p.poeticPotential!)
  const written = capable.filter((p) => p.level <= 2)
  const layers = [
    written,
    rank([...written, ...exogenous.filter((p) => p.level <= 2)]),
    rank([...written, ...exogenous.filter((p) => p.level <= 2), ...capable.filter((p) => p.level === 3)]),
    rank([...capable, ...exogenous]),
  ]
  let descent = 0
  while (descent < layers.length - 1 && (layers[descent][0]?.poeticPotential ?? 0) < DESCENT_FLOOR) descent++
  const eligible = variant > 0 ? layers[layers.length - 1] : layers[descent]
  const ranked = force.op ? eligible.filter((p) => p.op === force.op) : eligible
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
    if (p.origin === 'exogenous' && !eligible.includes(p) && !p.roles.modifier) {
      reject('題の外の部品との関係：題自身の候補があるので主操作にしない')
      continue
    }
    if (p.op === primary.op) { reject('主操作と同じ操作'); continue }
    if (!p.roles.modifier) { reject(p.op === 'proliferation' ? '反復は紙面構成が担う（修飾にならない）' : '修飾として素材に書き込めない'); continue }
    if (p.linguisticSalience.value < MODIFIER_SALIENCE) { reject(`linguisticSalience ${p.linguisticSalience.value.toFixed(2)} < ${MODIFIER_SALIENCE}`); continue }
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
  const scale = decideScale(a, material, spatial.id)
  const placed = space.realize(a, material, new Rng(seed).fork(spatial.id), scale)

  return {
    input: a.input,
    seed,
    primary,
    modifiers,
    spatial,
    scale,
    parameters: placed.parameters ?? [],
    contract: placed.contract ?? null,
    proposals,
    fits,
    rejected,
    draft: { marks: placed.marks },
  }
}
