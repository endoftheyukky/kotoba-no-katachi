/**
 * Generator v2 (spec-1 §1): Input → Observation → Discovery → Selection → Semantic Resonance →
 * Constraints → SpatialPlan → FieldGeometry → Layout → Rationale. Pure and deterministic over its
 * Observation (observation/index.ts): the title, v1's readings of it (language, the relations between its
 * own glyphs) and the fixed tables as far as the title reaches them. No random number, no model, no network
 * here: v2/runtime.ts observes and hands the observation in.
 *
 * Not yet wired to the site's versions (spec-1 §16 stage 12): CURRENT and VERSIONS stay v1.
 */
import { meaningOf, type MeaningTable } from '../language/semantic/axes'
import { constrain } from './constraints'
import { discover, gates, select } from './discovery'
import { geometry } from './field'
import { layout } from './layout'
import type { RuntimeObservation } from './observation'
import { plan } from './plan'
import { leavesOf, resonate } from './resonance'
import type { V2Composition } from './types/layout'

/** a whole title's axes, where the whole table is at hand (tests, tools): the site reads it by the title's characters */
export const axesOf = (text: string, table: MeaningTable | null) => (table ? meaningOf(text, table) : null)

export function composeV2(o: RuntimeObservation): V2Composition & { trace: Trace } {
  const language = o.language
  const t = o.tables
  const din = { language, structure: t.structure, align: t.align, relations: o.titleRelations }
  const discoveries = discover(din)
  const selection = select(discoveries, din)
  const own = (g: number) => language.graphemes[g]?.char
  const evidence = resonate(discoveries, selection, t.resonance, leavesOf(t.structure), own)
  const set = constrain(discoveries, selection, evidence, language)
  const primary = selection.primary ? discoveries.find((d) => d.id === selection.primary) ?? null : null
  const p = plan(set.constraints, primary, language.graphemes)
  const g = geometry({ plan: p.plan, constraints: set.constraints, primary, align: t.align, language, rest: p.rest, meaning: o.axes })
  const draft = layout({ plan: p.plan, geometry: g.geometry, primary, align: t.align, language })
  const structure: Record<string, string | null> = {}
  for (const gr of language.graphemes) {
    const s = o.structure.get(gr.char)
    if (!(gr.char in structure)) structure[gr.char] = s ? s.ids : null
  }
  return {
    input: o.input,
    version: 2,
    draft,
    rationale: {
      version: 'v2',
      spec: 'spec-1',
      data: o.data,
      observation: { structure, inkNotes: [] },
      discoveries: discoveries.map((d) => {
        const failed = gates(d, din)
        return { id: d.id, eligible: failed.length === 0, failed }
      }),
      selection: { primary: selection.primary, secondary: selection.secondary, reason: selection.none?.reason ?? 'the first by the order of types and the canonical tie-break (§4.3)' },
      resonance: evidence,
      constraints: set.constraints,
      plans: p.selection.candidates,
      plan: p.plan.rule,
      geometries: g.candidates,
      geometry: g.chosen,
      layout: { marks: draft.marks.length, notes: p.rest.length ? [`the rest of the title (graphemes ${p.rest.join(', ')}) in the line the figure stands in (TODO-10)`] : [] },
    },
    trace: { discoveries: discoveries.length, primary, constraints: set.constraints.length, plan: p.plan.rule, geometry: g.geometry },
  }
}

export interface Trace {
  discoveries: number
  primary: ReturnType<typeof discover>[number] | null
  constraints: number
  plan: string
  geometry: ReturnType<typeof geometry>['geometry']
}
