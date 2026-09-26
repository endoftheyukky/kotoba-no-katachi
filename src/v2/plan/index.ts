/**
 * SpatialPlan (spec-1 §7): a relational grammar. Each rule, when every
 * constraint it requires is present, compiles the constraints into primitives
 * — what stands where in relation to what — and says which constraints it
 * keeps and what it would add that nothing asked for. No coordinate yet
 * (FieldGeometry), no score: the choice is §7.3's order.
 *
 *   rule           requires                       keeps (§7.2)
 *   FieldSingleton difference, boundary-side      major difference same-scale boundary-side no-emphasis visibility rhythm
 *   RegionSplit    boundary-side                  major zone same-scale boundary-side no-emphasis rhythm
 *   FieldInterleave interleave                    major difference same-scale interleave no-emphasis visibility
 *   NestedRegions  inside, extent = page          container inside interface same-scale extent
 *   Frame          inside                         container inside same-scale
 *   GlyphItself    inside | wrapper-zone,         container inside extent wrapper-zone
 *                  extent = glyph
 *   CrossRoads     intersection                   intersection interface wrapper-zone same-scale container
 *   Separation     separation                     regions axis separation
 *   WholeEmerges   whole-emerges                  repeated count same-scale whole-emerges remainder-site
 *   ScaleTransfer  repeated, count, character     repeated count same-scale
 *                  units seen apart in the ink
 *   Sequence       sequence (no structural        sequence split recurrence (axis, rhythm of the words)
 *                  constraint)
 *   Absent         —                              —
 *
 * Selection (§7.3): fewest unmotivated, then most constraints kept, then RULE_ORDER.
 * Sequence competes only where there is no structural constraint: the words and the
 * sound never replace a structure (with one, the rest of a longer title stands beside
 * the chosen plan as its sequence; spec TODO-10).
 */
import { RULE_ORDER } from '../spec'
import type { Constraint, ConstraintKind } from '../types/constraints'
import type { Discovery } from '../types/discovery'
import type { PlanCandidate, PlanSelection, Primitive, RuleName } from '../types/plan'

const AUX = new Set<ConstraintKind>(['sequence', 'split', 'recurrence'])

export interface Plan {
  selection: PlanSelection
  plan: PlanCandidate
  /** graphemes of the title the plan does not itself realise: written beside it, in reading order (TODO-10) */
  rest: readonly number[]
}

interface Rule {
  name: RuleName
  realises: readonly ConstraintKind[]
  /** null: the rule does not apply */
  build: (c: Bag) => { primitives: Primitive[]; unmotivated: string[] } | null
}

/** the constraints of a title, by kind */
class Bag {
  constructor(readonly all: readonly Constraint[]) {}
  get<K extends ConstraintKind>(k: K): Extract<Constraint, { kind: K }> | undefined {
    return this.all.find((c): c is Extract<Constraint, { kind: K }> => c.kind === k)
  }
  every<K extends ConstraintKind>(k: K): Extract<Constraint, { kind: K }>[] {
    return this.all.filter((c): c is Extract<Constraint, { kind: K }> => c.kind === k)
  }
  has(k: ConstraintKind): boolean {
    return this.all.some((c) => c.kind === k)
  }
}

const sideAxis = (side: string) => (side === 'left' || side === 'right' ? 'vertical' : 'horizontal') as 'vertical' | 'horizontal'

