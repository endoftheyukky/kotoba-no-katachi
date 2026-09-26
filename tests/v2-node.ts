// v2 in node (tests only): the fixed tables read from the files the site serves, the title observed without
// a browser. v1's readRelations needs the face measured in a browser, so the node pages are composed without
// the relations between the title's own glyphs (the evaluation pages, tools/v2/eval.mjs, have them).
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { analyzeLanguage } from '../src/language/analysis'
import { parseTable } from '../src/language/semantic/axes'
import { normalizeTitle } from '../src/title'
import { axesOf, composeV2 } from '../src/v2/compose'
import { observe } from '../src/v2/observation'
import { tablesFor, type TableSource } from '../src/v2/observation/tables'

export const root = join(import.meta.dirname, '..')

/** the tables as files, counting what was read */
export function fileSource(): TableSource & { reads: string[] } {
  const reads: string[] = []
  return {
    reads,
    manifest: async (id) => JSON.parse(readFileSync(join(root, 'public/v2', id, 'manifest.json'), 'utf8')),
    shard: async (id, file) => {
      reads.push(`${id}/${file}`)
      return JSON.parse(readFileSync(join(root, 'public/v2', id, file), 'utf8'))
    },
  }
}

const axDir = join(root, 'public/semantic/axes-1')
export const axesTable = parseTable('axes-1', readdirSync(axDir).filter((f) => f.endsWith('.tsv')).sort().map((f) => readFileSync(join(axDir, f), 'utf8')).join('\n'))

export async function observeNode(text: string, reading?: string, source: TableSource = fileSource()) {
  const input = normalizeTitle({ text, reading })
  if (typeof input === 'string') throw new Error(input)
  const language = analyzeLanguage(input)
  const tables = await tablesFor(language.graphemes.map((g) => g.char), source)
  return observe({ input, language, titleRelations: [], axes: axesOf(input.text, axesTable), tables })
}

export async function composeNode(text: string, reading?: string) {
  return composeV2(await observeNode(text, reading))
}
