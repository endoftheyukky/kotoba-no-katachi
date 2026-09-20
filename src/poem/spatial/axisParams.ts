/**
 * The two poles of an axis, and the parameters that shape the page they make.
 *
 * One composition, deformed continuously by what the title gives: nothing here
 * is chosen by the seed. Each parameter has a neutral value and is pushed away
 * from it by one feature. Only the strongest few pushes are kept (see
 * `decide`), so a page shows one or two differences rather than all of them.
 *
 * Each parameter records whether its ground is linguistic (a relation in the
 * title) or plastic (a decision of form, measured but not linguistic).
 */
import { clamp } from '../../core/math'
import { EM } from '../../glyph/font'
import type { GlyphMetrics } from '../../glyph/metrics'
import { occupancyOf } from '../contract'
import type { Analysis, Material, Occupancy, Parameter, ScaleBand, Unit } from '../types'
import { allUnits, isWritten } from './common'
import { coordinated, dependencyBy, relationsOf } from './relations'

/** particles that point from one term to another: object, subject, direction */
const POINTING = ['を', 'が', 'に', 'へ']

export interface Poles {
  a: Unit[]
  b: Unit[]
  middle: Unit[]
  kind: 'containment' | 'similarity' | 'coordination' | 'mirror' | 'dependency' | 'imperative' | 'inflection'
  ground: string
}

export const POLE_SCORE: Record<Poles['kind'], number> = {
  inflection: 0.7,
  containment: 0.9,
  similarity: 0.85,
  coordination: 0.85,
  mirror: 0.8,
  dependency: 0.7,
  imperative: 0.6,
}

export function poles(an: Analysis, m: Material): Poles | null {
  const units = allUnits(m)
  const tokenUnits = (t: number) => m.tokens[t] ?? []
  const rest = (...used: Unit[][]) => units.filter((u) => !used.some((g) => g.includes(u)))
  const f = m.primary.focus

  if (f.kind === 'pair') {
    const r = f.relation
    // the inner glyph may be one the title never writes (read inside another)
    const inner = units.find((u) => u.char === r.inner) ?? { grapheme: -1, token: -1, char: r.inner }
    const outer = units.find((u) => u.char === r.outer)
    if (outer) {
      const minus = { char: r.inner, dx: r.dx, dy: r.dy, scale: r.scale, keep: r.residue.pieces }
      const b = r.kind === 'containment' ? [{ ...outer, minus }] : [outer]
      const hasCoordination = coordinated(an).length === 2
      // found against a component the title never writes: the character itself
      // stands at one pole, what is left of it at the other, the component between
      if (m.primary.origin === 'exogenous')
        return {
          a: [outer],
          b,
          middle: [{ grapheme: -1, token: -1, char: r.inner }],
          kind: 'containment',
          ground: `「${r.outer}」の中に「${r.inner}」を読んだ（題の外の部品）→ 元の字と、引いた残りを二極に`,
        }
      // for a similarity, the small difference stands between the two
      const difference = r.kind === 'similarity' ? [{ ...outer, minus, grapheme: -1 }] : []
      if (r.kind === 'similarity' || hasCoordination)
        return {
          a: [inner],
          b,
          middle: [...difference, ...rest([inner], [outer])],
          kind: r.kind,
          ground:
            r.kind === 'similarity'
              ? `「${r.inner}」≈「${r.outer}」 → 二つの同じような形を離す`
              : `「${r.inner}」と「${r.outer}」が接続語で結ばれ、字形も包含する → 二極`,
        }
    }
    return null
  }

  if (f.kind === 'joint') {
    const t = an.tokens[f.token]
    const stem = units.filter((u) => u.grapheme >= t.start && u.grapheme < f.at)
    const ending = units.filter((u) => u.grapheme >= f.at && u.grapheme < t.end)
    if (stem.length && ending.length)
      return {
        a: stem,
        b: ending,
        middle: rest(stem, ending),
        kind: 'inflection',
        ground: `「${t.surface}」は語幹と活用語尾でできている → 語の継ぎ目を二極に`,
      }
  }

  const members = coordinated(an)
  if (members.length === 2) {
    const [l, r] = members
    const a = tokenUnits(l)
    const b = tokenUnits(r)
    return { a, b, middle: rest(a, b), kind: 'coordination', ground: `「${an.tokens[l].surface}」と「${an.tokens[r].surface}」の並列 → 二極` }
  }

  const mirror = relationsOf(an, 'mirror')[0]
  if (mirror) {
    const written = units.filter((u) => an.graphemes[u.grapheme]?.script !== 'symbol')
    const half = Math.floor(written.length / 2)
    const a = written.slice(0, half)
    const b = written.slice(written.length - half)
    return { a, b, middle: rest(a, b), kind: 'mirror', ground: '題は前から読んでも後ろから読んでも同じ → 対称の軸' }
  }

  const dep = dependencyBy(an, POINTING)
  if (dep) {
    const a = units.filter((u) => u.token <= dep.dependent)
    const b = units.filter((u) => u.token >= dep.head)
    return { a, b, middle: rest(a, b), kind: 'dependency', ground: `「${an.tokens[dep.marker].surface}」は一方から他方へ向かう → 二極` }
  }

  const imp = relationsOf(an, 'imperative')[0]
  if (imp && an.tokens.length > 1) {
    const b = tokenUnits(imp.token)
    const a = units.filter((u) => u.token < imp.token)
    if (a.length) return { a, b, middle: rest(a, b), kind: 'imperative', ground: '命令は向かう先を持つ → 二極' }
  }
  return null
}

