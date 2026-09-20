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
import { readInterior, type Interior } from '../glyph/interior'
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
import { basisOf, scopeOf } from './scope'
import { decideScale } from './scale'
import { axis } from './spatial/axis'
import { band } from './spatial/band'
import { centre } from './spatial/centre'
import { cluster } from './spatial/cluster'
import { field } from './spatial/field'
import { nest } from './spatial/nest'
import { radial } from './spatial/radial'
import { scattered } from './spatial/scattered'
import { voidSpace } from './spatial/void'
import type {
  Analysis,
  Composition,
  Material,
  OperationId,
  PoeticOperation,
  Proposal,
  Rejection,
  Realization,
  SpatialComposition,
  SpatialId,
  Unit,
} from './types'

export const OPERATIONS: readonly PoeticOperation[] = [proliferation, decomposition, transformation, absence]
export const SPACES: readonly SpatialComposition[] = [field, band, radial, axis, centre, nest, voidSpace, scattered, cluster]

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
/**
 * Above this a layer is settled: what it offers is good enough that nothing
 * below is consulted. Between the floor and here a layer holds the poem only
 * if nothing deeper is decisively stronger — at least DECISIVE times its best
 * and settled in its own right. Without this, a 0.33 relation between words
 * would shut out a 0.80 structure in the ink for good. (v1 heuristics.)
 */
export const SETTLED = 0.6
export const DECISIVE = 1.5
const MATERIAL = new Set<OperationId>(['decomposition', 'transformation'])
/**
 * Two ways of holding the material are near-equals within this; only then
 * does it matter which of them reads more of the feature. (v1 heuristic.)
 */
const FITNESS_EPS = 0.05
/** properties every composition needs anyway: they say nothing particular */
const GENERIC = new Set(['count', 'order'])
const specificity = (r: Realization) =>
  Math.min(1, r.uses.filter((u) => !GENERIC.has(u.property)).length / 3)

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
  // the inside of each letterform: enclosed white, a form returning in it
  const interiors = new Map<string, Interior>()
  for (const c of letters.keys()) interiors.set(c, readInterior(glyphs.get(c).metrics))
  return { ...language, glyphs, glyphRelations, readables, voicing, interiors }
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
    p.scope = scopeOf(a, p.focus)
    p.basis = basisOf(a, p.focus)
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
  //   4  + the inside of its letterforms: white, a form returning in the ink
  //
  // A variant is free to read any layer: that is what a variant is for.
  const capable = proposals.filter((p) => p.roles.primary)
  const exogenous = proposals.filter((p) => p.origin === 'exogenous')
  const rank = (ps: Proposal[]) => [...ps].sort((p, q) => q.poeticPotential! - p.poeticPotential!)
  const written = capable.filter((p) => p.level <= 2)
  const below = (n: number) => rank([...capable.filter((q) => q.level <= n), ...exogenous.filter((q) => q.level <= 2)])
  const layers = [
    written,
    rank([...written, ...exogenous.filter((p) => p.level <= 2)]),
    below(3),
    below(4),
    rank([...capable, ...exogenous]),
  ]
  // Soft descent. A shallow layer is still preferred, but a merely adequate
  // one no longer shuts the door for good: a candidate far below may take the
  // poem when it is decisively stronger than what the upper layer offers.
  let descent = 0
  let reason = ''
  // the best a layer above the adopted one offered, where one reached the page
  let overridden = 0
  let held: string[] = []
  const bestOf = (i: number) => layers[i][0]?.poeticPotential ?? 0
  const deepP = layers[layers.length - 1][0]
  const deepest = deepP?.poeticPotential ?? 0
  while (descent < layers.length - 1) {
    const upperP = layers[descent][0]
    const upper = upperP?.poeticPotential ?? 0
    if (upper >= SETTLED) {
      reason = `第${descent + 1}層が ${upper.toFixed(2)} ≥ ${SETTLED}：ここで確定し、下の層は見ない`
      break
    }
    if (upper < DESCENT_FLOOR) {
      reason = `第${descent + 1}層の最良が ${upper.toFixed(2)} < ${DESCENT_FLOOR}：紙面に届かないので降りる`
      descent++
      continue
    }
    if (deepest >= upper * DECISIVE && deepest >= SETTLED) {
      // A deeper candidate that reads the same observation again is not
      // independent evidence but a second reading of what is already on the
      // page: it may not displace it, however strong it measures.
      const shared = (upperP?.basis ?? []).filter((b) => (deepP?.basis ?? []).includes(b))
      if (shared.length) {
        held = shared
        reason = `第${descent + 1}層は ${upper.toFixed(2)}。下層に ${deepest.toFixed(2)} があるが、同じ観測（${shared.join('・')}）を読み直したものなので置き換えない`
        break
      }
      overridden = upper
      reason = `第${descent + 1}層は ${upper.toFixed(2)}（${DESCENT_FLOOR}〜${SETTLED}）だが、下層に独立した ${deepest.toFixed(2)} ≥ ${upper.toFixed(2)}×${DECISIVE} があり決定的に強い：降りる`
      descent++
      continue
    }
    reason = `第${descent + 1}層は ${upper.toFixed(2)}：下層に決定的に強いもの（${(upper * DECISIVE).toFixed(2)} 以上かつ ${SETTLED} 以上）がないので、浅い層を保つ`
    break
  }
  if (!reason) reason = `最下層まで降りた（最良 ${bestOf(descent).toFixed(2)}）`
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
  // Every way each composition could hold this material, not just its best.
  // A composition that has only one way keeps `fit`, wrapped here.
  const offers = SPACES.flatMap((s) => {
    if (s.offer) return s.offer(a, material)
    const f = s.fit(a, material)
    return f
      ? [
          {
            id: f.id,
            mode: 'default',
            uses: [],
            grounds: f.grounds,
            fitness: f.score,
            realisable: true,
            demand: { reach: 0.8, spread: 'mass' as const, minSize: 0 },
          },
        ]
      : []
  })
  // A hard gate first: a way the page cannot hold at a readable size is not a
  // way. Then fitness alone; specificity only separates near-equals, and is
  // capped so that naming more properties cannot by itself win.
  const fits = offers
    .filter((o) => o.realisable)
    .sort((x, y) => (Math.abs(y.fitness - x.fitness) > FITNESS_EPS ? y.fitness - x.fitness : specificity(y) - specificity(x)))
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
    descent: { layer: descent + 1, reason, adopted: bestOf(descent), upper: overridden, deepest, held },
    absent: tokens.flat().filter((u) => u.absent).map((u) => u.grapheme),
    proposals,
    fits,
    rejected,
    draft: { marks: placed.marks },
  }
}
