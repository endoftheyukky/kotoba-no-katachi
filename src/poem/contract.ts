/**
 * The contract a composition works under: how much of the page the figure
 * claims (occupancy), and how large its marks are (scale).
 *
 * These are two measures, not one. A page is alive when either the marks are
 * large or the figure reaches across the page; it dies when a few small marks
 * sit in a small part of it. Small marks in a great emptiness remain possible:
 * the rules below never enlarge a mark for being alone, only for being what
 * the poem asks the reader to read.
 *
 *   reach   the longer side of the figure, as a share of the page
 *   fill    how much of that reach is ink rather than the white inside it
 *   band    the size of a single mark
 *
 * Nothing here is chosen by the seed. The seed is allowed a final ±6% on a
 * size that is already decided (`jitter`), and nothing more.
 *
 * This module is general. For now only AxisComposition draws under it; the
 * other spaces keep their own sizing until each is moved over in turn.
 */
import { clamp } from '../core/math'
import type { Rng } from '../core/random'
import type { Decision, Fitted, FitRequest, Occupancy, ScaleBand, Spread } from './types'

/** em size of one mark, as a share of the page */
export const BANDS: Record<ScaleBand, readonly [number, number]> = {
  micro: [0.035, 0.07],
  small: [0.1, 0.2],
  normal: [0.22, 0.36],
  large: [0.4, 0.6],
  macro: [0.7, 1.3],
}

const ORDER: ScaleBand[] = ['micro', 'small', 'normal', 'large', 'macro']

/**
 * How far past the page a figure may run when the composition allows it:
 * at most half a mark over each edge, so that what leaves the page is a
 * cropped character and never a missing one. Never more than a third.
 */
export const BLEED_CEILING = 1.35
const bleedLimit = (band: ScaleBand) => Math.min(BLEED_CEILING, 1 + BANDS[band][0] / 2)

export function bandOf(size: number, page: number): ScaleBand {
  const s = size / page
  for (const b of ORDER) if (s <= BANDS[b][1]) return b
  return 'macro'
}

export function midOf(band: ScaleBand, page: number): number {
  const [lo, hi] = BANDS[band]
  return ((lo + hi) / 2) * page
}

/** 造形: the only thing the seed is allowed to do to a size */
export function jitter(rng: Rng, size: number): number {
  return size * rng.range(0.94, 1.06)
}

export interface OccupancyRequest {
  /**
   * 0–1: how far apart the two things are in the language. The same measure
   * the axis already uses: a joint inside a word is near, a coordination far.
   */
  distance: number
  distanceNote: string
  spread: Spread
  bleed: boolean
}

/**
 * Distance decides both measures, in opposite directions: a remote relation
 * stretches the figure across the page and leaves the white inside it, a close
 * one draws the figure in and packs it. Even the closest relation keeps more
 * than half the page, because the page is the vessel of the relation, not a
 * margin around it.
 */
export function occupancyOf(r: OccupancyRequest): Occupancy {
  const reach = clamp(0.55 + 0.45 * r.distance, 0.55, 0.95)
  const fill = clamp(1 - r.distance, 0.15, 0.85)
  const decisions: Decision[] = [
    {
      name: 'reach',
      ground: 'linguistic',
      value: reach.toFixed(2),
      note: `${r.distanceNote} → 遠い関係ほど図形は紙面を張る`,
    },
    {
      name: 'fill',
      ground: 'linguistic',
      value: fill.toFixed(2),
      note: '言語上の隔たりは、紙面の広さではなく図形の内側の白になる',
    },
    { name: 'spread', ground: 'plastic', value: r.spread, note: '図形の満たし方' },
  ]
  return { reach, fill, spread: r.spread, bleed: r.bleed, decisions }
}

/**
 * Sizes for groups of marks that share one reach.
 *
 * The ratios between the groups come from the language (how much sound each
 * side carries) and are kept: this pass never reverses them. What it does is
 * find the largest common size at which the groups, laid along the reach with
 * the white between them, still fit what the page can hold. So a desired band
 * is a request, and what comes back may be a smaller band — a long ending
 * simply cannot be written as large as a short stem, whatever the sound says.
 */
export function fitSizes(req: FitRequest, occ: Occupancy, page: number): Fitted {
  const weight = req.extents.reduce((s, e, i) => s + e * req.ratios[i], 0) || 1
  const gap = (1 - occ.fill) * occ.reach * page
  const [lo, hi] = BANDS[req.band]
  const largest = (unit: number) => Math.max(...req.ratios.map((r) => r * unit))

  let unit = (occ.fill * occ.reach * page) / weight
  const decisions: Decision[] = [
    { name: 'band', ground: 'linguistic', value: req.band, note: req.note },
  ]
  let bled = false

  if (largest(unit) < lo * page) {
    // the grounds ask for more than the reach would give: take it from the
    // white, and past the page itself where the composition allows it
    const want = (unit * lo * page) / largest(unit)
    const room = Math.max(0, (occ.bleed ? bleedLimit(req.band) : 1) * page - gap) / weight
    unit = Math.min(want, room)
    bled = weight * unit + gap > page + 1e-6
    decisions.push({
      name: 'fit',
      ground: 'plastic',
      value: want > room ? (occ.bleed ? '断ち落とし' : '紙面に収める') : '白より字を優先',
      note:
        want > room
          ? occ.bleed
            ? '紙面が関係を収めきれない：縮めず、字を紙面の外へ出す'
            : '紙面が関係を収めきれないが、この構成では外へ出せない：望む帯に届かない'
          : '望む帯まで拡大する：図形の内側の白は言語が決めた幅のまま、字がその周りを広げる',
    })
  } else if (largest(unit) > hi * page) {
    unit = (unit * hi * page) / largest(unit)
    decisions.push({ name: 'fit', ground: 'plastic', value: '帯の上限', note: '帯の上限で止める' })
  }

  const sizes = req.ratios.map((r) => r * unit)
  const achieved = bandOf(Math.max(...sizes), page)
  if (achieved !== req.band)
    decisions.push({
      name: 'achieved',
      ground: 'plastic',
      value: achieved,
      note: `望んだ帯は ${req.band}、紙面と字数が許したのは ${achieved}`,
    })
  return { sizes, desired: req.band, achieved, bled, decisions }
}
