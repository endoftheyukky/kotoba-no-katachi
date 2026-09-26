/**
 * The evidence a Discovery rests on, each with the row or module it was read
 * from (spec-1 §0 R2). Built only from facts of the inputs.
 */
import type { AlignEntry, AlignRow } from '../align/table'
import type { StructureEntry } from '../structure/table'
import type { Evidence, V1Module } from '../types/provenance'

const r3 = (v: number) => Math.round(v * 1000) / 1000

export function structureEvidence(e: StructureEntry, what = 'structure'): Evidence {
  const s = e.structure!
  return {
    id: `ev:${e.char}:${what}`,
    kind: 'structure',
    provenance: { kind: 'table', table: 'structure-1', key: e.char },
    detail: `${e.char} = ${s.ids} (${s.source === 'babelstone-j' ? 'the Japanese form' : 'another region'}${s.named ? `; named ${s.named}` : ''})`,
  }
}

/** a placement read from align-1, with its status: the geometry is an observation, not the truth of the part */
export function placementEvidence(whole: string, row: AlignRow): Evidence {
  const name = row.node.kind === 'leaf' ? row.node.char : row.node.ids
  const t = row.transform
  return {
    id: `ev:${whole}:${row.path}:placed`,
    kind: 'ink',
    provenance: { kind: 'table', table: 'align-1', key: `${whole}#${row.path}` },
    detail: `${name} ${row.status}${row.because.length ? ` (${row.because.join(', ')})` : ''}${t ? ` sx ${t.sx} sy ${t.sy}` : ''}`,
    ...(row.confidence !== undefined ? { value: r3(row.confidence) } : {}),
  }
}

/** the whole glyph's own ink (islands, alike groups, crossings) */
export function inkEvidence(e: AlignEntry, what: string, detail: string, value?: number): Evidence {
  return {
    id: `ev:${e.char}:ink:${what}`,
    kind: 'ink',
    provenance: { kind: 'table', table: 'align-1', key: `${e.char}:ink` },
    detail,
    ...(value !== undefined ? { value } : {}),
  }
}

export function v1Evidence(id: string, kind: Evidence['kind'], module: V1Module, detail: string, value?: number): Evidence {
  return { id: `ev:${id}`, kind, provenance: { kind: 'v1', module, detail }, detail, ...(value !== undefined ? { value } : {}) }
}