// ---------------------------------------------------------------------------
// measurements

const metricsOf = (a: Analysis, u: Unit): GlyphMetrics | null => {
  try {
    return a.glyphs.get(u.char).metrics
  } catch {
    return null
  }
}

/** the beats a pole carries (an unread kanji counts as two); its length in characters if unread */
function beats(a: Analysis, units: Unit[]): number {
  const set = new Set(units.map((u) => u.grapheme))
  let w = 0
  for (const mo of a.morae) {
    const hit = mo.graphemes.filter((g) => set.has(g)).length
    if (hit) w += (mo.weight * hit) / mo.graphemes.length
  }
  return w || units.filter(isWritten).length || 1
}

/** mean ink per em of a pole's glyphs */
function ink(a: Analysis, units: Unit[]): number {
  const ms = units.map((u) => metricsOf(a, u)).filter((m): m is GlyphMetrics => !!m)
  return ms.length ? ms.reduce((s, m) => s + m.density, 0) / ms.length : 0.25
}

/** where the ink sits inside its em square (em units; positive = right / below) */
function emOffset(m: GlyphMetrics): { x: number; y: number } {
  return { x: -(m.pen.x + EM / 2), y: -(m.pen.y - 0.38 * EM) }
}

/** bands of ink across a profile: 言 shows five horizontal bands, 川 three vertical ones */
function bandCount(profile: readonly number[]): number {
  let n = 0
  let on = false
  for (const v of profile) {
    const hot = v >= 0.3
    if (hot && !on) n++
    on = hot
  }
  return n
}

/** 1 = the glyphs are made of stacked horizontal strokes, 0 = of strokes side by side */
function grain(a: Analysis, units: Unit[]): number {
  const ms = units.map((u) => metricsOf(a, u)).filter((m): m is GlyphMetrics => !!m)
  if (!ms.length) return 0.5
  const rows = ms.reduce((s, m) => s + bandCount(m.rows), 0)
  const cols = ms.reduce((s, m) => s + bandCount(m.cols), 0)
  return rows + cols ? rows / (rows + cols) : 0.5
}

// ---------------------------------------------------------------------------
// the parameters

/** how far apart two things are in the language, as a share of the page */
const DISTANCE: Record<Poles['kind'], number> = {
  inflection: 0.3, // inside one word
  containment: 0.45, // inside one character
  similarity: 0.45,
  mirror: 0.5,
  dependency: 0.6, // two words joined by a particle
  imperative: 0.6,
  coordination: 0.72, // two words merely set beside each other
}
const NEUTRAL_DISTANCE = 0.55
/** a space written in the title puts the two furthest apart */
const SEPARATED = 0.85

/** how asymmetric a relation is: how far one side governs the other */
const KIND_ASYM: Record<Poles['kind'], number> = {
  dependency: 1, // one word governs the other
  imperative: 0.8,
  containment: 0.85, // one form was taken out of the other
  inflection: 0.7, // the ending hangs off the stem
  similarity: 0,
  coordination: 0,
  mirror: 0,
}

/** how much each parameter may weigh in the choice of what varies */
const WEIGHT: Record<string, number> = {
  distance: 1,
  scaleRatio: 1,
  alignment: 1,
  // a weaker poetic mapping: it should not push the direct ones aside
  whitePull: 0.4,
  orientation: 0.7,
  offset: 0.5,
}
/** at most this many parameters leave their neutral value in one poem */
const VARY = 2

