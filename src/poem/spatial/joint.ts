/**
 * 継ぎ目 — the joint of one word, shown as a cut in the line the title makes.
 *
 * A stem and its ending are not two things standing apart; they are one word
 * with a seam in it. The two-pole layout can only say "far", and says it with
 * a table: every inflection gets the same distance and the same large band, so
 * 触｜る and 見｜えない come out as the same page. What differs between them is
 * not how far apart anything is but how much stands on either side of the
 * seam, and that is a count of seats.
 *
 *   linguistic  the joint inside one token; the seats of the whole title in
 *               reading order; which seats the poem writes as space; the seats
 *               the title writes as a space of its own; which seats belong to
 *               the word that is cut and which are the rest of the title.
 *   transform   the title is written once, in seat order, one seat one glyph,
 *               every glyph the same size. Only the intervals vary: a joint
 *               opens half a seat, a written space a whole one, an erased seat
 *               keeps its seat and stays empty. The size is what the seats
 *               leave once the line has the page's length.
 *   visual      one line, cut once.
 *
 * Nothing here reads sound. A mora count would have to guess at an unread
 * kanji, and a guess must not become the size of a character. Beats may come
 * back as interval later; they are not wanted for the seam itself.
 */
import { clamp } from '../../core/math'
import type { Rng } from '../../core/random'
import { MIN_READABLE } from '../context'
import { bandOf, BANDS } from '../contract'
import { seatsOf } from '../scope'
import type { Analysis, Contract, Decision, Fitted, Mark, Material, Occupancy, Unit, Vec } from '../types'
import { directions, isWritten, offCentre, unitMarks } from './common'

/** the line takes this much of the page along the reading */
const EXTENT = 0.86
/** a glyph very nearly fills its seat: the only white in the line is the cut */
const SOLID = 0.96
/** the cut at the joint, in seats — a boundary inside one word is not a beat */
const CUT = 0.5
/** a space the title writes is a larger boundary than a seam: a whole seat */
const SPACE = 1
/** the rest of the title, beside the word that is cut */
const SUBORDINATE = 0.5

interface Seat {
  unit: Unit | null
  grapheme: number
  /** where the seat begins, counted in seats from the head of the line */
  at: number
  /** part of the word that carries the joint */
  target: boolean
  /** an extra interval opened before this seat, in seats */
  opened: number
  why?: string
}

export interface JointLine {
  seats: Seat[]
  /** the line's length, in seats */
  total: number
  /** seats that carry a glyph */
  visible: number
  /** where the cut falls, counted in seats */
  cut: number | null
}

/**
 * The line of seats, with the intervals the language opens in it. A seat is
 * kept for every character the title writes, including the ones the poem
 * writes as space: an erased seat is still a seat, and the line runs its full
 * length whatever is drawn in it.
 */
export function jointLine(a: Analysis, m: Material): JointLine | null {
  const f = m.primary.focus
  if (f.kind !== 'joint') return null
  const token = a.tokens[f.token]
  if (!token) return null
  const seats = seatsOf(a)
  if (seats.length < 2) return null
  const units = m.tokens.flat()

  // characters the title writes between two seats but that hold no seat of
  // their own: a written space is a boundary larger than a seam
  const blanksBetween = (from: number, to: number) =>
    a.graphemes.filter((g) => g.index > from && g.index < to && !g.char.trim()).length

  let at = 0
  const out: Seat[] = []
  seats.forEach((g, i) => {
    let opened = 0
    let why: string | undefined
    if (i > 0) {
      at += 1
      const blanks = blanksBetween(seats[i - 1], g)
      if (blanks) {
        opened += blanks * SPACE
        why = '書かれた空白'
      }
      // the seam of the word: the ending begins here
      if (g === f.at && g >= token.start && g < token.end) {
        opened += CUT
        why = why ? `${why}・語幹と活用語尾の継ぎ目` : '語幹と活用語尾の継ぎ目'
      }
      at += opened
    }
    out.push({
      unit: units.find((u) => u.grapheme === g) ?? null,
      grapheme: g,
      at,
      target: g >= token.start && g < token.end,
      opened,
      why,
    })
  })
  const cut = out.find((s) => s.why?.includes('継ぎ目'))
  if (!cut) return null
  return {
    seats: out,
    total: at + 1,
    visible: out.filter((s) => s.unit && isWritten(s.unit)).length,
    cut: cut.at - CUT / 2,
  }
}

/**
 * When a seam is worth a line, and when two poles already hold it.
 *
 * A line is worth drawing when it has something in it besides the seam: more
 * than one seat on one side of the cut, a seat the poem writes as space, a
 * space the title writes itself, or the rest of the title sitting in the same
 * reading. Each of those is a measured structure the two poles cannot keep —
 * the poles hold a stem and an ending and nothing else, and they hold them
 * larger. Where a word is one character and one ending and nothing more, the
 * line would say no more and say it smaller, so the poles keep it.
 *
 * This is not a contest between compositions and has no fitness of its own:
 * it is one relation, held two ways, and the way that keeps more is taken.
 */
