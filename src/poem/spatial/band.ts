/**
 * 帯 — BAND
 * A unit that repeats inside the title multiplies where it stands; the title
 * becomes one long line crossing the page. A glyph whose parts lie side by
 * side unfolds into a band of its parts.
 */
import { clamp } from '../../core/math'
import { EM } from '../../glyph/font'
import { PAGE } from '../../render/stage'
import { BANDS, TEXTURE } from '../contract'
import { contentGraphemes } from '../salience'
import type { Mark, SpatialComposition, Unit } from '../types'
import { allUnits, directions, centredLine, isWritten, lineMarks, offCentre, unitMarks } from './common'

export const band: SpatialComposition = {
  id: 'band',
  title: '帯',
  rules: [
    '題の一部が反復するとき（ささやき・許許・コーヒーのー）、反復する単位はその場で増殖し、題は紙面を端から端まで渡る一本の帯になる。帯の字は小さい：増えた数が帯を作るのであって、一字の大きさではない',
    '帯は書き始めの側の縁に寄る。帯以外は白',
    '増えた字の並びは段をなす：一つ増えるごとに、帯は書字と直角の向きへ一段ずれ、ずれたまま先へ続く。段は題のどこが増えたかを示し、増えるたびに積み重なる。一段の深さは造形',
    '部品が一方向に並んで切れる字（川）は、部品が紙面を渡る帯としてほどける。題がその一字であるか、四つ以上の部品が縞をなすときに限る。元の題は小さく帯の始まりに残る。部品は拡大しない：ほどけた間隔が紙面を渡る（large の帯）',
  ],

  fit(a, m) {
    const f = m.primary.focus
    if (m.primary.op === 'proliferation' && f.kind === 'repetition' && !f.whole)
      return {
        id: 'band',
        score: f.contiguous ? 0.85 : 0.7,
        grounds: [f.contiguous ? `「${f.value}」が直に続く → その場で増殖する帯` : `「${f.value}」が離れて反復する → 各所で伸びる帯`],
      }
    if (f.kind === 'parts' && f.echo && f.arrangement !== 'mixed')
      return {
        id: 'band',
        score: 0.75,
        grounds: [`「${a.graphemes[f.grapheme].char}」の中で同じ形が${f.parts.length}回、一方向に戻る → 反復の帯`],
      }
    if (m.primary.op === 'decomposition' && f.kind === 'parts' && f.arrangement !== 'mixed' && f.parts.length >= 3) {
      const single = contentGraphemes(a).length === 1
      if (single || f.parts.length >= 4)
        return { id: 'band', score: 0.8, grounds: [`「${a.graphemes[f.grapheme].char}」の${f.parts.length}部品が一方向に並ぶ${single ? '（題はこの一字）' : '（縞）'} → 部品の帯`] }
    }
    return null
  },

  realize(a, m, rng, scale) {
    const f = m.primary.focus
    const { vertical } = directions(a)
    const units = allUnits(m)

    if (f.kind === 'repetition') {
      const recurring = new Set(f.occurrences.flat())
      const r = units.filter((u) => recurring.has(u.grapheme)).length
      // the band's characters are texture: how many of them cross the page is
      // what is seen. 造形: where in that range
      const target = Math.floor(1 / (TEXTURE[0] + (TEXTURE[1] - TEXTURE[0]) * rng.range(0.1, 0.5)))
      const times = Math.max(2, Math.floor((target - units.length) / Math.max(1, r)) + 1)
      const line: { unit: Unit; copy: number }[] = units.flatMap((u) =>
        recurring.has(u.grapheme) ? Array.from({ length: times }, (_, copy) => ({ unit: u, copy })) : [{ unit: u, copy: -1 }],
      )
      const s = PAGE / line.length
      // every copy after the first of its run is one step: the line moves
      // away from the edge it started from and keeps the distance it gained
      const steps = line.filter((k) => k.copy > 0).length
      // 造形: how deep a step is, and how far from the edge the band begins
      const edge = rng.range(0.04, 0.12) * PAGE
      const step = Math.min(s * rng.range(0.25, 0.45), (0.8 * PAGE - edge) / Math.max(1, steps))
      const { along } = directions(a)
      // away from the edge where the writing begins
      const inward = vertical ? { x: -1, y: 0 } : { x: 0, y: 1 }
      let depth = 0
      const marks: Mark[] = []
      line.forEach(({ unit, copy }, i) => {
        if (copy > 0) depth += step
        const base = vertical ? { x: PAGE - edge, y: s / 2 } : { x: s / 2, y: edge }
        const at = {
          x: base.x + along.x * i * s + inward.x * depth,
          y: base.y + along.y * i * s + inward.y * depth,
        }
        marks.push(...unitMarks(a, unit, at, s * 0.96))
      })
      return { marks }
    }

    if (f.kind === 'absence') {
      // one square per beat, at a constant pitch: the silent mora keeps its place
      const read = a.morae.filter((mo) => mo.kind !== 'unread')
      const slots = read.map((mo) => units.filter((u) => mo.graphemes.includes(u.grapheme)))
      const n = Math.max(1, slots.length)
      const [, hi] = scale.range('body')
      const s = Math.min(hi, (0.86 * PAGE) / n)
      const start = (PAGE - n * s) / 2 + s / 2
      // 造形: which line across the page the row of beats runs on
      const across = clamp(offCentre(rng), 0.14 * PAGE, 0.86 * PAGE)
      const marks = slots.flatMap((slot, i) => {
        const written = slot.filter(isWritten)
        if (!written.length) return []
        const t = start + i * s
        const centre = vertical ? { x: across, y: t } : { x: t, y: across }
        return centredLine(a, written, centre, s / written.length)
      })
      return { marks }
    }

    if (f.kind === 'parts') {
      const g = a.graphemes[f.grapheme]
      // the parts cross the page by being spread out, not by being enlarged:
      // each keeps the size it would have in a large character. 造形: where in
      // the large band
      const S = (BANDS.large[0] + (BANDS.large[1] - BANDS.large[0]) * rng.range(0.2, 0.6)) * PAGE
      const k = S / EM
      // the parts spread across the page along the direction of their cuts
      const byX = f.arrangement === 'row'
      const order = [...f.parts].sort((p, q) => (byX ? p.centroid.x - q.centroid.x : p.centroid.y - q.centroid.y))
      const line = offCentre(rng)
      const marks: Mark[] = order.map((p, i) => {
        const t = ((i + 0.5) / order.length) * PAGE + rng.range(-0.03, 0.03) * PAGE
        return byX
          ? { char: g.char, x: t - p.centroid.x * k, y: line, size: S, keep: p.keep }
          : { char: g.char, x: line, y: t - p.centroid.y * k, size: S, keep: p.keep }
      })
      // the whole title, small, where the band begins
      const s = scale.pick('aside', rng)
      const at = byX
        ? { x: vertical ? PAGE - s * 1.5 : s * 1.5, y: line + (line < PAGE / 2 ? 1 : -1) * S * 0.45 }
        : { x: line + (line < PAGE / 2 ? 1 : -1) * S * 0.45, y: s * 1.5 }
      return { marks: marks.concat(vertical ? lineMarks(a, units, at, s) : centredLine(a, units, at, s)) }
    }
    return { marks: [] }
  },
}
