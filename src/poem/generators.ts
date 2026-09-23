/**
 * The published generators, each pinned: the same words and the same version
 * always give the same page, whatever is published after it.
 *
 *   v1   the first generator, frozen (?v=1)
 *   v2   v2c: spatial compositions and mark grammars — every address shared
 *        without a version is this one, and stays this one
 *   v3   the page as the trace of what is done to the word: the figure, the
 *        page, the material, the acts, read from the letterforms, the sound, the
 *        word's structure and its meaning (poem/parametric, language/semantic).
 *        Pinned with its meaning table (axes-1) and the fonts bundled with it.
 *
 * A change to what any of these writes is a new version, never an edit.
 */
import type { Generator } from '../archive/protocol'
import { readMeaning } from '../language/semantic/load'
import { compose } from './compose'
import type { Analysis, Composition } from './types'

export type Version = 1 | 2 | 3

/** the version new words are written in: the one published now */
export const CURRENT: Version = 3

/** the version an address asks for: v=1, v=3, or — with none — v2c, as every address shared before v3 */
export function versionOf(param: string | null): Version {
  if (param === '1') return 1
  if (param === '3') return 3
  return 2
}

/** how the archive names it */
export const archiveName = (v: Version): Generator => (v === 1 ? 'v1' : v === 2 ? 'v2c' : 'v3')

export async function write(analysis: Analysis, version: Version): Promise<Composition> {
  if (version === 1) return compose(analysis, {})
  if (version === 2) return compose(analysis, { grammar: 'auto' })
  const meaning = await readMeaning(analysis.input.text)
  return compose(analysis, { parametric: 'auto', meaning })
}