const RULES: readonly Rule[] = [
  {
    name: 'FieldSingleton',
    realises: ['major', 'difference', 'same-scale', 'boundary-side', 'no-emphasis', 'visibility', 'rhythm'],
    build: (c) => {
      const major = c.get('major'), diff = c.get('difference'), side = c.get('boundary-side')
      if (!major || !diff || !side) return null
      return {
        primitives: [
          { kind: 'field', unit: major.term, role: 'base' },
          { kind: 'singleton', item: diff.term, locus: 'side' },
          { kind: 'boundary', between: [major.term, diff.term], axis: sideAxis(side.side) },
        ],
        unmotivated: [],
      }
    },
  },
  {
    name: 'RegionSplit',
    realises: ['major', 'zone', 'same-scale', 'boundary-side', 'no-emphasis', 'rhythm'],
    build: (c) => {
      const major = c.get('major'), side = c.get('boundary-side')
      if (!major || !side) return null
      const zone = c.get('zone')
      const band = zone?.term ?? c.get('difference')?.term ?? major.term
      return {
        primitives: [
          { kind: 'region', item: band, place: 'band' },
          { kind: 'field', unit: major.term, role: 'base' },
          { kind: 'boundary', between: [band, major.term], axis: sideAxis(side.side) },
        ],
        // a band of the derived character where the delta is only a difference: nothing asked for a band
        unmotivated: zone ? [] : ['region:band (no zone: the delta is a difference, not a band)'],
      }
    },
  },
  {
    name: 'FieldInterleave',
    realises: ['major', 'difference', 'same-scale', 'interleave', 'no-emphasis', 'visibility'],
    build: (c) => {
      const major = c.get('major'), inter = c.get('interleave')
      if (!major || !inter) return null
      const item = c.get('difference')?.term ?? c.get('zone')?.term ?? major.term
      return {
        primitives: [
          { kind: 'field', unit: major.term, role: 'base' },
          ...Array.from({ length: inter.count }, (): Primitive => ({ kind: 'singleton', item, locus: 'site' })),
        ],
        unmotivated: [],
      }
    },
  },
  {
    name: 'NestedRegions',
    realises: ['container', 'inside', 'interface', 'same-scale', 'extent'],
    build: (c) => {
      const cont = c.get('container'), ins = c.get('inside'), ext = c.get('extent'), face = c.get('interface')
      if (!cont || !ins || ext?.scale !== 'page') return null
      return {
        primitives: [
          { kind: 'region', item: cont.term, place: 'outer' },
          { kind: 'region', item: ins.term, place: 'inner' },
          { kind: 'enclosure', op: ins.op },
          { kind: 'boundary', between: [cont.term, ins.term], axis: ins.op === '⿴' ? 'ring' : 'u' },
          ...(face ? [{ kind: 'singleton', item: face.term, locus: 'site' } as Primitive] : []),
        ],
        unmotivated: [],
      }
    },
  },
  {
    name: 'Frame',
    realises: ['container', 'inside', 'same-scale'],
    build: (c) => {
      const cont = c.get('container'), ins = c.get('inside')
      if (!cont || !ins) return null
      return {
        primitives: [
          { kind: 'field', unit: cont.term, role: 'container' },
          { kind: 'field', unit: ins.term, role: 'contained' },
          { kind: 'enclosure', op: ins.op },
        ],
        // a ring of container units on the page: only the page scale (evidence) asks for one
        unmotivated: c.get('extent')?.scale === 'page' ? [] : ['field:container ring (the extent is the character, not the page)'],
      }
    },
  },
  {
    name: 'GlyphItself',
    realises: ['container', 'inside', 'extent', 'wrapper-zone'],
    build: (c) => {
      const ext = c.get('extent')
      if (ext?.scale !== 'glyph' || (!c.has('inside') && !c.has('wrapper-zone'))) return null
      const whole = c.get('interface')?.term
      if (!whole) return null
      return { primitives: [{ kind: 'singleton', item: whole, locus: 'site' }], unmotivated: [] }
    },
  },
  {
    name: 'CrossRoads',
    realises: ['intersection', 'interface', 'wrapper-zone', 'same-scale', 'container'],
    build: (c) => {
      const x = c.get('intersection')
      if (!x) return null
      const whole = c.get('interface')?.term ?? x.term
      const wrap = c.get('wrapper-zone')
      return {
        primitives: [
          { kind: 'field', unit: x.term, role: 'core' },
          { kind: 'intersection', as: 'absence-roads' },
          { kind: 'singleton', item: whole, locus: 'crossing' },
          ...(wrap ? [{ kind: 'region', item: wrap.term, place: 'band' } as Primitive] : []),
        ],
        unmotivated: [],
      }
    },
  },
  {
    name: 'Separation',
    realises: ['regions', 'axis', 'separation'],
    build: (c) => {
      const r = c.get('regions'), sep = c.get('separation')
      if (!r || !sep) return null
      return {
        primitives: [
          ...r.parts.flatMap((p, i): Primitive[] => (i ? [{ kind: 'separation', axis: sep.axis }, { kind: 'region', item: p, place: 'part' }] : [{ kind: 'region', item: p, place: 'part' }])),
        ],
        unmotivated: [],
      }
    },
  },
  {
    name: 'WholeEmerges',
    realises: ['repeated', 'count', 'same-scale', 'whole-emerges', 'remainder-site'],
    build: (c) => {
      const rep = c.get('repeated'), count = c.get('count'), we = c.get('whole-emerges')
      if (!rep || !count || !we) return null
      return {
        primitives: [
          { kind: 'field', unit: rep.unit, role: 'unit' },
          { kind: 'repetition', n: count.n, arrangement: count.arrangement },
          { kind: 'singleton', item: we.whole, locus: c.has('remainder-site') ? 'remainder' : 'site' },
        ],
        unmotivated: [],
      }
    },
  },
  {
    name: 'ScaleTransfer',
    realises: ['repeated', 'count', 'same-scale'],
    build: (c) => {
      const rep = c.get('repeated'), count = c.get('count')
      // character units only: stroke units carried to page scale are the ASCII art pre-v2 met (品 雨 as diagrams)
      if (!rep || !count || rep.tier !== 'character') return null
      return {
        primitives: [
          { kind: 'repetition', n: count.n, arrangement: count.arrangement },
          ...Array.from({ length: count.n }, (): Primitive => ({ kind: 'region', item: rep.unit, place: 'part' })),
        ],
        unmotivated: [],
      }
    },
  },
  {
    name: 'Sequence',
    realises: ['sequence', 'split', 'recurrence', 'axis', 'rhythm'],
    build: (c) => {
      const s = c.get('sequence')
      if (!s) return null
      return { primitives: [{ kind: 'sequence', of: s.graphemes.map(String) }], unmotivated: [] }
    },
  },
  {
    name: 'Absent',
    realises: [],
    build: () => ({ primitives: [], unmotivated: [] }),
  },
]

