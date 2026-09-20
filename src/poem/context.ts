/**
 * Context: the rest of the title, when the poem is built from one part of it.
 *
 * A local feature must not cost the title the rest of itself. What the
 * composition does not place is written back in the order it was written in,
 * at a constant pitch, on the line of the reading — the same device the mora
 * grid uses for っ, applied to characters instead of beats.
 *
 * The seats are what make it legible. Every character of the title has a
 * place in the row; a character the feature has taken away leaves its seat
 * empty, and the seat is as wide as what left it, so the reader can see that
 * only that one has changed.
 *
 * Two asymmetries with the figure:
 *   - context is never enlarged to carry the page, and never bled off it:
 *     its work is to be read, and a cropped context is no context at all;
 *   - context is measured apart from the figure (poem/measure.ts): it does
 *     not count towards the occupancy the feature contracted for.
 *
 * The direction of the reading is linguistic — the title's own writing
 * direction and order. Everything else here (which side of the figure the
 * row runs on, how far from it) is plastic.
 */
import { clamp } from '../core/math'
import { BANDS } from './contract'
import { seatsOf } from './scope'
import type { Analysis, Decision, Material, ScaleBand, Unit } from './types'

/** the smallest a character may be written and still be read at ordinary size */
export const MIN_READABLE = 0.055

const ORDER: ScaleBand[] = ['micro', 'small', 'normal', 'large', 'macro']

function twoBelow(size: number, page: number): number {
  const i = ORDER.findIndex((b) => size / page <= BANDS[b][1])
  return BANDS[ORDER[Math.max(0, (i < 0 ? ORDER.length - 1 : i) - 2)]][1] * page
}

export interface Seat {
  grapheme: number
  /** place in the row of the title's characters */
  index: number
}

export interface ContextPlan {
  /** the leftover units, in title order, with the seat each belongs to */
  units: { unit: Unit; seat: Seat }[]
  /** every character's seat, so an empty one can be read as empty */
  seats: Seat[]
  size: number
  decisions: Decision[]
}

/**
 * What is left of the title once the composition has placed what it wanted.
 * `placed` is the set of graphemes the figure already writes; absent units
 * (a word or a beat the poem writes as space) are not context — their
 * absence is the poem, and their seat stays empty on purpose.
 */
export function planContext(
  a: Analysis,
  m: Material,
  placed: ReadonlySet<number>,
  /** the size at which the figure writes the characters the feature acts on */
  targetSize: number,
  page: number,
): ContextPlan | null {
  const order = seatsOf(a)
  const seats: Seat[] = order.map((grapheme, index) => ({ grapheme, index }))
  const byGrapheme = new Map(seats.map((s) => [s.grapheme, s]))
  const left = m.tokens
    .flat()
    .filter((u) => !u.absent && u.char.trim() && !placed.has(u.grapheme) && byGrapheme.has(u.grapheme))
    .sort((x, y) => x.grapheme - y.grapheme)
  if (!left.length) return null

  // clearly subordinate to the figure, but never below what can be read
  const subordinate = Math.min(BANDS.small[1] * page, targetSize * 0.6)
  const preferred = Math.min(subordinate, twoBelow(targetSize, page))
  const floor = MIN_READABLE * page
  const size = Math.max(floor, Math.min(preferred, targetSize * 0.9))
  const decisions: Decision[] = [
    {
      name: 'context size',
      ground: 'plastic',
      value: (size / page).toFixed(3),
      note:
        size <= preferred + 1e-6
          ? `主要素（${(targetSize / page).toFixed(2)}）より明確に小さく：帯二段下を上限に`
          : `可読の下限（${MIN_READABLE}）が効いている：これ以上小さくすると文脈が読めない`,
    },
    {
      name: 'reading direction',
      ground: 'linguistic',
      value: a.direction === 'vertical' ? '縦' : '横',
      note: '文脈は題の書字方向に、書かれた順のまま並ぶ',
    },
  ]
  return { units: left.map((unit) => ({ unit, seat: byGrapheme.get(unit.grapheme)! })), seats, size, decisions }
}

/**
 * Where the row of seats sits along the reading direction.
 *
 * When the figure writes two of the title's characters at different places
 * along that direction, the pitch is what keeps their seats where they are:
 * the row is stretched so that both land on their own seat, and everything
 * between falls where the writing put it. Otherwise one anchor holds the row
 * and the pitch is the width of what left the seat.
 */
export function seatLine(
  anchors: { index: number; at: number }[],
  seats: number,
  targetExtent: number,
  size: number,
  page: number,
  margin = 0.04,
): { origin: number; pitch: number; derived: boolean } {
  const sorted = [...anchors].sort((x, y) => x.index - y.index)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const chosen = clamp(targetExtent, size * 1.3, (page * (1 - 2 * margin)) / Math.max(1, seats))
  // context is never cropped: the whole row stays on the page
  const lo = margin * page + size / 2
  const hi = page - margin * page - size / 2
  const fits = (pitch: number, anchor: { index: number; at: number }) => {
    const origin = anchor.at - anchor.index * pitch
    return origin >= lo - 1 && origin + (seats - 1) * pitch <= hi + 1
  }

  // when the figure writes two of the title's characters at different places
  // along the reading, the pitch is what puts their seats back under them
  if (sorted.length >= 2 && last.index > first.index) {
    const span = (last.at - first.at) / (last.index - first.index)
    // the order of the writing cannot be reversed by where the figure went
    if (span >= size * 1.05 && fits(span, first)) return { origin: first.at - first.index * span, pitch: span, derived: true }
  }
  // otherwise one anchor holds the row: the first that keeps it on the page
  const anchor = sorted.find((k) => fits(chosen, k)) ?? first
  let pitch = chosen
  let extent = (seats - 1) * pitch
  if (extent > hi - lo) {
    pitch = (hi - lo) / Math.max(1, seats - 1)
    extent = (seats - 1) * pitch
  }
  const origin = clamp(anchor.at - anchor.index * pitch, lo, Math.max(lo, hi - extent))
  return { origin, pitch, derived: false }
}
