/**
 * Niikuni benchmark, controls and generalisation cases (spec-1 §15.1), as
 * expected Discovery structure at Stage 1. Fixed by a person from the pre-v2
 * verification; nothing here was generated, and no rule reads the set a case
 * belongs to.
 *
 * Structure: BabelStone IDS (2025-06-27, the Japanese source preferred), as
 * normalised by §2.2. Ink: the joint fit in Noto Sans JP 500. Resonance: L0 / L1
 * only; the rows that depend on character-origin data hold only once TODO-11
 * settles which source that is.
 */
import type { BenchmarkCase, FixtureProvenance } from './types'

const P: FixtureProvenance = {
  kind: 'human-benchmark',
  spec: 'spec-1',
  section: '§15.1',
  basis: 'pre-v2 verification: IDS structure, joint structure–ink fit, L0/L1 semantic evidence',
}

const WN = 'wordnet-jpn' as const
const ORIGIN = 'char-origin' as const
const SCHEMA = 'chive-schema' as const

export const CASES = [
  // ------------------------------------------------------------------ benchmark
  {
    title: '雨', set: 'benchmark', provenance: P,
    expect: {
      primary: { value: { type: 'internal_repetition', unit: '丶', unitTier: 'stroke', n: 4, arrangement: '2x2', remainder: '冂' } },
      resonance: [{ value: { type: 'part-referent', distance: 'L0', origin: WN, terms: ['雨', '雨滴'] } }],
    },
  },
  {
    title: '闇', set: 'benchmark', provenance: P,
    expect: {
      primary: { value: { type: 'enclosure', container: '門', contained: '音', operator: '⿵' } },
      resonance: [
        { value: { type: 'schema', distance: 'L1', origin: SCHEMA, terms: ['闇', 'CONTAINER'] } },
        { value: { type: 'lexical-candidate', distance: 'L0', origin: ORIGIN, terms: ['闇', '音'] }, when: ['TODO-11'] },
      ],
    },
  },
  {
    title: '淋', set: 'benchmark', provenance: P,
    expect: {
      primary: { value: { type: 'addition', base: '林', delta: ['氵'], side: 'left', count: 1 } },
      secondary: [{ value: { type: 'nested', term: '林', holds: { type: 'internal_repetition', unit: '木', unitTier: 'character', n: 2, arrangement: '⿰', remainder: null } } }],
      resonance: [
        { value: { type: 'part-referent', distance: 'L0', origin: WN, terms: ['林', '木'] } },
        { value: { type: 'lexical-candidate', distance: 'L0', origin: ORIGIN, terms: ['淋', '林'] }, when: ['TODO-11'] },
      ],
      excluded: [
        { distance: 'L2', from: '氵', to: '涙', note: 'water → tears is an association no resource states' },
        { distance: 'L3', from: '林 + 氵', to: 'さびしさ', note: 'the loneliness of one tear among trees is a reading, not evidence' },
      ],
    },
  },
  {
    title: '林', set: 'benchmark', provenance: P,
    expect: {
      primary: { value: { type: 'internal_repetition', unit: '木', unitTier: 'character', n: 2, arrangement: '⿰', remainder: null } },
      resonance: [
        { value: { type: 'part-referent', distance: 'L0', origin: WN, terms: ['林', '木'] } },
        { value: { type: 'schema', distance: 'L1', origin: SCHEMA, terms: ['林', 'MULTITUDE'] } },
      ],
    },
  },
  {
    title: '州', set: 'benchmark', provenance: P,
    expect: {
      primary: {
        value: { type: 'addition', base: '川', delta: ['丶', '丶', '丶'], side: 'interleaved', count: 3, arrangement: 'row' },
        note: 'the delta is unencoded in the Japanese IDS ({86}); another source names it (⿻川⿲丶丶丶)',
      },
      resonance: [{ value: { type: 'part-referent', distance: 'L0', origin: ORIGIN, terms: ['州', '川'] }, when: ['TODO-11'] }],
    },
  },
  {
    title: '血', set: 'benchmark', provenance: P,
    expect: {
      primary: { value: { type: 'addition', base: '皿', delta: ['㇒'], side: 'top', count: 1 } },
      resonance: [{ value: { type: 'part-referent', distance: 'L0', origin: ORIGIN, terms: ['血', '㇒'] }, when: ['TODO-11'] }],
    },
  },
  {
    title: '囚', set: 'benchmark', provenance: P,
    expect: {
      primary: { value: { type: 'enclosure', container: '囗', contained: '人', operator: '⿴' } },
      resonance: [
        { value: { type: 'component-whole', distance: 'L0', origin: ORIGIN, terms: ['囚', '囗', '人'] }, when: ['TODO-11'] },
        { value: { type: 'schema', distance: 'L1', origin: SCHEMA, terms: ['囚', 'CONTAINER'] } },
      ],
    },
  },
  {
    title: '辻', set: 'benchmark', provenance: P,
    expect: {
      primary: { value: { type: 'partial_enclosure', wrapper: '辶', core: '十', operator: '⿺' } },
      secondary: [{ value: { type: 'intersection', within: '十', strokes: ['一', '丨'] } }],
      notPrimary: [{ value: 'addition', note: 'the wrapper is half the ink: not a local difference' }],
      resonance: [{ value: { type: 'schema', distance: 'L0', origin: WN, terms: ['辻', '道'] } }],
    },
  },
  {
    title: '悲', set: 'benchmark', provenance: P,
    expect: {
      primary: { value: { type: 'composition', parts: ['非', '心'], operator: '⿱' } },
      resonance: [{ value: { type: 'lexical-candidate', distance: 'L0', origin: ORIGIN, terms: ['悲', '非'] }, when: ['TODO-11'] }],
      excluded: [{ distance: 'L3', from: '非 + 心', to: '心にあらず', note: 'reading the phonetic 非 as the word "not" is a metaphor' }],
    },
  },

  // ------------------------------------------------------------------ controls
  {
    title: '海', set: 'control', provenance: P,
    expect: {
      primary: { value: { type: 'addition', base: '毎', delta: ['氵'], side: 'left', count: 1 } },
      resonance: [
        { value: { type: 'radical-meaning', distance: 'L0', origin: WN, terms: ['海', '水'] } },
        { value: { type: 'lexical-candidate', distance: 'L0', origin: ORIGIN, terms: ['海', '毎'] }, when: ['TODO-11'] },
      ],
    },
  },
  {
    title: '問', set: 'control', provenance: P,
    expect: {
      primary: { value: { type: 'enclosure', container: '門', contained: '口', operator: '⿵' } },
      noResonance: [{ value: 'component-whole' }, { value: 'schema' }],
    },
  },
  {
    title: '田', set: 'control', provenance: P,
    expect: {
      primary: { value: null, when: ['TODO-11'], note: 'a pictograph: its 囗⊃十 is a graphic decomposition (F demotes it)' },
      candidates: [{ value: { type: 'enclosure', container: '囗', contained: '十', operator: '⿴' } }],
      resonance: [{ value: { type: 'origin', distance: 'L0', origin: ORIGIN, terms: ['田'] }, when: ['TODO-11'] }],
    },
  },
  {
    title: '品', set: 'control', provenance: P,
    expect: {
      primary: { value: { type: 'internal_repetition', unit: '口', unitTier: 'character', n: 3, arrangement: '⿱', remainder: null } },
      notPrimary: [{ value: 'addition', note: '口 + 口口 is the repetition, not an addition' }],
    },
  },
  {
    title: '森', set: 'control', provenance: P,
    expect: {
      primary: { value: { type: 'internal_repetition', unit: '木', unitTier: 'character', n: 3, arrangement: '⿱', remainder: null } },
      resonance: [
        { value: { type: 'part-referent', distance: 'L0', origin: WN, terms: ['森', '木'] } },
        { value: { type: 'schema', distance: 'L1', origin: SCHEMA, terms: ['森', 'MULTITUDE'] } },
      ],
    },
  },

  // ------------------------------------------------------------------ generalisation
  {
    title: '琳', set: 'generalization', provenance: P,
    expect: {
      primary: { value: { type: 'addition', base: '林', delta: ['𤣩'], side: 'left', count: 1 }, note: 'the same type as 淋: not telling them apart is correct' },
      secondary: [{ value: { type: 'nested', term: '林', holds: { type: 'internal_repetition', unit: '木', unitTier: 'character', n: 2, arrangement: '⿰', remainder: null } } }],
    },
  },
  {
    title: '淡', set: 'generalization', provenance: P,
    expect: {
      primary: { value: { type: 'addition', base: '炎', delta: ['氵'], side: 'left', count: 1 } },
      secondary: [{ value: { type: 'nested', term: '炎', holds: { type: 'internal_repetition', unit: '火', unitTier: 'character', n: 2, arrangement: '⿱', remainder: null } } }],
    },
  },
  {
    title: '間', set: 'generalization', provenance: P,
    expect: {
      primary: { value: { type: 'enclosure', container: '門', contained: '日', operator: '⿵' } },
      resonance: [{ value: { type: 'component-whole', distance: 'L0', origin: ORIGIN, terms: ['間', '門', '日'] }, when: ['TODO-11'] }],
    },
  },
  {
    title: '聞', set: 'generalization', provenance: P,
    expect: {
      primary: { value: { type: 'enclosure', container: '門', contained: '耳', operator: '⿵' } },
      noResonance: [{ value: 'schema' }, { value: 'component-whole', when: ['TODO-11'] }],
    },
  },
  {
    title: '回', set: 'generalization', provenance: P,
    expect: {
      primary: { value: null, when: ['TODO-11'], note: 'demoted only if the chosen origin source calls it a pictograph (the sources disagree)' },
      candidates: [{ value: { type: 'enclosure', container: '囗', contained: '口', operator: '⿴' } }],
    },
  },
  {
    title: '困', set: 'generalization', provenance: P,
    expect: {
      primary: { value: { type: 'enclosure', container: '囗', contained: '木', operator: '⿴' } },
      resonance: [{ value: { type: 'component-whole', distance: 'L0', origin: ORIGIN, terms: ['困', '囗', '木'] }, when: ['TODO-11'] }],
    },
  },
  {
    title: '日', set: 'generalization', provenance: P,
    expect: {
      primary: { value: null, note: 'the contained is a stroke (一): no enclosure; ⿴ gives an addition no side' },
      candidates: [{ value: { type: 'enclosure', container: '囗', contained: '一', operator: '⿴' } }],
    },
  },
  {
    title: '系', set: 'generalization', provenance: P,
    expect: { primary: { value: { type: 'addition', base: '糸', delta: ['㇒'], side: 'top', count: 1 } } },
  },
  {
    title: '机', set: 'generalization', provenance: P,
    expect: {
      primary: { value: null, note: 'the delta (几) opens into strokes: the addition gate does not pass, and nothing else does' },
      notPrimary: [{ value: 'addition' }],
    },
  },
  {
    title: '春', set: 'generalization', provenance: P,
    expect: {
      primary: { value: null, note: 'the delta (𡗗) is a subtree and half the ink: the addition gate does not pass' },
      notPrimary: [{ value: 'addition' }],
    },
  },
] as const satisfies readonly BenchmarkCase[]

export type CaseTitle = (typeof CASES)[number]['title']