/**
 * Whether the poem asks the reader to read the marks themselves — the form of
 * a character, the small difference between two forms, the seam inside a word.
 * Where it does, the letterform is the subject and is written large. Where the
 * poem is about two words standing apart, the marks are ordinary and the
 * distance does the work: those pages may stay small in a great emptiness.
 *
 * Being few is never itself a reason to be large.
 */
export function closeness(p: Poles): { close: boolean; band: ScaleBand; note: string } {
  switch (p.kind) {
    case 'similarity':
      return { close: true, band: 'large', note: '二つの形の差そのものを読ませる → 元の形を大きく' }
    case 'inflection':
      return { close: true, band: 'large', note: '語の継ぎ目を読ませる → 継ぎ目が見える大きさに' }
    case 'containment':
      return { close: true, band: 'macro', note: '引き算の残りは操作が生んだもの → macro を許す' }
    default:
      return { close: false, band: 'normal', note: '語と語の関係は、字の大きさではなく隔たりで見せる' }
  }
}

export interface AxisShape {
  /** the axis runs along the writing direction, or across it */
  vertical: boolean
  /** distance between the poles, as a share of the page */
  distance: number
  /** size of pole A relative to pole B */
  scaleRatio: number
  /** where the pair sits along the axis (0.5 = centred) */
  whitePull: number
  /** each pole's shift across the axis, in page units */
  offsetA: number
  offsetB: number
  /** extra shift of the subordinate pole, in page units */
  alignment: number
  /** how much of the page the figure claims, and how much of that is ink */
  occupancy: Occupancy
  parameters: Parameter[]
}

