/**
 * Semantic Resonance (spec-1 §5): typed evidence that a selected Discovery and
 * a meaning answer each other. Only L0 (a resource states it) and L1 (a fixed
 * schema agrees with the structure's type, §5.2's two active pairs) exist at
 * run time; never L2 or L3, never a score, never a model. Evidence never makes
 * or unmakes a Discovery: the only thing it may do to the selection is F's
 * demotion (§4.2), and origin data is not chosen yet (TODO-11).
 *
 *   linguistic input   the selected Discoveries (primary, secondary) and resonance-1's rows
 *   rules (typed)
 *     part-referent    a repetition's whole whose word has-part / has-member one unit (雨 → 雨滴, 林 → 木);
 *                      the rows naming a component of the whole when there are such, else every one
 *     radical-meaning  an addition whose delta is a variant form, the derived word reaching the form's
 *                      character by typed links (海 → 水)
 *     schema (L0)      a character of the title whose word reaches a schema's concept word (辻 → 道: PATH)
 *     schema (L1)      enclosure × CONTAINER, repetition of a character unit × MULTITUDE, at percentile ≥ L1_MIN
 *   output             SemanticEvidence[], each naming its row in resonance-1
 *
 * The nine semantic axes (axes-1) are not read here: they stay an auxiliary quantity (§5.4).
 */
import { ACTIVE_L1_PAIRS, CONSTANTS } from '../spec'
import { structureIndex } from '../structure/lookup'
import type { Discovery } from '../types/discovery'
import type { Provenance } from '../types/provenance'
import type { SemanticEvidence } from '../types/resonance'
import type { Selection } from '../types/selection'
import type { ResonanceManifest, ResonanceRow, ResonanceShard } from './table'

export type { ResonanceManifest, ResonanceRow, ResonanceShard } from './table'

export interface ResonanceIndex {
  readonly manifest: ResonanceManifest
  row(char: string): ResonanceRow | null
}

export function resonanceIndex(manifest: ResonanceManifest, shards: readonly ResonanceShard[]): ResonanceIndex {
  if (shards.length !== manifest.shards.count) throw new Error(`resonance-1: ${shards.length} shards for ${manifest.shards.count}`)
  return {
    manifest,
    row(char: string): ResonanceRow | null {
      if (!char || [...char].length !== 1) return null
      const shard = shards[char.codePointAt(0)! % manifest.shards.count]
      return Object.prototype.hasOwnProperty.call(shard.entries, char) ? shard.entries[char] : null
    },
  }
}

const row = (char: string): Provenance => ({ kind: 'table', table: 'resonance-1', key: char })
const pathText = (p: readonly (readonly [string, string, string])[]) => p.map(([a, r, b]) => `${a} ${r} ${b}`).join('; ')

/** the characters of a structure's leaves (to tell a part-referent that names a component) */
type Leaves = (char: string) => ReadonlySet<string>

export function resonate(discoveries: readonly Discovery[], selection: Selection, index: ResonanceIndex, leaves: Leaves, own: (grapheme: number) => string | undefined): SemanticEvidence[] {
  const chosen = new Set([selection.primary, ...selection.secondary].filter((x): x is Discovery['id'] => !!x))
  const selected = discoveries.filter((d) => chosen.has(d.id))
  const out: SemanticEvidence[] = []
  const push = (e: SemanticEvidence) => {
    if (!out.some((x) => x.id === e.id)) out.push(e)
  }
  const L1_MIN = CONSTANTS.L1_MIN_PERCENTILE.value
  const titleChars = new Set<string>()
  for (const d of selected) {
    const c = own(d.graphemes[0])
    if (c && d.level === 'character') titleChars.add(c)
    if (d.type === 'internal_repetition') {
      // A: the whole's word has one unit as a part or member
      const r = index.row(d.whole.char)
      const rows = r?.partReferent ?? []
      const parts = leaves(d.whole.char)
      const naming = rows.filter((x) => parts.has(x.unit))
      for (const x of naming.length ? naming : rows)
        push({ id: `res:part-referent:${d.whole.char}:${x.unit}`, type: 'part-referent', distance: 'L0', origin: 'wordnet-jpn', provenance: row(d.whole.char), detail: `${d.whole.char} ${x.relation} ${x.unit} (${pathText(x.path)})`, whole: d.whole.char, unit: x.unit, relation: x.relation })
      // L1: a repetition of a character unit × MULTITUDE
      const p = r?.schema?.MULTITUDE
      if (d.unitTier === 'character' && d.whole.char === c && ACTIVE_L1_PAIRS.some((a) => a.structure === 'internal_repetition' && a.schema === 'MULTITUDE') && p !== undefined && p >= L1_MIN)
        push({ id: `res:schema:${c}:MULTITUDE`, type: 'schema', distance: 'L1', origin: 'chive-schema', provenance: row(c), detail: `${c}: MULTITUDE percentile ${p} with a repetition of ${d.unit.char}`, char: c, schema: 'MULTITUDE', percentile: p, structure: 'internal_repetition' })
    }
    if (d.type === 'addition') {
      const r = index.row(d.derived.char)
      for (const x of r?.radicalMeaning ?? []) {
        if (!d.delta.some((t) => t.char === x.radical)) continue
        push({ id: `res:radical-meaning:${d.derived.char}:${x.radical}`, type: 'radical-meaning', distance: 'L0', origin: 'wordnet-jpn', provenance: row(d.derived.char), detail: `${d.derived.char}: ${x.radical} is a form of ${x.meaning}; ${pathText(x.path)}`, whole: d.derived.char, radical: x.radical, meaning: x.meaning, relation: x.relation })
      }
    }
    if (d.type === 'enclosure' && c) {
      const p = index.row(c)?.schema?.CONTAINER
      if (ACTIVE_L1_PAIRS.some((a) => a.structure === 'enclosure' && a.schema === 'CONTAINER') && p !== undefined && p >= L1_MIN)
        push({ id: `res:schema:${c}:CONTAINER`, type: 'schema', distance: 'L1', origin: 'chive-schema', provenance: row(c), detail: `${c}: CONTAINER percentile ${p} with an enclosure of ${d.contained.char} in ${d.container.char}`, char: c, schema: 'CONTAINER', percentile: p, structure: 'enclosure' })
    }
  }
  // E at L0: a character of the title whose word reaches a schema's concept word
  for (const c of titleChars) {
    for (const x of index.row(c)?.schemaDirect ?? [])
      push({ id: `res:schema:${c}:${x.schema}:${x.concept}`, type: 'schema', distance: 'L0', origin: 'wordnet-jpn', provenance: row(c), detail: `${c} → ${x.concept} (${x.schema}): ${pathText(x.path)}`, char: c, concept: x.concept, path: x.path.map(([a, r, b]) => `${a} ${r} ${b}`) })
  }
  return out
}

/** the leaves of a character's structure, from structure-1 */
export function leavesOf(structure: ReturnType<typeof structureIndex>): Leaves {
  return (char: string) => {
    const r = structure.lookup(char)
    const out = new Set<string>()
    if (r.status !== 'found') return out
    const walk = (n: typeof r.structure.tree) => {
      if (n.kind === 'op') n.children.forEach(walk)
      else out.add(n.char)
    }
    walk(r.structure.tree)
    return out
  }
}
