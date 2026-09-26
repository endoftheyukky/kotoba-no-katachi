/**
 * Build time only: structure-1 from the source text, pure (strings in, strings out).
 * tools/v2/structure.mjs reads the files, checks their sha256, hashes the shards
 * and writes the manifest; everything that decides a structure is here.
 */
import type { CharStructure, IdsNode } from '../../types/structure'
import type { EntryStatus, FormCorrespondence, RegionalIds, StructureEntry, Supplement } from '../table'
import { idsOf, namedAtUnknowns, parseIds, tierOf, type TierRules } from './ids'
import { normalize } from './normalize'
import { readField, regionRank, select } from './select'
import { shardOf, shardText } from './serialize'

export const TOOL_VERSION = '1'
export const SHARDS = 16

/**
 * Forms that correspond to a character without being it (spec-1 §2.2). The correspondence is
 * recorded; the forms are never merged into the characters (囗 stays U+56D7).
 */
export const FORMS: readonly FormCorrespondence[] = [
  { form: '囗', kind: 'written-as', chars: ['口'] },
  { form: '氵', kind: 'variant-of', chars: ['水'] },
  { form: '⺡', kind: 'variant-of', chars: ['水'] },
  { form: '亻', kind: 'variant-of', chars: ['人'] },
  { form: '扌', kind: 'variant-of', chars: ['手'] },
  { form: '⺘', kind: 'variant-of', chars: ['手'] },
  { form: '忄', kind: 'variant-of', chars: ['心'] },
  { form: '⺗', kind: 'variant-of', chars: ['心'] },
  { form: '灬', kind: 'variant-of', chars: ['火'] },
  { form: '礻', kind: 'variant-of', chars: ['示'] },
  { form: '衤', kind: 'variant-of', chars: ['衣'] },
  { form: '艹', kind: 'variant-of', chars: ['艸'] },
  { form: '⺾', kind: 'variant-of', chars: ['艸'] },
  { form: '辶', kind: 'variant-of', chars: ['辵'] },
  { form: '⻌', kind: 'variant-of', chars: ['辵'] },
  { form: '犭', kind: 'variant-of', chars: ['犬'] },
  { form: '阝', kind: 'variant-of', chars: ['阜', '邑'] },
  { form: '刂', kind: 'variant-of', chars: ['刀'] },
  { form: '訁', kind: 'variant-of', chars: ['言'] },
  { form: '飠', kind: 'variant-of', chars: ['食'] },
  { form: '糹', kind: 'variant-of', chars: ['糸'] },
  { form: '釒', kind: 'variant-of', chars: ['金'] },
  { form: '𧾷', kind: 'variant-of', chars: ['足'] },
  { form: '⺮', kind: 'variant-of', chars: ['竹'] },
  { form: '罒', kind: 'variant-of', chars: ['网'] },
  { form: '冫', kind: 'variant-of', chars: ['氷'] },
  { form: '爫', kind: 'variant-of', chars: ['爪'] },
  { form: '⺌', kind: 'variant-of', chars: ['小'] },
  { form: '𤣩', kind: 'variant-of', chars: ['玉'] },
]

export function tierRules(graded: ReadonlySet<string>): TierRules {
  const writtenAs = new Map<string, readonly string[]>()
  const variantOf = new Map<string, readonly string[]>()
  for (const f of FORMS) (f.kind === 'written-as' ? writtenAs : variantOf).set(f.form, f.chars)
  return { graded, writtenAs, variantOf }
}

/** every character's regional IDS, from the source text (BabelStone IDS.TXT) */
export function readSource(text: string): Map<string, RegionalIds[]> {
  const out = new Map<string, RegionalIds[]>()
  for (const raw of text.replace(/^﻿/, '').split(/\r?\n/)) {
    if (!raw || raw.startsWith('#')) continue
    const f = raw.split('\t')
    const char = f[1]
    if (!char) continue
    const list: RegionalIds[] = []
    for (const field of f.slice(2)) {
      const r = readField(field)
      if (r) list.push({ ids: r.ids, regions: r.regions, parse: 'ok' })
    }
    out.set(char, list)
  }
  return out
}

