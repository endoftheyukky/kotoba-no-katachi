/**
 * The published generator, pinned: the same words and the same version always
 * give the same page, whatever is published after it.
 *
 *   v1   the page as the trace of what is done to the word: the figure, the
 *        page, the material, the acts, read from the letterforms, the sound,
 *        the word's structure and its meaning (poem/parametric,
 *        language/semantic). Pinned with its meaning table (axes-1) and the
 *        fonts bundled with it.
 *
 * An address names the version that drew it (?v=1); an address with none, or
 * with a version that was never published, is drawn by the current one. A
 * change to what a version writes is a new version beside it, never an edit.
 */
import type { Generator } from '../archive/protocol'
import { readMeaning } from '../language/semantic/load'
import { compose } from './compose'
import type { Analysis, Composition } from './types'

/** the versions an address may name */
export const VERSIONS = [1] as const
export type Version = (typeof VERSIONS)[number]

/** the version new words are written in: the one published now */
export const CURRENT: Version = 1

/** the version an address asks for: one that was published, or the current one */
export function versionOf(param: string | null): Version {
  return VERSIONS.find((v) => String(v) === param) ?? CURRENT
}

/** how the archive names it */
export const archiveName = (v: Version): Generator => `v${v}`

export async function write(analysis: Analysis, version: Version): Promise<Composition> {
  switch (version) {
    case 1:
      return compose(analysis, await readMeaning(analysis.input.text))
  }
}
