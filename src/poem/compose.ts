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
import { covers } from '../glyph/coverage'
import { COMPONENTS, STROKES } from '../glyph/legibility'
import { readInventory, readRelations, relate, RELATION_THRESHOLD, type GlyphRelation } from '../glyph/relation'
import { GlyphLibrary } from '../glyph/source'
import { analyzeLanguage } from '../language/analysis'
import { derivableChars } from '../language/lexicon'
import { neighbours, neighboursLoaded } from '../language/semantic'
import type { Segmenter } from '../language/segment'
import { titleSeed, type TitleInput } from '../title'
import { absence } from './operations/absence'
import { decomposition } from './operations/decomposition'
import { proliferation } from './operations/proliferation'
import { transformation } from './operations/transformation'
import { poeticPotential, visualPotential } from './potential'
import { withFaces } from './face'
import { formSpace } from './form'
import { parametricPage, type ParametricKind, type TraceParams } from './parametric'
import { RATIO_FLOOR } from './form/morph'
import { writeWith } from './grammar'
import { basisOf, scopeOf } from './scope'
import { decideScale } from './scale'
import { axis } from './spatial/axis'
import { band } from './spatial/band'
import { centre } from './spatial/centre'
import { cluster } from './spatial/cluster'
import { field } from './spatial/field'
import { grid } from './spatial/grid'
import { nest } from './spatial/nest'
import { path } from './spatial/path'
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
  GrammarId,
  Rejection,
  Realization,
  SpatialComposition,
  SpatialId,
  Unit,
} from './types'

export const OPERATIONS: readonly PoeticOperation[] = [proliferation, decomposition, transformation, absence]
export const SPACES: readonly SpatialComposition[] = [field, band, grid, path, radial, axis, centre, nest, voidSpace, scattered, cluster]

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
/**
 * Specificity compares what two ways of holding the material actually read.
 * A composition not yet moved to `offer` declares nothing, so the comparison
 * would be empty — and would hand every near-tie to whichever composition
 * happens to be migrated. Where any near-best cannot declare, fitness alone
 * decides.
 */

