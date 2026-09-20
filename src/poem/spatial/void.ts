/**
 * 空洞 — VOID
 * When what is missing is the strongest thing in the title, the missing part
 * takes the page and the rest is pushed to its edges.
 */
import { PAGE } from '../../render/stage'
import type { Mark, SpatialComposition, Unit } from '../types'
import { allUnits, directions, lineMarks } from './common'

export const voidSpace: SpatialComposition = {
  id: 'void',
  title: '空洞',
  rules: [
    '否定・促音・関係語の欠落が題の主題であるとき、欠けた部分が紙面の大半を占める',
    '残った字は小さく、欠落の前にあるものは書き始めの縁に、後にあるものは反対の縁に寄る',
    '欠落が題の終わりにあるとき、白は紙面の終わりまで続く',
  ],

  fit(_a, m) {
    const f = m.primary.focus
    if (m.primary.op !== 'absence' || f.kind !== 'absence') return null
    if (f.negation) return { id: 'void', score: 0.9, grounds: ['否定 → 否定されたものの場所が紙面を占める'] }
    if (f.silence) return { id: 'void', score: 0.8, grounds: ['促音 → 拍の沈黙が紙面を占める'] }
    return { id: 'void', score: 0.35, grounds: ['関係語の欠落'] }
  },

  realize(a, m, rng, scale) {
    const units = allUnits(m)
    const { vertical } = directions(a)
    // runs: written stretches and absent stretches, in order
    const runs: { absent: boolean; units: Unit[] }[] = []
    for (const u of units) {
      const absent = !!u.absent
      const last = runs[runs.length - 1]
      if (last && last.absent === absent) last.units.push(u)
      else runs.push({ absent, units: [u] })
    }
    const s = scale.pick('body', rng, [0, 0.12])
    const margin = rng.range(0.06, 0.12) * PAGE
    const writtenCount = runs.filter((r) => !r.absent).reduce((t, r) => t + r.units.length, 0)
    const absentCount = runs.filter((r) => r.absent).reduce((t, r) => t + r.units.length, 0) || 1
    const voidLength = PAGE - 2 * margin - writtenCount * s
    // 造形: the line runs near the edge where writing begins
    const line = vertical ? PAGE - rng.range(0.08, 0.24) * PAGE : rng.range(0.08, 0.24) * PAGE
    let t = margin + s / 2
    const marks: Mark[] = []
    for (const r of runs) {
      if (r.absent) {
        t += (voidLength * r.units.length) / absentCount
        continue
      }
      marks.push(...lineMarks(a, r.units, vertical ? { x: line, y: t } : { x: t, y: line }, s))
      t += r.units.length * s
    }
    return { marks }
  },
}
