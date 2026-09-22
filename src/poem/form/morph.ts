/**
 * v3 — a page that becomes a second composition along its reading.
 *
 * v2c takes the composition whose fitness is highest and discards the rest,
 * however close. Where a second composition holds the same title almost as
 * well — the title is genuinely between two ways of being held — the page is
 * allowed to turn toward it. Not everywhere at once: a page moved halfway
 * everywhere keeps the reason of neither (v3b: a nest half a centre is only a
 * weaker nest). The transformation unfolds along the reading instead: the
 * page begins as the composition v2c chose, and from the place where the
 * reading turns (its first word boundary, else its middle) its marks move
 * progressively toward where the second composition would put them. What the
 * grammar added moves with the title marks nearest it.
 *
 * How far is not chosen: it is the closeness of the two fitnesses. At a tie
 * the end of the reading goes a little over half way (MAX_WEIGHT); below
 * RATIO_FLOOR the second is not a near-equal and the page stays as it was.
 * Two compositions that differ mainly in scale or in how many marks they
 * write (a large figure and a field of copies) are not neighbours in form:
 * between them the page would only shrink.
 */
import type { Analysis, Mark } from '../types'

export const RATIO_FLOOR = 0.7
export const MAX_WEIGHT = 0.55

/** how far toward the second composition at the end of the reading, from the ratio of its fitness to the first's */
export const morphWeight = (ratio: number) => (ratio < RATIO_FLOOR ? 0 : MAX_WEIGHT * Math.min(1, (ratio - RATIO_FLOOR) / (1 - RATIO_FLOOR)) ** 0.8)

/** one key per mark of the title: its grapheme and which occurrence of it (a part keeps its own key) */
function keys(marks: Mark[]): (string | null)[] {
  const seen = new Map<string, number>()
  return marks.map((k) => {
    if (k.derived || k.grapheme === undefined) return null
    const base = `${k.grapheme}${k.keep ? 'k' : ''}${k.context ? 'c' : ''}`
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    return `${base}#${n}`
  })
}

/** whether two compositions of one title are neighbours in form, not only in fitness */
export function neighbours(a: Mark[], b: Mark[]): string | null {
  const own = (m: Mark[]) => m.filter((k) => !k.derived)
  const top = (m: Mark[]) => Math.max(0, ...own(m).map((k) => k.size))
  const ratio = top(a) / (top(b) || 1)
  if (ratio > 1.6 || ratio < 1 / 1.6) return `the two differ in scale (largest mark ×${ratio.toFixed(2)})`
  const count = own(a).length / (own(b).length || 1)
  if (count > 3 || count < 1 / 3) return `the two write different numbers of marks (${own(a).length} / ${own(b).length})`
  return null
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0 || 1)))
  return t * t * (3 - 2 * t)
}

/** shortest turn from one angle to another, in degrees */
const turnBetween = (from: number, to: number) => ((((to - from) % 360) + 540) % 360) - 180

export function morph(an: Analysis, a: Mark[], b: Mark[], w: number): Mark[] {
  if (w <= 0) return a
  const kb = keys(b)
  const other = new Map<string, Mark>()
  kb.forEach((k, i) => k && other.set(k, b[i]))
  const ka = keys(a)
  const n = an.graphemes.length
  // where the reading turns: the first word boundary among the title's written characters
  const boundary = an.graphemes.findIndex((g, i) => i > 0 && an.tokenOf[i] !== an.tokenOf[i - 1] && g.char.trim())
  const start = boundary > 0 ? boundary / n : 0.5
  const at = (g: number) => w * smooth(start - 0.5 / n, 1, (g + 0.5) / n)
  const moves: { x: number; y: number; dx: number; dy: number }[] = []
  const out = a.map((k, i) => {
    const key = ka[i]
    const q = key ? other.get(key) : undefined
    if (!q || k.grapheme === undefined) return null
    const wi = at(k.grapheme)
    const dx = (q.x - k.x) * wi
    const dy = (q.y - k.y) * wi
    moves.push({ x: k.x, y: k.y, dx, dy })
    const rot = (k.rotate ?? 0) + turnBetween(k.rotate ?? 0, q.rotate ?? 0) * wi
    const { rotate: _, ...rest } = k
    return { ...rest, x: k.x + dx, y: k.y + dy, size: k.size * (q.size / k.size) ** wi, ...(Math.abs(rot) > 0.01 ? { rotate: rot } : {}) }
  })
  if (!moves.length) return a
  return a.map((k, i) => {
    if (out[i]) return out[i]!
    let sx = 0
    let sy = 0
    let sw = 0
    for (const m of moves) {
      const d2 = (m.x - k.x) ** 2 + (m.y - k.y) ** 2 + 1
      const wt = 1 / (d2 * d2)
      sx += wt * m.dx
      sy += wt * m.dy
      sw += wt
    }
    return { ...k, x: k.x + sx / sw, y: k.y + sy / sw }
  })
}
