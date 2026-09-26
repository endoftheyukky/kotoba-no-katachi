/**
 * Generator v2 at run time: a title in, a page and its rationale out, in the browser.
 *
 *   1. the title, normalised as v1 does it (title.ts) — the caller's input
 *   2. v1 analyzeLanguage (unchanged)
 *   3. the title's glyphs in the reading face (v1 GlyphLibrary), and v1 readRelations between them
 *   4. the fixed tables, only the shards the title reaches (observation/tables.ts)
 *   5. axes-1, read by the title's characters as v1 reads it (auxiliary)
 *   6. observe → composeV2 (pure)
 *   7. the glyphs the page writes, prepared so that it can be drawn
 *
 * Not a published version: generators.ts still knows only v1 (spec-1 §16 stage 12, TODO-14).
 */
import { covers } from '../glyph/coverage'
import { readRelations } from '../glyph/relation'
import type { GlyphLibrary } from '../glyph/source'
import { analyzeLanguage } from '../language/analysis'
import type { Meaning } from '../language/semantic/axes'
import type { TitleInput } from '../title'
import { composeV2 } from './compose'
import { observe, type RuntimeObservation } from './observation'
import { tablesFor, type TableSource } from './observation/tables'

export interface V2Runtime {
  /** where the fixed tables are read from */
  source: TableSource
  /** the reading face, measured in this browser */
  glyphs: GlyphLibrary
  /** axes-1 for the title (v1's language/semantic/load readMeaning), or null to write without it */
  meaning: ((text: string) => Promise<Meaning>) | null
}

/** the title observed: what it is, read as facts (spec-1 §2) */
export async function observeTitle(input: TitleInput, env: V2Runtime): Promise<RuntimeObservation> {
  const language = analyzeLanguage(input)
  const own = [...new Set(language.graphemes.map((g) => g.char).filter((c) => c.trim()))]
  const drawn = own.filter((c) => covers('sans', c))
  await env.glyphs.prepare(drawn)
  const metrics = new Map(drawn.map((c) => [c, env.glyphs.get(c).metrics]))
  const titleRelations = metrics.size > 1 ? readRelations(metrics) : []
  // every grapheme's character, spaces too: Discovery asks the tables of each (not finding one is an answer)
  const [tables, axes] = await Promise.all([tablesFor(language.graphemes.map((g) => g.char), env.source), env.meaning ? env.meaning(input.text) : Promise.resolve(null)])
  return observe({ input, language, titleRelations, axes, tables })
}

/** the page of a title, ready to draw */
export async function writeV2(input: TitleInput, env: V2Runtime) {
  const observation = await observeTitle(input, env)
  const composition = composeV2(observation)
  await env.glyphs.prepare([...new Set(composition.draft.marks.map((m) => m.char).filter((c) => covers('sans', c)))])
  return { observation, composition }
}