export interface BuildInput {
  source: ReadonlyMap<string, readonly RegionalIds[]>
  graded: ReadonlySet<string>
  /** the characters the table holds */
  include: readonly string[]
}

export function buildEntries(input: BuildInput): Map<string, StructureEntry> {
  const rules = tierRules(input.graded)
  // a component opens into its own selected structure, parsed with the same rules
  const openCache = new Map<string, { ids: string; tree: IdsNode } | null>()
  const open = (char: string) => {
    if (openCache.has(char)) return openCache.get(char)!
    let result: { ids: string; tree: IdsNode } | null = null
    const cands = (input.source.get(char) ?? []).map((c) => withParse(c, char))
    // opened as a component: its form as a component in Japanese characters ([J]) first
    const s = select(cands, 'component')
    if (s && s.chosen.parse === 'ok') {
      const p = parseIds(s.chosen.ids, char, rules, tierOf(char, rules))
      if (p.status === 'ok') result = { ids: s.chosen.ids, tree: p.tree }
    }
    openCache.set(char, result)
    return result
  }
  const withParse = (c: RegionalIds, char: string): RegionalIds => ({ ...c, parse: parseIds(c.ids, char, rules, 'character').status })

  const out = new Map<string, StructureEntry>()
  for (const char of input.include) {
    const cands = (input.source.get(char) ?? []).map((c) => withParse(c, char))
    const s = select(cands, 'self')
    if (!s) continue                                     // the source has nothing for it: not in the table (not-found)
    const rootTier = input.graded.has(char) ? 'character' : tierOf(char, rules)
    const p = parseIds(s.chosen.ids, char, rules, rootTier)
    const status: EntryStatus = p.status === 'ok' ? 'decomposed' : p.status
    let parsed: IdsNode | null = null
    let structure: CharStructure | null = null
    let supplements: Supplement[] = []
    let steps: StructureEntry['normalization'] = []
    if (p.status === 'ok' || p.status === 'atomic') {
      parsed = p.tree
      const n = p.status === 'ok' ? normalize(p.tree, char, open) : { tree: p.tree, steps: [] }
      steps = n.steps
      // another region's IDS of the same shape names what the selected one leaves unencoded
      const others = cands.filter((c) => c !== s.chosen && c.parse === 'ok').sort((a, b) => regionRank(a.regions) - regionRank(b.regions) || (a.ids < b.ids ? -1 : a.ids > b.ids ? 1 : 0))
      for (const o of others) {
        const op = parseIds(o.ids, char, rules, rootTier)
        if (op.status !== 'ok') continue
        const named = namedAtUnknowns(p.tree, op.tree)
        if (named && named.length) {
          supplements = named.map((x) => ({
            path: x.path, unknown: x.unknown, named: idsOf(x.named), from: o.regions,
            provenance: { kind: 'table', table: 'structure-1', key: `${char}#${o.regions}` },
          }))
          break
        }
      }
      let namedIds: string | undefined
      if (supplements.length) {
        namedIds = s.chosen.ids
        for (const sp of supplements) namedIds = namedIds.replace(sp.unknown, sp.named)
      }
      structure = {
        // a Japanese form, plain or virtual ([J]), is the Japanese source; entry.selected.japanese says which
        char, ids: s.chosen.ids, tree: n.tree, source: s.japanese === 'none' ? 'babelstone-other' : 'babelstone-j',
        ...(namedIds ? { named: namedIds } : {}),
        provenance: { kind: 'table', table: 'structure-1', key: char },
      }
    }
    out.set(char, {
      char, status,
      selected: { ids: s.chosen.ids, regions: s.chosen.regions, japanese: s.japanese },
      candidates: cands, parsed, structure, supplements, normalization: steps,
    })
  }
  return out
}

/** the table's shards, as text: file name → content */
export function shardTexts(entries: ReadonlyMap<string, StructureEntry>): Map<string, string> {
  const parts: Map<string, StructureEntry>[] = Array.from({ length: SHARDS }, () => new Map())
  for (const [k, e] of entries) parts[shardOf(k, SHARDS)].set(k, e)
  return new Map(parts.map((m, i) => [`${String(i).padStart(2, '0')}.json`, shardText(m)]))
}
