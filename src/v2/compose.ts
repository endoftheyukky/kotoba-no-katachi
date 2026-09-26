/**
 * Generator v2 (spec-1 §1): Input → Observation → Discovery → Selection → Semantic Resonance →
 * Constraints → SpatialPlan → FieldGeometry → Layout → Rationale. Pure and deterministic over its
 * inputs: the title, v1's readings of it (language, and the relations between its own glyphs), and the
 * fixed tables. No random number, no model, no network here; the caller hands the tables in.
 *
 * Not yet wired to the site (spec-1 §16 stages 10–12): CURRENT and VERSIONS stay v1.
 */
import type { GlyphRelation } from '../glyph/relation'
import { analyzeLanguage } from '../language/analysis'
import { meaningOf, type MeaningTable } from '../language/semantic/axes'
import type { TitleInput } from '../title'
import type { AlignIndex } from './align/lookup'
import { constrain } from './constraints'
import { discover, gates, select } from './discovery'
import { geometry } from './field'
import { layout } from './layout'
import { plan } from './plan'
import { leavesOf, resonanceIndex, resonate } from './resonance'
import type { StructureIndex } from './structure/lookup'
import type { V2Composition } from './types/layout'
import type { DataVersions } from './types/provenance'

export interface V2Tables {
  structure: StructureIndex
  align: AlignIndex
  resonance: ReturnType<typeof resonanceIndex>
  /** axes-1: auxiliary only (§5.4); null where it is not at hand */
  axes: MeaningTable | null
  data: DataVersions
}

export function composeV2(input: TitleInput, relations: readonly GlyphRelation[], t: V2Tables): V2Composition & { trace: Trace } {
  const language = analyzeLanguage(input)
  const din = { language, structure: t.structure, align: t.align, relations }
  const discoveries = discover(din)
  const selection = select(discoveries, din)
  const own = (g: number) => language.graphemes[g]?.char
  const evidence = resonate(discoveries, selection, t.resonance, leavesOf(t.structure), own)
  const set = constrain(discoveries, selection, evidence, language)
  const primary = selection.primary ? discoveries.find((d) => d.id === selection.primary) ?? null : null
  const p = plan(set.constraints, primary, language.graphemes)
  const meaning = t.axes ? meaningOf(input.text, t.axes) : null
  const g = geometry({ plan: p.plan, constraints: set.constraints, primary, align: t.align, language, rest: p.rest, meaning })
  const draft = layout({ plan: p.plan, geometry: g.geometry, primary, align: t.align, language })
  const structure: Record<string, string | null> = {}
  for (const gr of language.graphemes) {
    const s = t.structure.lookup(gr.char)
    if (!(gr.char in structure)) structure[gr.char] = s.status === 'found' ? s.structure.ids : null
  }
  return {
    input,
    version: 2,
    draft,
    rationale: {
      version: 'v2',
      spec: 'spec-1',
      data: t.data,
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
      layout: { marks: draft.marks.length, notes: p.rest.length ? [`the rest of the title (graphemes ${p.rest.join(', ')}) beside the figure, in reading order (TODO-10)`] : [] },
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
