/**
 * Discoveries between the title's characters, in its words and in its sound
 * (spec-1 §3). Each is v1's own reading, unchanged, taken as a typed relation:
 *
 *   inter_containment / inter_similarity  v1 glyph/relation readRelations between two characters the title writes
 *   inflection, coordination, negation,   v1 language/analysis relations (reduplication, mirror included)
 *   relation_word, reduplication, mirror
 *   echo, voicing                          v1 language/phonology features
 *
 * None of them may be the primary in v2.0 except the inter-character ones (§4.1);
 * they are still found, so a later stage can use them as a source of sequence and rhythm.
 */
import type { Discovery, DiscoveryId, InterContainment, InterSimilarity, Lexical, LexicalType, Phonological } from '../types/discovery'
import { v1Evidence } from './evidence'
import type { DiscoveryInput } from './input'

const r3 = (v: number) => Math.round(v * 1000) / 1000

export function interCharacter(input: DiscoveryInput): Discovery[] {
  const gs = input.language.graphemes
  const out: Discovery[] = []
  for (const r of input.relations) {
    if (r.origin !== 'title') continue
    const gi = gs.filter((g) => g.char === r.inner).map((g) => g.index)
    const go = gs.filter((g) => g.char === r.outer).map((g) => g.index)
    if (!gi.length || !go.length) continue
    const graphemes = [...new Set([gi[0], go[0]])].sort((a, b) => a - b)
    const evidence = [v1Evidence(`${r.inner}${r.kind === 'similarity' ? '≈' : '⊂'}${r.outer}`, 'ink', 'glyph/relation', `${r.kind}: ${r.inner} in ${r.outer}, containment ${r3(r.containment)}, residue ${r3(r.residue.share)}`, r3(r.score))]
    const inner = { char: r.inner, role: 'inner' as const, tier: 'character' as const }
    const outer = { char: r.outer, role: 'outer' as const, tier: 'character' as const }
    const base = { level: 'inter-character' as const, graphemes, evidence, basis: [`relation:${[r.inner, r.outer].sort().join('')}`], inner, outer, relation: r }
    if (r.kind === 'similarity') out.push({ ...base, id: `inter_similarity:${graphemes[0]}:${r.inner}≈${r.outer}` as DiscoveryId, type: 'inter_similarity' } satisfies InterSimilarity)
    else out.push({ ...base, id: `inter_containment:${graphemes[0]}:${r.inner}⊂${r.outer}` as DiscoveryId, type: 'inter_containment' } satisfies InterContainment)
  }
  return out
}

export function lexical(input: DiscoveryInput): Lexical[] {
  const a = input.language
  const tokensOf = (graphemes: readonly number[]) => [...new Set(graphemes.map((g) => a.tokenOf[g]).filter((t) => t !== undefined))].sort((x, y) => x - y)
  const graphemesOf = (tokens: readonly number[]) => tokens.flatMap((t) => Array.from({ length: a.tokens[t].end - a.tokens[t].start }, (_, i) => a.tokens[t].start + i))
  const out: Lexical[] = []
  const push = (type: LexicalType, tokens: readonly number[], detail: string) => {
    if (!tokens.length) return
    const graphemes = graphemesOf(tokens)
    out.push({
      id: `${type}:${graphemes[0] ?? 0}:${tokens.join(',')}` as DiscoveryId,
      type, level: 'lexical', graphemes: graphemes.length ? graphemes : [0],
      evidence: [v1Evidence(`${type}:${tokens.join(',')}`, 'lexicon', 'language/analysis', detail)],
      basis: [`lexical:${type}:${tokens.join(',')}`],
      tokens,
    })
  }
  for (const r of a.relations) {
    switch (r.kind) {
      case 'inflection': push('inflection', [r.token], `${a.tokens[r.token].surface}: a kanji stem and a kana ending at ${r.at}`); break
      case 'coordination': push('coordination', [r.left, r.marker, r.right].sort((x, y) => x - y), `${a.tokens[r.left].surface} ${a.tokens[r.marker].surface} ${a.tokens[r.right].surface}`); break
      case 'negation': push('negation', [r.token], `${a.tokens[r.token].surface}: negated`); break
      case 'relationWord': push('relation_word', [r.token], `${a.tokens[r.token].surface}: a word whose work is the relation`); break
      case 'reduplication': push('reduplication', tokensOf(r.occurrences.flat()), `${r.value} repeated in immediate succession`); break
      case 'mirror': push('mirror', a.tokens.map((t) => t.index), 'the title reads the same backwards'); break
    }
  }
  return out
}

export function phonological(input: DiscoveryInput): Phonological[] {
  const out: Phonological[] = []
  for (const f of input.language.phonology) {
    if (f.kind === 'echo') {
      out.push({
        id: `echo:${f.graphemes[0] ?? 0}:${f.unit}:${f.value}` as DiscoveryId,
        type: 'echo', level: 'phonological', graphemes: f.graphemes.length ? f.graphemes : [0],
        evidence: [v1Evidence(`echo:${f.unit}:${f.value}`, 'sound', 'language/phonology', `${f.unit} ${f.value} returns in morae ${f.morae.join(', ')} (share ${r3(f.share)}, chance ${r3(f.chance)})`, r3(f.share))],
        basis: [`sound:echo:${f.unit}:${f.value}`],
        morae: f.morae, unit: f.unit,
      })
    } else if (f.kind === 'voicing') {
      out.push({
        id: `voicing:${f.grapheme}:${f.voiced}` as DiscoveryId,
        type: 'voicing', level: 'phonological', graphemes: [f.grapheme],
        evidence: [v1Evidence(`voicing:${f.grapheme}`, 'sound', 'language/phonology', `${f.voiced} = ${f.base} + ${f.mark}${f.alsoWritten.length ? ` (the title also writes ${f.base})` : ''}`)],
        basis: [`sound:voicing:${f.grapheme}`],
        morae: f.mora >= 0 ? [f.mora] : [], unit: 'mora',
      })
    }
  }
  return out.filter((d) => d.morae.length > 0)
}
