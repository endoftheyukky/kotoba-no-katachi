/**
 * Constraints (spec-1 §6): the selected Discovery translated into relations the
 * page must keep — never a look, a coordinate or a size. Every constraint names
 * the Discovery (and the evidence) it comes from.
 *
 *   linguistic input   the Selection (primary, secondary), its Discoveries, their semantic evidence,
 *                      and the title's lexical and phonological Discoveries
 *   rule (§6, by the primary's type)
 *     addition (point)       major(base) difference(derived) same-scale boundary-side | interleave
 *                            no-emphasis(delta) visibility(hidden) [rhythm, when the base holds a repetition]
 *     addition (zone)        radical-meaning L0 on the delta: zone(derived) and visibility(immediate) instead
 *     internal_repetition    repeated count same-scale whole-emerges [remainder-site]
 *     enclosure              container inside interface same-scale extent(page with CONTAINER L1 or
 *                            component-whole L0, else glyph)
 *     partial_enclosure      wrapper-zone interface same-scale, and intersection(core) when the core crosses;
 *                            without a crossing, extent(glyph)
 *     composition            regions axis separation
 *     intersection           intersection interface same-scale
 *     inter_containment      as an addition between two written characters: major(inner) difference(outer)
 *                            same-scale boundary-side (the residue's side) | interleave visibility(hidden)
 *     inter_similarity       major difference same-scale interleave(1) visibility(hidden)
 *     demoted                demoted
 *   the words and the sound (always auxiliary: they never stand for or over a structure)
 *     sequence   the title in its reading order, when it has a lexical or phonological Discovery
 *     split      inflection, negation, relation word, coordination: where the line parts
 *     recurrence echo, reduplication, mirror, a voiced kana beside its written base: graphemes that answer
 *
 * No constraint is ever made without a Discovery. A title with none has none, and that is a result.
 */
import type { LanguageAnalysis } from '../../language/analysis'
import type { Constraint, ConstraintId } from '../types/constraints'
import type { Discovery, DiscoveryId } from '../types/discovery'
import type { SemanticEvidence } from '../types/resonance'
import type { Selection } from '../types/selection'
import type { IdsOperator } from '../types/structure'

export interface ConstraintSet {
  constraints: readonly Constraint[]
  /** the Discovery the structural constraints translate (the primary), or null */
  primary: DiscoveryId | null
  /** the Discoveries of the words and sound the auxiliary constraints translate */
  auxiliary: readonly DiscoveryId[]
}

/** a constraint before its id is made (distributed over the union) */
type Unsaved = { [K in Constraint['kind']]: Omit<Extract<Constraint, { kind: K }>, 'id'> }[Constraint['kind']]

const opOf = (arrangement: string): IdsOperator => (arrangement === '⿱' ? '⿱' : arrangement === 'stack' ? '⿳' : arrangement === 'row' ? '⿲' : '⿰')

