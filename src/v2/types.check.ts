/**
 * Type-level checks for spec-1 (run by `tsc --noEmit`, as part of `npm run build`).
 *
 * Every `@ts-expect-error` below is a shape the types must refuse; if one ever
 * type-checks, the directive itself fails the build. The values at the end are
 * machine-shaped examples (what a later stage will generate), used by the unit
 * tests to follow evidence back to its source. They are not expectations: the
 * benchmark's expected values live in fixtures/cases.ts, in a different type.
 */
import type { AdditionPattern, BenchmarkCase } from './fixtures/types'
import type { Addition, Discovery, Enclosure, InternalRepetition } from './types/discovery'
import type { Constraint } from './types/constraints'
import type { ExcludedAssociation, SemanticEvidence } from './types/resonance'

// ------------------------------------------------------------ L0 / L1 against L2 / L3

export const l0: SemanticEvidence = {
  id: 'res:雨:has-part', type: 'part-referent', distance: 'L0', origin: 'wordnet-jpn',
  provenance: { kind: 'table', table: 'resonance-1', key: '雨' }, detail: '雨 has-part 雨滴', whole: '雨', unit: '雨滴', relation: 'has-part',
}

export const l1: SemanticEvidence = {
  id: 'res:囚:CONTAINER', type: 'schema', distance: 'L1', origin: 'chive-schema',
  provenance: { kind: 'table', table: 'resonance-1', key: '囚' }, detail: 'enclosure × CONTAINER', char: '囚', schema: 'CONTAINER', percentile: 99, structure: 'enclosure',
}

export const refusedL2: SemanticEvidence = {
  id: 'res:淋:tears', type: 'part-referent',
  // @ts-expect-error L2 is never SemanticEvidence
  distance: 'L2',
  origin: 'wordnet-jpn', provenance: { kind: 'rule', rule: 'resonance:association' }, detail: '氵 → 涙', whole: '淋', unit: '涙', relation: 'described',
}

export const refusedL3: SemanticEvidence = {
  id: 'res:悲:not-heart', type: 'component-whole',
  // @ts-expect-error L3 is never SemanticEvidence
  distance: 'L3',
  origin: 'char-origin', provenance: { kind: 'rule', rule: 'resonance:metaphor' }, detail: '非 + 心', whole: '悲', components: ['非', '心'], relation: 'described',
}

// @ts-expect-error an excluded association cannot be L0
export const refusedExcluded: ExcludedAssociation = { distance: 'L0', from: '氵', to: '涙', note: '' }

// @ts-expect-error a part-referent is L0 only (L1 is the schema's)
export const refusedPartReferentL1: SemanticEvidence = { ...l0, distance: 'L1' }

// ------------------------------------------------------------ Discoveries keep their terms

const ev = { id: 'ev:x', kind: 'structure', provenance: { kind: 'table', table: 'structure-1', key: 'x' }, detail: '' } as const

// @ts-expect-error an addition without a base
export const refusedAddition: Addition = {
  id: 'addition:0:x', type: 'addition', level: 'character', graphemes: [0], evidence: [ev], basis: ['x'],
  derived: { char: 'x', role: 'derived', tier: 'character' }, delta: [{ char: 'y', role: 'delta', tier: 'variant' }], side: 'left', count: 1,
  ink: { deltaShare: 0.1, deltaPieces: 1, baseScale: 0.9, baseAspect: 0.1, residueCentroid: { x: 0, y: 0 } },
}

export const refusedEnclosureOperator: Enclosure = {
  id: 'enclosure:0:x', type: 'enclosure', level: 'character', graphemes: [0], evidence: [ev], basis: ['x'],
  container: { char: '門', role: 'container', tier: 'character' }, contained: { char: '音', role: 'contained', tier: 'character' },
  // @ts-expect-error ⿰ is not an enclosing operator
  operator: '⿰',
}

export const refusedRole: Enclosure = {
  id: 'enclosure:0:x', type: 'enclosure', level: 'character', graphemes: [0], evidence: [ev], basis: ['x'],
  // @ts-expect-error a term in the wrong role
  container: { char: '門', role: 'base', tier: 'character' },
  contained: { char: '音', role: 'contained', tier: 'character' }, operator: '⿵',
}

