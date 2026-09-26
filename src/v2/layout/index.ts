/**
 * Layout (spec-1 §9): the chosen geometry written as marks, and nothing more. Every position, size,
 * count and cut comes from the FieldGeometry; Layout adds no decision of its own. The output is v1's
 * Draft, so v1's renderers and invariants read it unchanged.
 *
 *   the title's own characters   written once, with their grapheme (the derived character, the whole,
 *                                the interface, the character itself, the words of a line)
 *   the units of a field         components the structure guarantees (R4), written as themselves;
 *                                a stroke unit is the whole cut to one island of its ink (keep)
 *   the parts of a composition   written as themselves, together standing for the title's character
 *                                (represents): the character is on the page as its parts, apart
 *   v2.0: one face (the reading face, sans), black on white, still
 */
import { cellAt } from '../field/grid'
import { CONSTANTS } from '../spec'
import type { Discovery } from '../types/discovery'
import type { FieldGeometry } from '../types/field'
import type { PlanCandidate } from '../types/plan'
import type { AlignIndex } from '../align/lookup'
import type { LanguageAnalysis } from '../../language/analysis'
import type { Draft, Mark } from '../../poem/types'

export interface LayoutArgs {
  plan: PlanCandidate
  geometry: FieldGeometry
  primary: Discovery | null
  align: AlignIndex
  language: LanguageAnalysis
}

const r2 = (v: number) => Math.round(v * 100) / 100