export async function analyze(input: TitleInput, segmenter?: Segmenter): Promise<Analysis> {
  const language = analyzeLanguage(input, segmenter)
  const glyphs = new GlyphLibrary()
  const own = language.graphemes.map((g) => g.char)
  // a kana written with a voicing mark needs the unvoiced character it
  // decomposes into: not an outside component, the character's own base
  const bases = [...new Set(language.phonology.flatMap((f) => (f.kind === 'voicing' ? [f.base] : [])))]
  // v2: what derived marks can be written in beyond the title's own characters —
  // the vowels a reading reduces to, and what the lexicon relates to the title
  // (v2d, review only) and, where the neighbour tables were loaded, the title's neighbours
  const nearby = neighboursLoaded() ? own.flatMap((c) => [...neighbours('aozora', c), ...neighbours('chive', c)].map((n) => n.char)) : []
  const derivable = [...new Set([...derivableChars(own), ...nearby])].filter((c) => covers('sans', c))
  await glyphs.prepare([...new Set([...own, ...COMPONENTS, ...STROKES, ...bases, ...derivable])])
  // the title written as writing, in the second face (poem/face.ts); derived
  // marks are writing too, whatever they are made of
  await glyphs.prepare([...new Set([...own.filter((c) => c.trim()), ...derivable, ...COMPONENTS].filter((c) => covers('serif', c)))], 'serif')
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

/**
 * Review only. Draw the poem the way a named composition would hold it,
 * instead of the way it was chosen. Nothing here takes part in the choice:
 * fitness, eligibility and geometry are the same whether or not it is used.
 */
export interface Force {
  op?: OperationId
  space?: SpatialId
  /** which of that composition's ways to draw ('run', 'turned', '2x2'…) */
  mode?: string
  /** how the marks behave inside it (v2): a grammar, or 'auto' for the v2 selection */
  grammar?: GrammarId | 'auto'
  /** v2, review only: let the multi-material grammars take material from the lexicon */
  semantic?: boolean
  /** v2, review only: draw a grammar's named way instead of the one its rule chooses (silhouette: fill, contour, density, residue) */
  variant?: string
  /** v2d experiment, review only: touch the page with meaning from this source (loadNeighbours() first for the vector sources) */
  semanticSource?: 'symbolic' | 'aozora' | 'chive' | 'hybrid'
  /**
   * v3 experiment, review only: after the page is drawn, deform it in the
   * continuous form space toward what the title's properties ask
   * (poem/form). `formGain` scales the pressures (1 by default).
   */
  form?: 'v3'
  formGain?: number
  /**
   * v4 experiment, review only: draw the page from a parametric generator
   * (poem/parametric) instead of from a composition and a grammar.
   * `params` overrides single parameters, for sweeps in the study sheet.
   */
  parametric?: ParametricKind
  params?: Partial<TraceParams> & Partial<import('./parametric').LatticeParams>
  /** v4 experiment, review only: override the material field's parameters */
  material?: Partial<import('./parametric').MaterialParams>
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
            // a composition with one fitness may still know which of its ways
            // this title asks for; it says so here, and nothing competes
            mode: f.mode ?? 'default',
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
  // Fitness alone gives the order — an epsilon band inside a comparator is
  // not a total order, and would leave the result to the sort's internals.
  // The tie-break is a separate step over the near-best, and only where every
  // one of them declares what it reads.
  const fits = offers.filter((o) => o.realisable).sort((x, y) => y.fitness - x.fitness)
  const near = fits.filter((r) => fits[0].fitness - r.fitness <= FITNESS_EPS)
  if (near.length > 1 && near.every((r) => r.uses.length > 0)) {
    const first = [...near].sort((x, y) => specificity(y) - specificity(x) || y.fitness - x.fitness)[0]
    fits.splice(fits.indexOf(first), 1)
    fits.unshift(first)
  }
  const wanted = (f: Realization) =>
    (!force.space || f.id === force.space) && (!force.mode || f.mode === force.mode)
  const spatial =
    ((force.space || force.mode) && fits.find(wanted)) || fits[Math.min(spaceRank, fits.length - 1)]
  const space = SPACES.find((s) => s.id === spatial.id)!
  const scale = decideScale(a, material, spatial.id)
  // Review only. A composition may know a way to draw that it does not offer
  // for selection; a force that names the composition and that way reaches
  // realize, and nothing else. With no force this is the realization itself.
  const drawn =
    force.mode && force.space === spatial.id && force.mode !== spatial.mode
      ? { ...spatial, mode: force.mode }
      : spatial
  const placed = space.realize(a, material, new Rng(seed).fork(spatial.id), scale, drawn)
  // v2: how the marks behave inside the composition. Without a named grammar
  // this is the composition's own marks, exactly as v1 wrote them.
  // v4, review only: the page drawn from continuous parameters instead
  const drawn4 = force.parametric
    ? parametricPage(a, material, force.parametric, new Rng(seed).fork('parametric'), force.params, force.material ?? null, (ms) => withFaces(a, material, ms))
    : null!
  const behaved = writeWith(force.grammar, a, material, drawn, placed, new Rng(seed).fork(`grammar:${force.grammar ?? 'uniform'}`), {
    semantic: force.semantic,
    variant: force.variant,
    semanticSource: force.semanticSource,
  })

  return {
    input: a.input,
    seed,
    primary,
    modifiers,
    spatial: drawn,
    scale,
    parameters: placed.parameters ?? [],
    contract: placed.contract ?? null,
    descent: { layer: descent + 1, reason, adopted: bestOf(descent), upper: overridden, deepest, held },
    absent: tokens.flat().filter((u) => u.absent).map((u) => u.grapheme),
    proposals,
    fits,
    rejected,
    grammar: behaved.applied,
    ...(force.parametric ? { parametric: drawn4.applied } : {}),
    ...shaped(a, force, seed, primary.op === 'proliferation', tokens, withFaces(a, material, force.parametric ? drawn4.marks : behaved.marks), () => {
      // v3: the composition that holds this title almost as well as the chosen one, if any
      const r = fits.find((f) => f !== spatial && f.id !== spatial.id && f.fitness >= RATIO_FLOOR * spatial.fitness)
      if (!r) return null
      const s = SPACES.find((x) => x.id === r.id)!
      const marks = withFaces(a, material, s.realize(a, material, new Rng(seed).fork(r.id), decideScale(a, material, r.id), r).marks)
      return { marks, label: `${r.id}/${r.mode}`, ratio: r.fitness / spatial.fitness }
    }),
  }
}

/** v3, review only: the drawn page moved in the form space — or the page itself, untouched */
function shaped(
  a: Analysis,
  force: Force,
  seed: number,
  repetition: boolean,
  tokens: Unit[][],
  marks: Composition['draft']['marks'],
  alternative: () => { marks: Composition['draft']['marks']; label: string; ratio: number } | null,
) {
  if (force.form !== 'v3') return { draft: { marks } }
  const absent = tokens.flat().filter((u) => u.absent).map((u) => u.grapheme)
  const f = formSpace(a, marks, { repetition, absent }, new Rng(seed).fork('form'), force.formGain ?? 1, alternative())
  return { draft: { marks: f.marks }, form: f.applied }
}