// @ts-expect-error a Discovery has no score
export const refusedScore: Discovery = { ...({} as InternalRepetition), score: 0.73 }

// @ts-expect-error an expected pattern carries no evidence: expectations and generated values are different types
export const refusedPatternEvidence: AdditionPattern = { type: 'addition', base: '林', delta: ['氵'], side: 'left', count: 1, evidence: [ev] }

// @ts-expect-error a benchmark case is fixed by a person: it has no generated provenance
export const refusedCaseProvenance: BenchmarkCase['provenance'] = { kind: 'generated', spec: 'spec-1', section: '', basis: '' }

// @ts-expect-error a constraint names its cause
export const refusedConstraint: Constraint = { id: 'c:major:x', kind: 'major', term: '林', why: '' }

/** every Discovery type is handled: adding one to the union without handling it here fails the build */
export function exhaustive(d: Discovery): string {
  switch (d.type) {
    case 'internal_repetition': case 'addition': case 'composition': case 'enclosure': case 'partial_enclosure':
    case 'intersection': case 'nested': case 'inter_containment': case 'inter_similarity':
    case 'inflection': case 'coordination': case 'negation': case 'relation_word': case 'reduplication': case 'mirror':
    case 'echo': case 'voicing': case 'resegmentation': case 'cycle': case 'permutation': case 'homophony':
      return d.type
    default: {
      const never: never = d
      return never
    }
  }
}

// ------------------------------------------------------------ machine-shaped examples (not expectations)

export const SAMPLE_DISCOVERIES: readonly Discovery[] = [
  {
    id: 'addition:0:林|氵', type: 'addition', level: 'character', graphemes: [0], basis: ['structure:淋', 'ink:淋'],
    evidence: [
      { id: 'ev:淋:ids', kind: 'structure', provenance: { kind: 'table', table: 'structure-1', key: '淋' }, detail: '⿰氵林' },
      { id: 'ev:淋:residue', kind: 'ink', provenance: { kind: 'table', table: 'align-1', key: '淋' }, detail: 'residue after 林: 3 pieces on the left', value: 0.164 },
      { id: 'ev:淋:gate', kind: 'ink', provenance: { kind: 'const', name: 'ADDITION_MAX_DELTA_SHARE' }, detail: 'δ share within the gate' },
    ],
    base: { char: '林', role: 'base', tier: 'character' }, derived: { char: '淋', role: 'derived', tier: 'character' },
    delta: [{ char: '氵', role: 'delta', tier: 'variant' }], side: 'left', count: 1,
    ink: { deltaShare: 0.164, deltaPieces: 3, baseScale: 0.9, baseAspect: 0.26, residueCentroid: { x: -35, y: 1 } },
    nested: ['nested:0:林|木'],
  },
  {
    id: 'internal_repetition:0:丶', type: 'internal_repetition', level: 'character', graphemes: [0], basis: ['structure:雨', 'ink:雨'],
    evidence: [
      { id: 'ev:雨:ids', kind: 'structure', provenance: { kind: 'table', table: 'structure-1', key: '雨' }, detail: '⿻丅⿵冂⿰⿱丶丶⿱丶丶' },
      { id: 'ev:雨:alike', kind: 'ink', provenance: { kind: 'v1', module: 'glyph/parts', detail: 'islands' }, detail: '4 alike islands', value: 0.041 },
    ],
    unit: { char: '丶', role: 'unit', tier: 'stroke' }, n: 4, arrangement: '2x2',
    whole: { char: '雨', role: 'whole', tier: 'character' }, remainder: { char: '冂', role: 'remainder', tier: 'component' },
    unitTier: 'stroke',
    groupGeometry: { gapRatio: 1.14, nn: 36, across: 2, compression: 1, offsets: [{ x: -18, y: -1 }, { x: 18, y: -1 }, { x: -18, y: 19 }, { x: 17, y: 19 }] },
  },
  {
    id: 'echo:0:ん', type: 'echo', level: 'phonological', graphemes: [0, 1], basis: ['sound:ん'],
    evidence: [{ id: 'ev:echo', kind: 'sound', provenance: { kind: 'v1', module: 'language/phonology' }, detail: 'the mora ん returns' }],
    morae: [1, 3], unit: 'mora',
  },
]