export function layout(a: LayoutArgs): Draft {
  const g = a.geometry
  const d = g.detail ?? {}
  const marks: Mark[] = []
  const p = a.primary
  // the grapheme a character of the relation writes: the title's own index of that character in the relation
  // (an inter-character relation lies across two of them), else the relation's first
  const own = p ? p.graphemes[0] : -1
  const indexOf = (char: string) => (p ? p.graphemes.find((i) => a.language.graphemes[i]?.char === char) ?? own : own)
  const title = (char: string, x: number, y: number, size: number, grapheme: number, role: Mark['role'] = 'nucleus'): Mark => ({ char, face: 'sans', x: r2(x), y: r2(y), size: r2(size), grapheme, role })
  const unit = (char: string, x: number, y: number, size: number, note: string, extra: Partial<Mark> = {}): Mark => ({
    char, face: 'sans', x: r2(x), y: r2(y), size: r2(size), role: 'grain',
    derived: { grammar: 'material', kind: 'form', from: own >= 0 ? own : undefined, note }, ...extra,
  })
  const again = (char: string, x: number, y: number, size: number, note: string): Mark => ({
    char, face: 'sans', x: r2(x), y: r2(y), size: r2(size), role: 'body',
    derived: { grammar: 'material', kind: 'repeat', from: indexOf(char), note },
  })

  switch (a.plan.rule) {
    case 'FieldSingleton':
    case 'FieldInterleave':
    case 'CrossRoads': {
      const grid = d.grid!
      const cols = g.cols!
      const rows = g.rows!
      const u = g.unitSize
      const empty = new Set((d.empty ?? []).map((e) => `${e.row},${e.col}`))
      const sp = d.span
      const inter = d.interleave
      let first = true
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          if (empty.has(`${r},${c}`)) continue
          const at = cellAt(grid, r, c)
          if (sp && sp.row === r && sp.col === c) {
            if (sp.role === 'singleton' && g.singleton?.point) {
              // the derived character with its base part on this cell (align: base-part)
              marks.push(title(sp.item, g.singleton.point.x, g.singleton.point.y, u * g.singleton.scale, indexOf(sp.item)))
            } else marks.push(title(sp.item, at.x, at.y, u, indexOf(sp.item)))
            continue
          }
          if (inter && inter.row === r && inter.cols.includes(c)) {
            marks.push(first ? title(inter.item, at.x, at.y, u, indexOf(inter.item)) : again(inter.item, at.x, at.y, u, 'the derived character among its base, once more'))
            first = false
            continue
          }
          marks.push(unit(d.unit!, at.x, at.y, u, 'a unit of the field (structure-1)'))
        }
      break
    }
    case 'RegionSplit': {
      const grid = d.grid!
      for (let r = 0; r < g.rows!; r++)
        for (let c = 0; c < g.cols!; c++) {
          const at = cellAt(grid, r, c)
          marks.push(unit(d.unit!, at.x, at.y, g.unitSize, 'a unit of the base field (structure-1)'))
        }
      ;(d.points ?? []).forEach((q, i) => marks.push(i === 0 ? title(d.band!.item, q.x, q.y, g.unitSize, indexOf(d.band!.item)) : again(d.band!.item, q.x, q.y, g.unitSize, 'the band of the derived character')))
      break
    }
    case 'NestedRegions':
    case 'Frame': {
      const box = g.extent!
      const ring = d.ring!
      const cols = g.cols!
      const rows = g.rows!
      const step = box.w / cols
      const u = g.unitSize
      const on = (s: string) => ring.sides.includes(s as never)
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const side = (r === 0 && on('top')) || (r === rows - 1 && on('bottom')) || (c === 0 && on('left')) || (c === cols - 1 && on('right'))
          if (side) marks.push(unit(ring.item, box.x + (c + 0.5) * step, box.y + (r + 0.5) * step, u, 'the container (structure-1)'))
        }
      const istep = ring.inner.w / ring.innerCols
      const face = d.interfaceAt
      for (let r = 0; r < ring.innerRows; r++)
        for (let c = 0; c < ring.innerCols; c++) {
          if (face?.cell && face.cell.row === r && face.cell.col === c) continue
          marks.push(unit(ring.innerItem, ring.inner.x + (c + 0.5) * istep, ring.inner.y + (r + 0.5) * istep, u, 'the contained (structure-1)'))
        }
      if (face) marks.push(title(face.item, face.x, face.y, face.size, indexOf(face.item)))
      break
    }
    case 'GlyphItself': {
      const [q] = d.parts ?? []
      marks.push(title(q.item, q.rect.x + q.rect.w / 2, q.rect.y + q.rect.h / 2, Math.min(q.rect.w, q.rect.h), own))
      break
    }
    case 'Separation': {
      for (const q of d.parts ?? []) {
        const size = Math.min(q.rect.w, q.rect.h)
        marks.push(unit(q.item, q.rect.x + q.rect.w / 2, q.rect.y + q.rect.h / 2, size, 'a part of the character, apart (structure-1)', { role: 'body', represents: own }))
      }
      break
    }
    case 'WholeEmerges': {
      const s = g.singleton!
      const W = s.scale * g.unitSize
      marks.push(title(s.item, s.point!.x, s.point!.y, W, own))
      const su = d.strokeUnit
      const e = su ? a.align.entry(su.whole) : null
      const islands = su && e?.ink ? su.islands.map((i) => e.ink!.islands[i]) : []
      ;(d.points ?? []).forEach((q, i) => {
        if (su && islands.length) {
          // a stroke unit: the whole cut to one of its alike islands, at the whole's own scale
          const isl = islands[i % islands.length]
          marks.push(unit(su.whole, q.x, q.y, W, 'a stroke unit: the whole cut to one island of its ink (align-1)', { keep: [...isl.keep], shift: { x: -isl.centroid.x, y: -isl.centroid.y } }))
        } else marks.push(unit(d.unit!, q.x, q.y, g.unitSize, 'a unit of the whole (structure-1)'))
      })
      break
    }
    case 'Sequence':
    case 'Absent':
      break
  }
  // a flow: the title's graphemes, each at its point (Sequence; the rest of a longer title)
  for (const f of [...(d.flow ? [d.flow] : []), ...(d.flows ?? [])])
    for (const p of f.points) marks.push(title(a.language.graphemes[p.grapheme].char, p.x, p.y, f.size, p.grapheme, 'body'))
  // lines: the words (Absent) and the rest of a longer title (TODO-10)
  for (const line of [...(d.line ? [d.line] : []), ...(d.rest ?? [])]) {
    const step = line.role === 'context' ? line.size * CONSTANTS.UNIT_SPACING.value : line.size
    let at = 0
    for (const gi of line.graphemes) {
      if (line.breaks.includes(gi)) at += 0.5
      const ch = a.language.graphemes[gi].char
      const x = line.axis === 'horizontal' ? line.rect.x + (at + 0.5) * step : line.rect.x + line.rect.w / 2
      const y = line.axis === 'horizontal' ? line.rect.y + line.rect.h / 2 : line.rect.y + (at + 0.5) * step
      marks.push(title(ch, x, y, line.size, gi, line.role === 'context' ? 'context' : 'body'))
      at += 1
    }
  }
  // a unit that is itself a character of the title writes it, at the point FieldGeometry names; the others repeat it
  for (const t of d.titleUnits ?? []) {
    const char = a.language.graphemes[t.grapheme].char
    const i = marks.findIndex((m) => m.derived && !m.keep && m.char === char && Math.abs(m.x - t.x) < 0.6 && Math.abs(m.y - t.y) < 0.6)
    if (i >= 0) marks[i] = title(char, marks[i].x, marks[i].y, marks[i].size, t.grapheme, 'body')
  }
  return { marks }
}
