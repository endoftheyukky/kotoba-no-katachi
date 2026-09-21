/**
 * 放射 — RADIAL
 * Parts derived from one character leave it in every direction.
 */
import { clamp } from '../../core/math'
import { EM } from '../../glyph/font'
import { openness } from '../../glyph/parts'
import { PAGE } from '../../render/stage'
import { BANDS } from '../contract'
import { contentGraphemes } from '../salience'
import type { Mark, SpatialComposition } from '../types'
import { allUnits, centredLine, directions, offCentre } from './common'

export const radial: SpatialComposition = {
  id: 'radial',
  title: '放射',
  rules: [
    '一つの字が三つ以上の部品に、縦横両方の継ぎ目で分かれるとき、部品はその字から放射状に派生する',
    '題そのものは小さく核に残る：部品はそこから、自分の重心の方向へ、継ぎ目が開いていたほど遠くへ出る',
    '部品は大きいが紙面を占め尽くさない（large の帯）。部品の重心は紙面の内に留まる。核は紙面の中心に置かない',
    '部品は出ていく向きへ回る：回る量は、継ぎ目が開いていた度合いに比例し、45°を超えない。回転は放射の方向から出るのであって、飾りではない',
  ],

  fit(a, m) {
    const f = m.primary.focus
    if (f.kind !== 'parts' || f.arrangement !== 'mixed' || f.parts.length < 3) return null
    if (f.echo)
      return {
        id: 'radial',
        score: 0.75,
        grounds: [`「${a.graphemes[f.grapheme].char}」の中で同じ形が${f.parts.length}回戻り、縦横に散る → 核からの放射`],
      }
    if (m.primary.op !== 'decomposition') return null
    const single = contentGraphemes(a).length === 1
    return {
      id: 'radial',
      score: single ? 0.8 : 0.45,
      grounds: [`「${a.graphemes[f.grapheme].char}」が${f.parts.length}部品に縦横に分かれる${single ? '（題はこの一字）' : ''} → 核からの放射`],
    }
  },

  realize(a, m, rng, scale) {
    const f = m.primary.focus
    if (f.kind !== 'parts') return { marks: [] }
    const units = allUnits(m)
    const { along } = directions(a)
    const hub = { x: offCentre(rng, 0.25, 0.4), y: offCentre(rng, 0.25, 0.4) }
    const h = scale.pick('body', rng, [0.5, 1])
    const word = centredLine(a, units, hub, h)
    const index = units.findIndex((u) => u.grapheme === f.grapheme)
    const focus = {
      x: hub.x + along.x * (index - (units.length - 1) / 2) * h,
      y: hub.y + along.y * (index - (units.length - 1) / 2) * h,
    }
    const char = a.graphemes[f.grapheme].char
    // 造形: where in the large band
    const S = (BANDS.large[0] + (BANDS.large[1] - BANDS.large[0]) * rng.range(0, 0.35)) * PAGE
    const k = S / EM
    const rays: Mark[] = f.parts.map((p, i) => {
      const c = p.centroid
      const len = Math.hypot(c.x, c.y)
      const angle = len > 1 ? Math.atan2(c.y, c.x) : (i / f.parts.length) * 2 * Math.PI
      const r = S * (0.25 + 0.25 * openness(p)) * rng.range(0.9, 1.15)
      const inside = (v: number) => Math.min(PAGE * 0.94, Math.max(PAGE * 0.06, v))
      const target = { x: inside(focus.x + Math.cos(angle) * r), y: inside(focus.y + Math.sin(angle) * r) }
      // turned toward the way it leaves, as far as it had opened: a part that
      // left upward stays upright, one that left sideways leans into its ray
      const lean = ((angle * 180) / Math.PI + 90 + 540) % 360 - 180
      const rotate = clamp(lean * openness(p), -45, 45)
      // the glyph turns about its own ink centre: place it so that the part,
      // once turned, lands on its ray
      const t = (rotate * Math.PI) / 180
      const off = { x: (c.x * Math.cos(t) - c.y * Math.sin(t)) * k, y: (c.x * Math.sin(t) + c.y * Math.cos(t)) * k }
      return { char, x: target.x - off.x, y: target.y - off.y, size: S, keep: p.keep, rotate: rotate || undefined }
    })
    return { marks: rays.concat(word) }
  },
}