export function axisShape(a: Analysis, m: Material, p: Poles, page: number, bleed: boolean): AxisShape {
  const salience = m.primary.linguisticSalience.value
  // a written space only pushes the poles apart when the poles are the two
  // sides of it: a joint inside one word is not separated by it
  const tokensOf = (u: Unit[]) => u.map((x) => x.token)
  const acrossTokens = Math.max(...tokensOf(p.a)) < Math.min(...tokensOf(p.b))
  const separated = relationsOf(a, 'separation').length > 0 && acrossTokens

  // distance — from how far apart the two are in the language
  const distance = separated ? SEPARATED : DISTANCE[p.kind]
  const distanceNote = separated
    ? '空白で隔てられた二語 → 最も遠い'
    : { inflection: '一語の中の継ぎ目 → 近い', containment: '一字の中にあったもの → やや近い', similarity: '一字の中にあったもの → やや近い', mirror: '題の折り返し', dependency: '助詞で結ばれた二語', imperative: '命令の向かう先', coordination: '並列された二語 → 遠い' }[p.kind]

  // scale ratio — the side that carries more sound is written larger
  const beatsA = beats(a, p.a)
  const beatsB = beats(a, p.b)
  const raw = clamp(beatsA / beatsB, 1 / 3, 3)
  const scaleRatio = Math.abs(Math.log(raw)) > Math.log(1.4) ? raw : 1

  // the pair sits where the relation looks: forward for a command or an
  // inflection, back for what has been taken away or left over
  const commanding = p.kind === 'imperative' || relationsOf(a, 'imperative').length > 0
  const forward = commanding || p.kind === 'inflection' || p.kind === 'dependency'
  const backward = p.kind === 'containment' || m.modifiers.some((x) => x.op === 'absence')
  // a command looks further ahead than an ordinary forward relation
  const whitePull = forward ? (commanding ? 0.3 : 0.38) : backward ? 0.62 : 0.5

  // each pole leans the way its own ink leans inside its em square (plastic)
  const leanOf = (units: Unit[], vertical: boolean) => {
    const ms = units.map((u) => metricsOf(a, u)).filter((x): x is GlyphMetrics => !!x)
    if (!ms.length) return 0
    const lean = ms.reduce((s, x) => s + (vertical ? emOffset(x).x : emOffset(x).y), 0) / ms.length / EM
    const light = 1 - ink(a, units)
    return clamp(lean * light * 0.5, -0.06, 0.06) * page
  }

  // the subordinate side steps off the line, the further the less of the
  // writing it carries; equals, and sides of equal extent, stay on it
  const extentA = p.a.filter(isWritten).length
  const extentB = p.b.filter(isWritten).length
  const extentAsym = Math.abs(extentA - extentB) / Math.max(1, extentA + extentB)
  const offLine = KIND_ASYM[p.kind] * clamp(extentAsym * 2)
  const alignment = (0.05 + 0.09 * offLine) * offLine * page

  // plastic: the axis runs across the grain of the letterforms
  const g = grain(a, [...p.a, ...p.b])
  const wantsVertical = g >= 0.55 ? true : g <= 0.45 ? false : a.direction === 'vertical'
  const neutralVertical = a.direction === 'vertical'

  const entries: (Parameter & { key: string; apply: () => void })[] = []
  const shape: AxisShape = {
    vertical: neutralVertical,
    distance: NEUTRAL_DISTANCE,
    scaleRatio: 1,
    whitePull: 0.5,
    offsetA: 0,
    offsetB: 0,
    alignment: 0,
    occupancy: occupancyOf({ distance: NEUTRAL_DISTANCE, distanceNote: '中立の隔たり', spread: 'pair', bleed }),
    parameters: [],
  }

  const add = (
    key: string,
    ground: Parameter['ground'],
    value: string,
    neutral: string,
    deviation: number,
    note: string,
    apply: () => void,
  ) => entries.push({ key, name: key, ground, value, neutral, deviation, note, applied: false, apply })

  add(
    'distance',
    'linguistic',
    distance.toFixed(2),
    NEUTRAL_DISTANCE.toFixed(2),
    Math.abs(distance - NEUTRAL_DISTANCE) / 0.3,
    `${distanceNote}：言語上の隔たりが紙面の隔たりになる`,
    () => (shape.distance = distance),
  )
  add(
    'scaleRatio',
    'linguistic',
    scaleRatio.toFixed(2),
    '1.00',
    clamp(Math.abs(Math.log(scaleRatio)) / Math.log(3)),
    `拍の重さ ${beatsA.toFixed(1)} : ${beatsB.toFixed(1)} → 音を多く担う側が大きい`,
    () => (shape.scaleRatio = scaleRatio),
  )
  add(
    'alignment',
    'linguistic',
    (alignment / page).toFixed(3),
    '0',
    offLine,
    offLine > 0
      ? `従属する側（字数 ${extentA} : ${extentB}）が軸の線から外れる`
      : '担う字数が等しい二項は同じ線の上に',
    () => (shape.alignment = alignment),
  )
  add(
    'whitePull',
    'linguistic',
    whitePull.toFixed(2),
    '0.50',
    Math.abs(whitePull - 0.5) / 0.12,
    commanding ? '命令は遠くを指す：白は行く先に大きく' : forward ? '向かう関係：白は行く先に' : backward ? '失われた関係：白は来た方に' : '向きのない関係',
    () => (shape.whitePull = whitePull),
  )
  add(
    'orientation',
    'plastic',
    wantsVertical ? '縦' : '横',
    neutralVertical ? '縦' : '横',
    wantsVertical === neutralVertical ? 0 : 1,
    `字の画は${g >= 0.5 ? '横に積まれる' : '縦に並ぶ'}（${g.toFixed(2)}）→ 軸はその流れを横切る`,
    () => (shape.vertical = wantsVertical),
  )
  const offA = leanOf(p.a, neutralVertical)
  const offB = leanOf(p.b, neutralVertical)
  add(
    'offset',
    'plastic',
    `${(offA / page).toFixed(3)} / ${(offB / page).toFixed(3)}`,
    '0 / 0',
    clamp((Math.abs(offA) + Math.abs(offB)) / page / 0.08),
    '字が自分の枠の中で偏っている方向へ、極もわずかに寄る',
    () => {
      shape.offsetA = offA
      shape.offsetB = offB
    },
  )

  // keep only the strongest pushes; a linguistic ground counts for as much as
  // the relation it rests on, a plastic one a little less
  const ranked = [...entries].sort(
    (x, y) =>
      y.deviation * WEIGHT[y.key] * (y.ground === 'linguistic' ? salience : 0.8) -
      x.deviation * WEIGHT[x.key] * (x.ground === 'linguistic' ? salience : 0.8),
  )
  for (const e of ranked.slice(0, VARY)) {
    if (e.deviation <= 0.01) continue
    e.apply()
    e.applied = true
  }
  // occupancy follows the distance the poem actually adopted, not the one it
  // was offered: a parameter returned to neutral must not stretch the page
  shape.occupancy = occupancyOf({
    distance: shape.distance,
    distanceNote: entries.find((e) => e.key === 'distance')!.applied ? distanceNote : '中立の隔たり',
    spread: 'pair',
    bleed,
  })
  shape.parameters = entries.map(({ name, ground, value, neutral, applied, deviation, note }) => ({
    name,
    ground,
    value: applied ? value : neutral,
    neutral,
    applied,
    deviation,
    note,
  }))
  return shape
}