export function jointHolds(a: Analysis, m: Material): { line: JointLine; why: string } | null {
  const line = jointLine(a, m)
  if (!line || line.cut === null) return null
  const stem = line.seats.filter((s) => s.target && s.at < line.cut!)
  const ending = line.seats.filter((s) => s.target && s.at > line.cut!)
  const erased = line.seats.filter((s) => s.unit && !isWritten(s.unit))
  const spaced = line.seats.some((s) => s.why?.includes('書かれた空白'))
  const context = line.seats.filter((s) => !s.target)
  const why: string[] = []
  if (stem.length >= 2 || ending.length >= 2)
    why.push(`継ぎ目の片側が${Math.max(stem.length, ending.length)}席ある（${stem.length}:${ending.length}）`)
  if (erased.length) why.push(`消された席が${erased.length}`)
  if (spaced) why.push('題が空白を書いている')
  if (context.length) why.push(`同じ読みの列に題の残りが${context.length}席ある`)
  return why.length ? { line, why: why.join('・') } : null
}

/**
 * Draw that line. Every glyph of the word is the same size; the rest of the
 * title keeps its seat and is written smaller. The size is solved from the
 * number of seats, not taken from a band.
 */
export function layJoint(
  a: Analysis,
  line: JointLine,
  rng: Rng,
  whitePull: number,
  page: number,
): { marks: Mark[]; contract: Contract } | null {
  const pitch = Math.min((EXTENT * page) / line.total, (BANDS.normal[1] * page) / SOLID)
  const size = pitch * SOLID
  if (size < MIN_READABLE * page) return null
  const context = clamp(size * SUBORDINATE, MIN_READABLE * page, BANDS.small[1] * page)

  const { vertical } = directions(a)
  const length = line.total * pitch
  const centre = clamp(whitePull * page, length / 2, page - length / 2)
  const head = centre - length / 2
  const cross = offCentre(rng)
  const place = (t: number): Vec => (vertical ? { x: cross, y: t } : { x: t, y: cross })

  const marks: Mark[] = []
  for (const s of line.seats) {
    if (!s.unit || !isWritten(s.unit)) continue
    const where = place(head + (s.at + 0.5) * pitch)
    marks.push(
      ...unitMarks(a, s.unit, where, s.target ? size : context).map((k) =>
        s.target ? k : { ...k, context: true },
      ),
    )
  }
  if (!marks.length) return null

  const empty = line.seats.length - line.visible
  const occupancy: Occupancy = {
    reach: length / page,
    fill: line.visible / line.total,
    spread: 'line',
    // the line is measured: it does not need to leave the page
    bleed: false,
    decisions: [
      {
        name: 'reach',
        ground: 'linguistic',
        value: (length / page).toFixed(2),
        note: `${line.total.toFixed(1)}席分の行：長さは席の数が決める`,
      },
      {
        name: 'fill',
        ground: 'linguistic',
        value: (line.visible / line.total).toFixed(2),
        note: `${line.visible}席に字があり、${empty}席は空のまま：行の中の白は、開いた境と消された席そのもの`,
      },
      { name: 'spread', ground: 'plastic', value: 'line', note: '一本の行' },
    ],
  }
  const fitted: Fitted = {
    sizes: [size, context],
    desired: bandOf(size, page),
    achieved: bandOf(size, page),
    bled: false,
    decisions: [
      {
        name: 'glyph',
        ground: 'linguistic',
        value: (size / page).toFixed(3),
        note: `一席一字、どの字も同じ大きさ：${line.total.toFixed(1)}席を紙面に収めた結果であって、帯から選んだ値ではない`,
      },
      {
        name: 'pitch',
        ground: 'linguistic',
        value: (pitch / page).toFixed(3),
        note: '席の幅は行全体で一定：変わるのは境で開く間隔だけ',
      },
      ...cuts(line),
    ],
  }
  const seats: Decision[] = [
    {
      name: 'context',
      ground: 'linguistic',
      value: (context / page).toFixed(3),
      note: '題の残りは行の外へ出さない：自分の席に留まり、対象より小さく書かれる',
    },
    {
      name: 'reading direction',
      ground: 'linguistic',
      value: vertical ? '縦' : '横',
      note: '行は題の書字方向に、書かれた順のまま（軸の向きは使わない）',
    },
    {
      name: 'line',
      ground: 'plastic',
      value: (cross / page).toFixed(2),
      note: '行が紙面のどこを走るかは造形であり、題の種から決まる',
    },
  ]
  return { marks, contract: { occupancy, fitted, context: seats } }
}

/** every interval the language opened in the line, in the order they fall */
function cuts(line: JointLine): Decision[] {
  return line.seats
    .filter((s) => s.opened > 0)
    .map((s) => ({
      name: 'opening',
      ground: 'linguistic' as const,
      value: `${s.opened.toFixed(1)}席`,
      note: `${s.why}：${s.at.toFixed(1)}席目の手前が開く`,
    }))
}