export function planCandidates(constraints: readonly Constraint[]): PlanCandidate[] {
  const structural = constraints.filter((c) => !AUX.has(c.kind))
  const bag = new Bag(structural.length ? structural : constraints)
  const out: PlanCandidate[] = []
  for (const r of RULES) {
    if (r.name === 'Sequence' && structural.length) continue
    const b = r.build(bag)
    if (!b) continue
    const satisfied = bag.all.filter((c) => r.realises.includes(c.kind)).map((c) => c.id)
    out.push({ rule: r.name, primitives: b.primitives, realises: r.realises, satisfied, unmotivated: b.unmotivated })
  }
  return out
}

/** §7.3: (unmotivated ASC, satisfied DESC, RULE_ORDER ASC) */
export function selectPlan(candidates: readonly PlanCandidate[]): PlanCandidate {
  const rank = (r: RuleName) => (RULE_ORDER as readonly string[]).indexOf(r)
  return [...candidates].sort((a, b) => a.unmotivated.length - b.unmotivated.length || b.satisfied.length - a.satisfied.length || rank(a.rule) - rank(b.rule))[0]
}

export function plan(constraints: readonly Constraint[], primary: Discovery | null, graphemes: readonly { index: number; char: string }[], language?: { tokens: readonly { start: number; end: number }[]; tokenOf: readonly number[] }): Plan {
  const candidates = planCandidates(constraints)
  const chosen = selectPlan(candidates)
  // the graphemes the chosen plan does not realise itself: a structural plan realises its Discovery's
  // a relation between two of the title's characters takes a character out of the line only where it is a word by
  // itself (大と太); one inside a longer word stays in its word, and the figure writes it as its form only (Stage 11,
  // *failure: 春はあけぼの — け written by the field, あけぼの read あ | け | ぼの across the page*)
  const aWord = (i: number) => {
    const tk = language?.tokens[language.tokenOf[i]]
    return !language || (!!tk && tk.end - tk.start === 1)
  }
  const figure = primary?.level === 'inter-character' ? primary.graphemes.filter(aWord) : primary?.graphemes ?? []
  const own = new Set(chosen.rule === 'Sequence' || chosen.rule === 'Absent' ? graphemes.map((g) => g.index) : figure)
  const rest = chosen.rule === 'Sequence' || chosen.rule === 'Absent' ? [] : graphemes.filter((g) => g.char.trim() && !own.has(g.index)).map((g) => g.index)
  return { selection: { candidates, chosen: chosen.rule, order: 'unmotivated-asc,satisfied-desc,rule-order' }, plan: chosen, rest }
}