export function constrain(discoveries: readonly Discovery[], selection: Selection, evidence: readonly SemanticEvidence[], language: LanguageAnalysis): ConstraintSet {
  const out: Constraint[] = []
  const byId = new Map(discoveries.map((d) => [d.id, d]))
  const add = (c: Unsaved, key: string) => {
    const id = `c:${c.kind}:${key}` as ConstraintId
    if (!out.some((x) => x.id === id)) out.push({ ...c, id } as Constraint)
  }
  const ev = (pred: (e: SemanticEvidence) => boolean) => evidence.filter(pred).map((e) => e.id)
  const p = selection.primary ? byId.get(selection.primary) ?? null : null
  const secondary = selection.secondary.map((id) => byId.get(id)).filter((d): d is Discovery => !!d)

  if (p) {
    const because = (ids: readonly string[] = []) => ({ discovery: p.id, ...(ids.length ? { evidence: ids as never } : {}) })
    switch (p.type) {
      case 'addition': {
        const delta = p.delta.map((t) => t.char).join('')
        const rm = ev((e) => e.type === 'radical-meaning' && e.whole === p.derived.char && p.delta.some((t) => t.char === e.radical))
        add({ kind: 'major', term: p.base.char, because: because(), why: `the base ${p.base.char} is the field` }, p.base.char)
        if (rm.length) add({ kind: 'zone', term: p.derived.char, because: because(rm), why: `the delta ${delta} is its radical's meaning (L0): the derived character makes a band` }, p.derived.char)
        else add({ kind: 'difference', term: p.derived.char, because: because(), why: `${p.derived.char} is ${p.base.char} and a small difference` }, p.derived.char)
        add({ kind: 'same-scale', a: p.base.char, b: p.derived.char, because: because(), why: 'the base and the derived character are read at one scale' }, `${p.base.char}${p.derived.char}`)
        if (p.side === 'interleaved') add({ kind: 'interleave', count: p.count, arrangement: p.arrangement ?? 'single', because: because(), why: `the delta is ${p.count} piece(s) between the base's strokes` }, p.derived.char)
        else if (p.side !== 'wrap') add({ kind: 'boundary-side', side: p.side, because: because(), why: `the delta stands on the ${p.side} of the base` }, p.side)
        add({ kind: 'no-emphasis', term: delta, because: because(), why: 'the delta is not made to stand out' }, delta)
        add({ kind: 'visibility', target: rm.length ? 'immediate' : 'hidden', because: because(rm), why: rm.length ? 'a meaningful band is seen at once' : 'a small difference is found, not shown' }, p.derived.char)
        // the base's own repetition gives the field its rhythm (淋: 林 = 木×2)
        for (const n of p.nested ?? []) {
          const nest = byId.get(n)
          const held = nest?.type === 'nested' ? byId.get(nest.holds) : undefined
          if (held?.type === 'internal_repetition' && held.whole.char === p.base.char)
            add({ kind: 'rhythm', n: held.n, op: opOf(held.arrangement), because: { discovery: held.id }, why: `${p.base.char} is ${held.unit.char}×${held.n}: the field keeps its units in ${held.n}s` }, p.base.char)
        }
        break
      }
      case 'internal_repetition': {
        const pr = ev((e) => e.type === 'part-referent' && e.whole === p.whole.char)
        const l1 = ev((e) => e.type === 'schema' && e.distance === 'L1' && e.char === p.whole.char && e.schema === 'MULTITUDE')
        add({ kind: 'repeated', unit: p.unit.char, tier: p.unitTier, because: because(), why: `${p.whole.char} is ${p.unit.char} repeated` }, p.unit.char)
        add({ kind: 'count', n: p.n, arrangement: p.arrangement, because: because([...pr, ...l1]), why: `${p.n} units, ${p.arrangement}${pr.length || l1.length ? '; its word names many of them' : ''}` }, p.unit.char)
        add({ kind: 'same-scale', a: p.unit.char, b: p.whole.char, because: because(), why: 'the units and the whole are read at one scale' }, `${p.unit.char}${p.whole.char}`)
        add({ kind: 'whole-emerges', whole: p.whole.char, because: because(), why: `${p.whole.char} closes among its units, not beside them` }, p.whole.char)
        if (p.remainder) add({ kind: 'remainder-site', remainder: p.remainder.char, because: because(), why: `the whole closes where ${p.remainder.char} stands in it` }, p.remainder.char)
        break
      }
      case 'enclosure': {
        const whole = language.graphemes[p.graphemes[0]].char
        const page = ev((e) => (e.type === 'schema' && e.distance === 'L1' && e.schema === 'CONTAINER' && e.char === whole) || (e.type === 'component-whole' && e.whole === whole))
        add({ kind: 'container', term: p.container.char, because: because(), why: `${p.container.char} holds` }, p.container.char)
        add({ kind: 'inside', term: p.contained.char, op: p.operator, because: because(), why: `${p.contained.char} is held (${p.operator})` }, p.contained.char)
        add({ kind: 'interface', term: whole, because: because(), why: `${whole} is where the two meet` }, whole)
        add({ kind: 'same-scale', a: p.container.char, b: p.contained.char, because: because(), why: 'container and contained at one scale' }, `${p.container.char}${p.contained.char}`)
        add({ kind: 'extent', scale: page.length ? 'page' : 'glyph', because: because(page), why: page.length ? 'the word itself is a container (evidence): the page holds' : 'no evidence makes it more than the character: the character holds' }, whole)
        break
      }
      case 'partial_enclosure': {
        const whole = language.graphemes[p.graphemes[0]].char
        add({ kind: 'wrapper-zone', term: p.wrapper.char, op: p.operator, because: because(), why: `${p.wrapper.char} wraps from its side (${p.operator})` }, p.wrapper.char)
        add({ kind: 'interface', term: whole, because: because(), why: `${whole} is where wrapper and core meet` }, whole)
        add({ kind: 'same-scale', a: p.core.char, b: whole, because: because(), why: 'core and whole at one scale' }, `${p.core.char}${whole}`)
        const cross = secondary.find((d) => d.type === 'intersection' && d.within === p.core.char)
        if (cross?.type === 'intersection') add({ kind: 'intersection', term: p.core.char, because: { discovery: cross.id }, why: `${p.core.char}'s strokes cross` }, p.core.char)
        else add({ kind: 'extent', scale: 'glyph', because: because(), why: 'the wrapper is a form, never written alone: the character holds the relation' }, whole)
        break
      }
      case 'composition':
        add({ kind: 'regions', parts: p.parts.map((t) => t.char), because: because(), why: `${p.parts.map((t) => t.char).join(' and ')} each keep a place` }, p.parts.map((t) => t.char).join(''))
        add({ kind: 'axis', op: p.operator, because: because(), why: `they stand ${p.axis === 'horizontal' ? 'side by side' : 'one above another'} (${p.operator})` }, p.operator)
        add({ kind: 'separation', axis: p.axis === 'horizontal' ? 'vertical' : 'horizontal', because: because(), why: 'a seam between the parts' }, p.operator)
        break
      case 'intersection':
        add({ kind: 'intersection', term: p.within, because: because(), why: `${p.strokes[0].char} and ${p.strokes[1].char} cross` }, p.within)
        add({ kind: 'interface', term: p.within, because: because(), why: `${p.within} is at the crossing` }, p.within)
        add({ kind: 'same-scale', a: p.within, b: p.within, because: because(), why: 'one scale' }, p.within)
        break
      case 'inter_containment':
      case 'inter_similarity': {
        const r = p.relation
        add({ kind: 'major', term: p.inner.char, because: because(), why: `${p.inner.char} is the field` }, p.inner.char)
        add({ kind: 'difference', term: p.outer.char, because: because(), why: `${p.outer.char} holds ${p.inner.char}'s form${p.type === 'inter_similarity' ? ', all but a little' : ''}` }, p.outer.char)
        add({ kind: 'same-scale', a: p.inner.char, b: p.outer.char, because: because(), why: 'the two are read at one scale' }, `${p.inner.char}${p.outer.char}`)
        const c = r.residue.centroid
        const side = r.residue.share > 0 && Math.hypot(c.x, c.y) > 12 ? (Math.abs(c.x) >= Math.abs(c.y) ? (c.x < 0 ? 'left' : 'right') : c.y < 0 ? 'top' : 'bottom') : null
        if (p.type === 'inter_containment' && side) add({ kind: 'boundary-side', side, because: because(), why: `what ${p.outer.char} has beyond ${p.inner.char} lies on its ${side}` }, side)
        else add({ kind: 'interleave', count: 1, arrangement: 'single', because: because(), why: `one ${p.outer.char} among ${p.inner.char}` }, p.outer.char)
        add({ kind: 'visibility', target: 'hidden', because: because(), why: 'the other form is found, not shown' }, p.outer.char)
        break
      }
    }
    for (const d of selection.demoted) add({ kind: 'demoted', by: d.by, because: { discovery: d.id }, why: 'a pictograph: its graphic decomposition is not claimed' }, d.id)
  }

  // the words and the sound: auxiliary, never a structure's replacement
  const aux = discoveries.filter((d) => d.level === 'lexical' || d.level === 'phonological')
  const written = language.graphemes.filter((g) => g.char.trim()).map((g) => g.index)
  if (aux.length && written.length >= 2) {
    const first = aux[0]
    add({ kind: 'sequence', graphemes: written, because: { discovery: first.id }, why: 'the words keep their reading order along one line' }, 'title')
    for (const d of aux) {
      const tokenStart = (t: number) => language.tokens[t]?.start
      switch (d.type) {
        case 'inflection': {
          const r = language.relations.find((x) => x.kind === 'inflection' && d.tokens.includes(x.token))
          if (r?.kind === 'inflection') add({ kind: 'split', at: r.at, by: 'inflection', because: { discovery: d.id }, why: 'the stem and its ending part' }, `inflection:${r.at}`)
          break
        }
        case 'negation': {
          // the negating graphemes: the relation's own, not the whole token's
          const r = language.relations.find((x) => x.kind === 'negation' && d.tokens.includes(x.token))
          const at = r?.kind === 'negation' ? Math.min(...r.graphemes) : Math.min(...d.graphemes)
          add({ kind: 'split', at, by: 'negation', because: { discovery: d.id }, why: 'the negation parts from what it negates' }, `negation:${at}`)
          break
        }
        case 'relation_word': add({ kind: 'split', at: tokenStart(d.tokens[0]), by: 'relation-word', because: { discovery: d.id }, why: 'a word whose work is the relation stands between' }, `relation:${tokenStart(d.tokens[0])}`); break
        case 'coordination': {
          // the marker is the middle token of left, marker, right
          const marker = d.tokens.length === 3 ? d.tokens[1] : d.tokens[0]
          add({ kind: 'split', at: tokenStart(marker), by: 'coordination', because: { discovery: d.id }, why: 'the coordination parts its members' }, `coordination:${d.tokens.join(',')}`)
          break
        }
        case 'reduplication': {
          // the graphemes that repeat, as v1 read them (ぴょこ | ぴょこ in かえるぴょこぴょこ), not the whole word they are in
          const inWord = new Set(d.graphemes)
          for (const r of language.relations)
            if (r.kind === 'reduplication' && r.occurrences.flat().every((g) => inWord.has(g))) {
              const members = r.occurrences.flat()
              add({ kind: 'recurrence', members, unit: 'token', value: d.id, because: { discovery: d.id }, why: `${r.value} repeated in immediate succession` }, `redup:${members.join(',')}`)
            }
          break
        }
        case 'mirror': add({ kind: 'recurrence', members: d.graphemes, unit: 'grapheme', value: 'mirror', because: { discovery: d.id }, why: 'the title reads the same backwards' }, 'mirror'); break
        case 'echo': add({ kind: 'recurrence', members: [...new Set(d.graphemes)], unit: d.unit ?? 'mora', value: d.id.split(':').pop()!, because: { discovery: d.id }, why: `a ${d.unit ?? 'mora'} returns` }, `echo:${d.id}`); break
        case 'voicing': {
          const f = language.phonology.find((x) => x.kind === 'voicing' && x.grapheme === d.graphemes[0])
          if (f?.kind === 'voicing' && f.alsoWritten.length) add({ kind: 'recurrence', members: [f.grapheme, ...f.alsoWritten], unit: 'grapheme', value: f.base, because: { discovery: d.id }, why: `${f.voiced} beside its unvoiced ${f.base}` }, `voicing:${f.grapheme}`)
          break
        }
      }
    }
  }
  const auxiliary = [...new Set(out.filter((c) => c.kind === 'sequence' || c.kind === 'split' || c.kind === 'recurrence').map((c) => c.because.discovery))]
  return { constraints: out, primary: p?.id ?? null, auxiliary }
}
