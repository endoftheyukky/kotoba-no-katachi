/**
 * Scale regime — decided once per poem, before the space is drawn, and
 * separately from it. Spaces ask for sizes by role (result / body / aside);
 * they no longer choose their own.
 *
 * The one principle: macro is permitted only for what an operation has
 * produced — a residue, the parts of a glyph. It is never the default way of
 * giving a word weight.
 */
import { PAGE } from '../render/stage'
import type { Analysis, Material, Scale, ScaleRegime, ScaleRole, SpatialId } from './types'

/** em size per glyph, as a fraction of the page */
const RANGE = {
  micro: [0.035, 0.07],
  normal: [0.1, 0.3],
  macro: [0.55, 1.1],
} as const

type Size = keyof typeof RANGE

const ROLES: Record<ScaleRegime, Record<ScaleRole, Size>> = {
  micro: { result: 'micro', body: 'micro', aside: 'micro' },
  normal: { result: 'normal', body: 'normal', aside: 'micro' },
  macro: { result: 'macro', body: 'normal', aside: 'micro' },
  mixed: { result: 'macro', body: 'micro', aside: 'micro' },
}

export const SCALE_RULES = [
  'macro は操作が生んだもの（引き算の残り、字の部品）にだけ許す。語に重みを与えるための既定値にはしない',
  '字形の包含 → macro：残りだけが大きく、取り出された字は normal',
  '字の部品 → mixed：部品は大きく、元の題は小さく、その間はない',
  '関係が弱い題（片隅） → micro：すべて小さい',
  'それ以外（反復・二項・依存・欠落・散在） → normal：関係は同じ尺度の字どうしの配置として見せる',
]

function regimeOf(m: Material, space: SpatialId): { regime: ScaleRegime; grounds: string } {
  const f = m.primary.focus
  if (space === 'cluster') return { regime: 'micro', grounds: '関係が弱い：すべて小さく' }
  if (f.kind === 'pair' && f.relation.kind === 'containment')
    return { regime: 'macro', grounds: '引き算の残りは操作の結果：残りだけが大きい' }
  if (f.kind === 'parts') return { regime: 'mixed', grounds: '部品は操作の結果：部品は大きく、題は小さく' }
  return { regime: 'normal', grounds: '関係は同じ尺度の字どうしの配置として見せる' }
}

export function decideScale(_a: Analysis, m: Material, space: SpatialId): Scale {
  const { regime, grounds } = regimeOf(m, space)
  const range = (role: ScaleRole): [number, number] => {
    const [lo, hi] = RANGE[ROLES[regime][role]]
    return [lo * PAGE, hi * PAGE]
  }
  return {
    regime,
    grounds,
    range,
    pick(role, rng, within = [0, 1]) {
      const [lo, hi] = range(role)
      const a = lo + (hi - lo) * within[0]
      const b = lo + (hi - lo) * within[1]
      return rng.range(a, b)
    },
  }
}
