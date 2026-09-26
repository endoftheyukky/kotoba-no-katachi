/**
 * Character structure as fact (spec-1 §2.2): a normalised IDS tree whose leaves
 * carry the tier they belong to. The structure says *what* a character is made
 * of; where that stands in the reading face is the ink's matter (observation.ts).
 */
import type { Provenance } from './provenance'

/**
 * character  a standalone character (KANJIDIC2 grade 1–10); 囗 is written as 口
 * variant    the form a character takes as a radical (氵→水, 亻→人, 辶 …): never written alone
 * component  an encoded component with no reading of its own (吅 𠂉 …): always opened
 * stroke     a single stroke (一 丨 丿 丶 乙 and the CJK strokes block)
 * unknown    an unencoded component ({nn})
 */
export type Tier = 'character' | 'variant' | 'component' | 'stroke' | 'unknown'

export type IdsOperator = '⿰' | '⿱' | '⿲' | '⿳' | '⿴' | '⿵' | '⿶' | '⿷' | '⿸' | '⿹' | '⿺' | '⿻'

/** full enclosure, partial enclosure, overlap: the operators the Discovery types name */
export type FullEnclosureOperator = '⿴' | '⿵' | '⿶' | '⿷'
export type PartialEnclosureOperator = '⿸' | '⿹' | '⿺'

export type IdsNode =
  | { kind: 'op'; op: IdsOperator; children: readonly IdsNode[] }
  | { kind: 'leaf'; char: string; tier: Tier }

export interface CharStructure {
  char: string
  /** the IDS as the table gives it (BabelStone, the Japanese source preferred) */
  ids: string
  /** normalised: components opened, homogeneous repetitions seen through, strokes only where the data writes them */
  tree: IdsNode
  source: 'babelstone-j' | 'babelstone-other'
  /** an unencoded component named by another source's IDS (州: ⿻川⿲丶丶丶) */
  named?: string
  provenance: Provenance
}
