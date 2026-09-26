/**
 * Shape guards for v2 values: what the types say, checked at run time too, so
 * that a value built from data (a table row, a generated Discovery) can be
 * tested against spec-1 — and so that every source can be followed.
 */
import type { DiscoveryPattern, ResonancePattern } from './fixtures/types'
import { CONSTANTS, RESERVED_PHONOLOGICAL, TODOS } from './spec'
import type { Discovery } from './types/discovery'
import type { DataTableId, Provenance, V1Module } from './types/provenance'
import type { ResonanceDistance, ResonanceOrigin, RuntimeDistance, SemanticEvidence } from './types/resonance'

const nonEmpty = (s: unknown): boolean => typeof s === 'string' && s.length > 0

/** the terms a Discovery pattern must name, by type (empty when complete) */
export function missingInPattern(p: DiscoveryPattern): string[] {
  const miss: string[] = []
  const need = (ok: boolean, what: string) => { if (!ok) miss.push(what) }
  switch (p.type) {
    case 'internal_repetition':
      need(nonEmpty(p.unit), 'unit')
      need(p.n >= 2, 'n ≥ 2')
      need(p.unitTier === 'character' || p.n >= CONSTANTS.STROKE_REPETITION_MIN.value, 'a stroke unit repeats ≥ 3 times')
      need(p.remainder === null || nonEmpty(p.remainder), 'remainder')
      break
    case 'addition':
      need(nonEmpty(p.base), 'base')
      need(p.delta.length >= 1 && p.delta.every(nonEmpty), 'delta')
      need(p.count >= 1, 'count ≥ 1')
      need(p.side !== 'interleaved' || p.count === p.delta.length, 'interleaved: count = delta units')
      break
    case 'enclosure':
      need(nonEmpty(p.container), 'container')
      need(nonEmpty(p.contained), 'contained')
      break
    case 'partial_enclosure':
      need(nonEmpty(p.wrapper), 'wrapper')
      need(nonEmpty(p.core), 'core')
      break
    case 'composition':
      need(p.parts.length >= 2 && p.parts.every(nonEmpty), 'two or more parts')
      break
    case 'intersection':
      need(nonEmpty(p.within), 'within')
      need(p.strokes.length === 2 && p.strokes.every(nonEmpty), 'two strokes')
      break
    case 'nested':
      need(nonEmpty(p.term), 'term')
      miss.push(...missingInPattern(p.holds).map((m) => `holds.${m}`))
      break
  }
  return miss
}

/** the terms a generated Discovery must carry, by type, plus evidence and basis (empty when complete) */
export function missingInDiscovery(d: Discovery): string[] {
  const miss: string[] = []
  const need = (ok: boolean, what: string) => { if (!ok) miss.push(what) }
  need(d.graphemes.length > 0, 'graphemes')
  need(d.evidence.length > 0, 'evidence')
  need(d.basis.length > 0, 'basis')
  need(d.evidence.every((e) => traceProvenance(e.provenance) !== null), 'every evidence traceable')
  switch (d.type) {
    case 'internal_repetition':
      need(nonEmpty(d.unit.char) && d.unit.role === 'unit', 'unit')
      need(nonEmpty(d.whole.char) && d.whole.role === 'whole', 'whole')
      need(d.n >= 2 && d.groupGeometry.offsets.length === d.n, 'n and one offset per unit')
      break
    case 'addition':
      need(d.base.role === 'base' && d.derived.role === 'derived', 'base and derived')
      need(d.delta.length >= 1 && d.delta.every((t) => t.role === 'delta'), 'delta')
      break
    case 'enclosure':
      need(d.container.role === 'container' && d.contained.role === 'contained', 'container and contained')
      break
    case 'partial_enclosure':
      need(d.wrapper.role === 'wrapper' && d.core.role === 'core', 'wrapper and core')
      break
    case 'composition':
      need(d.parts.length >= 2, 'parts')
      break
    case 'intersection':
      need(d.strokes.length === 2 && nonEmpty(d.within), 'strokes and within')
      break
    case 'nested':
      need(nonEmpty(d.term) && nonEmpty(d.holds), 'term and holds')
      break
    case 'inter_containment':
    case 'inter_similarity':
      need(d.inner.role === 'inner' && d.outer.role === 'outer', 'inner and outer')
      break
    case 'inflection':
    case 'coordination':
    case 'negation':
    case 'relation_word':
    case 'reduplication':
    case 'mirror':
      need(d.tokens.length > 0, 'tokens')
      break
    case 'echo':
    case 'voicing':
      need(d.morae.length > 0, 'morae')
      break
    case 'resegmentation':
    case 'cycle':
    case 'permutation':
    case 'homophony':
      miss.push(`${d.type} is reserved (TODO-6)`)
      break
  }
  return miss
}

/** where a fact comes from, as a readable line; null when it names nothing the spec knows */
export function traceProvenance(p: Provenance): string | null {
  switch (p.kind) {
    case 'table':
      return TABLES.includes(p.table) && nonEmpty(p.key) ? `table ${p.table} [${p.key}]` : null
    case 'v1':
      return V1_MODULES.includes(p.module) ? `v1 ${p.module}` : null
    case 'rule':
      return /^(gate|constraint|plan|geometry|resonance):.+/.test(p.rule) ? `rule ${p.rule}` : null
    case 'const':
      return p.name in CONSTANTS ? `const ${p.name} = ${CONSTANTS[p.name].value}` : null
    case 'aux':
      return p.table === 'axes-1' ? `aux axes-1.${p.axis}` : null
  }
}

/** which fixed table a resonance origin is published in: always resonance-1 */
export const RESONANCE_TABLE: Readonly<Record<ResonanceOrigin, DataTableId>> = {
  'wordnet-jpn': 'resonance-1',
  'char-origin': 'resonance-1',
  'chive-schema': 'resonance-1',
}

export const TABLES: readonly DataTableId[] = ['structure-1', 'align-1', 'resonance-1', 'axes-1']
export const V1_MODULES: readonly V1Module[] = [
  'title', 'language/analysis', 'language/segment', 'language/morae', 'language/phonology',
  'glyph/metrics', 'glyph/parts', 'glyph/interior', 'glyph/relation',
]

export const isRuntimeDistance = (d: ResonanceDistance): d is RuntimeDistance => d === 'L0' || d === 'L1'

/** a resonance pattern or value that could stand at run time: L0 / L1, a known origin */
export function resonanceProblems(r: ResonancePattern | SemanticEvidence): string[] {
  const miss: string[] = []
  if (!isRuntimeDistance(r.distance)) miss.push(`distance ${r.distance} is not admitted at run time`)
  if (!(r.origin in RESONANCE_TABLE)) miss.push(`unknown origin ${r.origin}`)
  if (r.type === 'schema' && r.distance === 'L1' && r.origin !== 'chive-schema') miss.push('L1 schema evidence comes from the schema table')
  return miss
}

export const isTodo = (t: string): boolean => (TODOS as readonly string[]).includes(t)
export const isReservedPhonological = (t: string): boolean => (RESERVED_PHONOLOGICAL as readonly string[]).includes(t)
