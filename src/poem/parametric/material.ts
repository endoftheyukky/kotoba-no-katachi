/**
 * The material: what a page is made of, in the figure's own geometry.
 *
 * A form sampled in small marks, satellites on a ring, dust over the page, a
 * trail, the residue a subtraction left: these are not separate kinds of page
 * but places in one generator, and a title takes a place in it.
 *
 * Small marks stand where a density field says they may, and that field is
 * written in the figure's own coordinates (parametric/frame.ts): s along the
 * reading, d away from it.
 *
 *   onForm   the ink of the page's own nucleus, sampled on a lattice turned
 *            with the character itself — the form drawn in small marks
 *   onRing   the loop at a fixed distance from the reading: a circle where the
 *            page is one character, the shape of the trace where
 *            it is a curve, a row alongside each row of a lattice
 *   onPage   dust in the frame's own lattice: rows parallel to the reading,
 *            thinning along it and fading away from it, so a curve's dust curves
 *            and a lattice's grain runs with its rows however they are sheared
 *
 * The three are weights that sum to one: a page can be nine parts form and one
 * part dust, or half a ring and half a field. `density` says how much material
 * there is at all — at 0 the page is the figure alone. `fineness` runs from a few satellites to many grains of
 * dust; `spread` how far the dust strays from the reading; `cut` takes the
 * inner glyph out of the form before it is sampled (the residue); `sources`
 * mixes what the small marks are written with.
 *
 * Nothing is random: the lattices are fixed, the order in which points are
 * dropped is a fixed dither, and which character a grain
 * carries follows the shares in order.
 */
import { EM } from '../../glyph/font'
import { PAGE } from '../../render/stage'
import type { Analysis, Mark, Vec } from '../types'
import { around, frameOf, offsetLoop, project, walk, type Frame } from './frame'

export interface MaterialSources {
  /** a unit the title repeats */
  repeat: number
  /** a form read inside the nucleus */
  inner: number
  /** the rest of the title */
  rest: number
  /** the nucleus's own character */
  self: number
}

export interface MaterialParams {
  /** 0: the figure alone; 1: the page is mostly small marks */
  density: number
  /** 0: a few satellites; 1: many grains of dust */
  fineness: number
  /** where the material stands: the three weights are normalised */
  onForm: number
  onRing: number
  onPage: number
  /** the ring's distance from the reading, as a share of the page */
  radius: number
  /** how far the dust strays from the reading: 0 a narrow wake, 1 the whole page */
  spread: number
  /** how much of the form's ink the inner glyph takes out before it is sampled */
  cut: number
  /** how far the sampling lattice keeps its interval (1) or wanders (0) */
  regularity: number
  sources: MaterialSources
}

/** an ordered dither: the same points always go first */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]
const dither = (i: number, j: number) => (BAYER[((i % 4) + 4) % 4][((j % 4) + 4) % 4] + 0.5) / 16

/** a deterministic value in [0,1) from two integers (for the lattice's unevenness) */
function hash2(i: number, j: number): number {
  let h = Math.imul(i * 374761393 + j * 668265263, 1274126177)
  h = (h ^ (h >>> 13)) >>> 0
  return h / 4294967296
}

interface Figure {
  marks: Mark[]
  /** the mark the material gathers on: the largest of the figure's own */
  nucleus: Mark | null
}

export function figureOf(marks: Mark[]): Figure {
  const own = marks.filter((k) => !k.derived)
  const nucleus = own.length ? own.reduce((b, k) => (k.size > b.size ? k : b)) : null
  return { marks, nucleus }
}

/** is there ink of `k` at this page point? */
function inkAt(a: Analysis, k: Mark, x: number, y: number): boolean {
  const s = k.size / EM
  const t = (-(k.rotate ?? 0) * Math.PI) / 180
  const dx = x - k.x
  const dy = y - k.y
  let u = (dx * Math.cos(t) - dy * Math.sin(t)) / s
  let v = (dx * Math.sin(t) + dy * Math.cos(t)) / s
  if (k.shift) {
    u -= k.shift.x
    v -= k.shift.y
  }
  if (k.keep?.length && !k.keep.some((r) => u >= r.x && v >= r.y && u <= r.x + r.w && v <= r.y + r.h)) return false
  let ink
  try {
    ink = a.glyphs.get(k.char, k.face ?? 'sans').metrics.ink
  } catch {
    return false
  }
  const i = Math.floor((u - ink.left) / ink.px)
  const j = Math.floor((v - ink.top) / ink.px)
  return i >= 0 && j >= 0 && i < ink.w && j < ink.h && ink.data[j * ink.w + i] > 96
}

/** the ink of a character, in the em space of a mark that is not drawn */
function formDensity(a: Analysis, k: Mark, cut: { char: string; scale: number } | null, x: number, y: number): number {
  if (!inkAt(a, k, x, y)) return 0
  if (!cut) return 1
  // the residue: where the inner glyph's own ink falls, the form is not material
  const inner: Mark = { char: cut.char, x: k.x, y: k.y, size: k.size * cut.scale, face: k.face }
  return inkAt(a, inner, x, y) ? 0 : 1
}

export interface Material {
  marks: Mark[]
  /** the figure's marks, with the nucleus cropped where the material took it over */
  figure: Mark[]
  grains: number
  /** how many marks each placement asked for, before they were sifted */
  placed: { form: number; ring: number; dust: number }
}

type Chars = MaterialSources & { chars: Record<keyof MaterialSources, string | null> }

const inside = (p: Vec) => p.x >= 0.02 * PAGE && p.y >= 0.02 * PAGE && p.x <= 0.98 * PAGE && p.y <= 0.98 * PAGE

/**
 * The material of a page: small marks in the figure's own frame, and the figure
 * itself where the material has taken over its nucleus (the glyph is written
 * only as far as the form has not been sampled — at full density it is not
 * written at all, and the grains stand for it).
 *
 * `put` is where the figure's written units went, in the reading's order: the
 * frame the material is placed in.
 */
export function materialMarks(
  a: Analysis,
  figure: Figure,
  p: MaterialParams,
  chars: Chars,
  put: { x: number; y: number; size: number }[] = [],
): Material {
  const weights = [p.onForm, p.onRing, p.onPage]
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0) || 1
  const [wForm, wRing, wPage] = weights.map((w) => Math.max(0, w) / total)
  const n = figure.nucleus
  if (p.density <= 0.02 || !n) return { marks: [], figure: figure.marks, grains: 0, placed: { form: 0, ring: 0, dust: 0 } }

  const frame = frameOf(put.length ? put : [{ x: n.x, y: n.y, size: n.size }])
  const written = figure.marks.filter((k) => !k.derived)
  const order = sourceOrder(p, chars)
  // How much of the nucleus's ink the grains take. A character drawn in grains
  // must stand for the character: half its ink sampled, and enough grains to
  // read. Below that the form is not drawn at all — a glyph cut in half is not
  // a form in small marks, it is another character (月 cut is 日, 見 cut is
  // 目) — and what the form would have carried gathers around the character
  // instead, on the ring or in the dust.
  const takes = wForm * (0.4 + 0.9 * p.density)
  // A character drawn in small characters needs room: the grains have to stay
  // readable as the characters they are, so as the material takes the letterform
  // over, the letterform grows into the page. The written title stays where it
  // is; the form is no longer written, so nothing is covered.
  // The form takes as much of the page as the material has taken of it (up to
  // two thirds of the page, its grains small characters at 3–4% of it, not
  // dots). As it grows it also draws toward the middle, where there is room for it.
  // the form takes as much of the page as the material has taken of it, but
  // never less than the character it stands for asked for: a page written small
  // keeps its register, and its grains are small characters at that register too
  const span = Math.max(n.size * 1.12, PAGE * (0.32 + 0.38 * Math.min(1, Math.max(0, (takes - 0.45) / 0.55))))
  const grow = Math.min(4, Math.max(1, span / Math.max(1, n.size)))
  const toward = Math.min(1, (grow - 1) / 1.5)
  const swollen: Mark = {
    ...n,
    size: n.size * grow,
    x: n.x + (PAGE / 2 - n.x) * toward,
    y: n.y + (PAGE / 2 - n.y) * toward,
  }
  const sampled = wForm > 0.02 ? onForm(a, swollen, p, wForm, order) : { marks: [], cells: 0 }
  const form = sampled.marks
  // Read as the character it is: its ink found in enough places, half of them
  // kept, and enough grains standing that the letterform is there — a form in
  // twenty scattered marks is a smudge, not a character.
  const stands = sampled.cells >= 45 && form.length >= 32 && form.length >= 0.5 * sampled.cells
  // What a form that cannot be read would have carried goes where the title
  // already lets material stand — never to a place with no evidence, or every
  // page with a character too thin to sample would grow the same halo.
  const others = wRing + wPage
  const toOthers = stands || others < 0.02 ? 0 : wForm
  const ring = wRing + (others > 0.02 ? (toOthers * wRing) / others : 0)
  const dust = wPage + (others > 0.02 ? (toOthers * wPage) / others : 0)
  const onLoop = ring > 0.02 ? onRing(frame, n, p, ring, chars) : []
  const inAir = dust > 0.02 ? onPage(frame, written, p, dust, order, n.char, n.size) : []
  const marks = [...(stands ? form : []), ...onLoop, ...inAir]

  // where the grains stand for the character, the character is not written
  const own = stands && n.grapheme !== undefined ? figure.marks.filter((k) => k !== n) : figure.marks
  // Where the reading doubles back — two rows of a lattice, the two sides of a
  // turn — the three placements can reach the same spot. No grain stands on
  // another: the first one there keeps the place.
  const cell = 60
  const grid = new Map<string, Mark[]>()
  const clear = (g: Mark) => {
    const gx = Math.floor(g.x / cell)
    const gy = Math.floor(g.y / cell)
    const r = Math.ceil(g.size / cell) + 1
    for (let u = -r; u <= r; u++)
      for (let v = -r; v <= r; v++)
        for (const k of grid.get(`${gx + u},${gy + v}`) ?? [])
          if (Math.abs(k.x - g.x) < 0.8 * (k.size + g.size) * 0.5 && Math.abs(k.y - g.y) < 0.8 * (k.size + g.size) * 0.5) return false
    grid.set(`${gx},${gy}`, [...(grid.get(`${gx},${gy}`) ?? []), g])
    return true
  }
  const apart = marks.filter(clear)

  // A grain never stands on ink the page still writes — tested as the audits
  // test it, at the grain's centre and its four corners.
  const kept = apart.filter((g) => {
    const pts = [
      [0, 0],
      [0.3, 0.3],
      [-0.3, 0.3],
      [0.3, -0.3],
      [-0.3, -0.3],
    ].map(([u, v]) => [g.x + u * g.size, g.y + v * g.size] as const)
    return !own.some((k) => !k.derived && Math.abs(k.x - g.x) < k.size && Math.abs(k.y - g.y) < k.size && pts.some(([x, y]) => inkAt(a, k, x, y)))
  })
  return { marks: kept, figure: own, grains: kept.length, placed: { form: stands ? form.length : 0, ring: onLoop.length, dust: inAir.length } }
}

/** the sources, in the order their shares run out */
function sourceOrder(p: MaterialParams, chars: Chars): { char: string; share: number }[] {
  return (Object.keys(p.sources) as (keyof MaterialSources)[])
    .map((k) => ({ char: chars.chars[k] ?? '', share: p.sources[k] }))
    .filter((s) => s.char && s.share > 0)
}

/** which character a grain is written with: the shares, in order */
function charAt(order: { char: string; share: number }[], i: number, j: number, fallback: string): string {
  const totalShare = order.reduce((s, o) => s + o.share, 0) || 1
  const at = (((i * 7 + j * 13) % 100) / 100) * totalShare
  let acc = 0
  for (const o of order) {
    acc += o.share
    if (at <= acc) return o.char
  }
  return order[0]?.char ?? fallback
}

const grain = (char: string, x: number, y: number, size: number, note: string, role: 'grain' | 'satellite'): Mark => ({
  char,
  x,
  y,
  size,
  role,
  derived: { grammar: 'material', kind: 'form', note },
})

/**
 * The form: the nucleus's own ink, sampled on a lattice that is turned with the
 * character — so that on a trace whose marks follow its tangent the grains lie
 * with the letterform, not with the page. Eleven to twenty-four grains across
 * it.
 */
function onForm(a: Analysis, n: Mark, p: MaterialParams, w: number, order: { char: string; share: number }[]): { marks: Mark[]; cells: number } {
  // How fine: eleven to twenty-four grains across the character. The grains are
  // small characters, not dots, so the lattice does not close up to catch a thin
  // letterform: a character whose ink is met at too few places is simply not
  // drawn as a form (see `stands`).
  const step = n.size / (11 + 13 * p.fineness)
  // a grain is a small character, never a dot (3–4% of the page)
  const size = Math.max(step * (0.62 + 0.25 * (1 - p.fineness)), 0.014 * PAGE)
  // The residue takes the inner glyph out of the form. Where the form read
  // inside the character is as large as the character itself there is nothing
  // left to sample, and a page whose material is all residue is not a page with
  // material: the cut is taken only as far as a form survives it.
  const cut = p.cut > 0.25 ? innerOf(a, n.char) : null
  const th = ((n.rotate ?? 0) * Math.PI) / 180
  const cos = Math.cos(th)
  const sin = Math.sin(th)
  const half = Math.ceil(n.size / 2 / step) + 1
  const sample = (take: { char: string; scale: number } | null): Mark[] => {
    const out: Mark[] = []
    for (let j = -half; j <= half; j++)
      for (let i = -half; i <= half; i++) {
        const jitter = (1 - p.regularity) * step * 0.4
        const u = i * step + (hash2(i, j) - 0.5) * 2 * jitter
        const v = j * step + (hash2(j + 977, i) - 0.5) * 2 * jitter
        const x = n.x + u * cos - v * sin
        const y = n.y + u * sin + v * cos
        if (!inside({ x, y })) continue
        const d = formDensity(a, n, take, x, y)
        if (d * w * (0.4 + 0.9 * p.density) <= dither(i, j)) continue
        out.push({
          ...grain(charAt(order, i, j, n.char), x, y, size, 'v4 material form', p.fineness < 0.35 ? 'satellite' : 'grain'),
          ...(n.grapheme !== undefined ? { represents: n.grapheme } : {}),
        })
      }
    return out
  }
  const cells = inkCells(a, n, step)
  const whole = sample(null)
  if (!cut) return { marks: whole, cells }
  const residue = sample(cut)
  return residue.length >= whole.length * 0.25 ? { marks: residue, cells } : { marks: whole, cells }
}

/** how many places on this lattice find the character's ink */
function inkCells(a: Analysis, n: Mark, step: number): number {
  const th = ((n.rotate ?? 0) * Math.PI) / 180
  const cos = Math.cos(th)
  const sin = Math.sin(th)
  const half = Math.ceil(n.size / 2 / step) + 1
  let cells = 0
  for (let j = -half; j <= half; j++)
    for (let i = -half; i <= half; i++)
      if (inkAt(a, n, n.x + i * step * cos - j * step * sin, n.y + i * step * sin + j * step * cos)) cells++
  return cells
}

/**
 * The ring: the loop at a fixed distance from the reading itself. Where the page
 * is a single character that loop is a circle around it; where the
 * reading is a curve the satellites follow it; where it is a lattice they run
 * alongside each row. They are walked, not sampled, so they stand evenly and
 * large enough to be read.
 */
function onRing(frame: Frame, n: Mark, p: MaterialParams, w: number, chars: Chars): Mark[] {
  // A satellite is a small character beside a written one, so its size follows
  // the page's own writing: a page written large carries larger material, a page
  // written small carries finer.
  const size = Math.min(0.09 * PAGE, Math.max(0.02 * PAGE, n.size * (0.2 + 0.16 * (1 - p.fineness))))
  const radius = Math.max(p.radius * PAGE, n.size * 0.7)
  const char = chars.chars.repeat ?? chars.chars.rest ?? chars.chars.inner ?? n.char
  const out: Mark[] = []
  for (const strand of frame.strands) {
    const loop = offsetLoop(strand, radius)
    let length = 0
    for (let i = 0; i < loop.length; i++) length += Math.hypot(loop[(i + 1) % loop.length].x - loop[i].x, loop[(i + 1) % loop.length].y - loop[i].y)
    // as many as the loop holds, but satellites are counted marks, not a cloud:
    // a dozen or two
    const room = Math.min(48, Math.floor(length / (size * 1.35)))
    const count = Math.max(5, Math.round(room * (0.35 + 0.65 * p.density) * Math.min(1, w)))
    for (const q of around(loop, count)) if (inside(q.p)) out.push(grain(char, q.p.x, q.p.y, size, 'v4 material ring', 'satellite'))
  }
  return out
}

/**
 * The dust: a lattice in the frame's own coordinates — rows parallel to the
 * reading, at an even step along it and away from it. It thins along the
 * reading (dense where the title begins, open where it ends), fades away from it within `spread`, and keeps off what is written.
 *
 * A point further from the reading than the frame says it is belongs to another
 * part of the curve — where a trace turns back on itself the bands would
 * otherwise cross — so it is dropped.
 */
function onPage(frame: Frame, written: Mark[], p: MaterialParams, w: number, order: { char: string; share: number }[], fallback: string, nucleus: number): Mark[] {
  // dust, at the page's own register: its grain follows the figure's writing
  const size = Math.min(0.07 * PAGE, Math.max(0.016 * PAGE, nucleus * (0.15 + 0.14 * (1 - p.fineness))))
  const step = Math.max((0.075 - 0.05 * p.fineness) * PAGE, size * 1.3)
  const reach = PAGE * (0.09 + 0.62 * p.spread)
  const across = Math.ceil(reach / step)
  const coverage = 0.15 + 0.5 * p.density
  const out: Mark[] = []
  for (const [si, strand] of frame.strands.entries())
    for (const [i, q] of walk(strand, step).entries())
      for (let j = -across; j <= across; j++) {
        const jitter = (1 - p.regularity) * step * 0.45
        const off = j * step + (hash2(i + si * 131, j) - 0.5) * 2 * jitter
        const x = q.p.x + q.n.x * off + q.t.x * (hash2(j, i + si * 131) - 0.5) * 2 * jitter
        const y = q.p.y + q.n.y * off + q.t.y * (hash2(j, i + si * 131) - 0.5) * 2 * jitter
        if (!inside({ x, y })) continue
        // the reading's own direction, and its own distance
        const here = project(frame, x, y)
        if (Math.abs(here.d - Math.abs(off)) > step * 0.6) continue
        const thinning = Math.min(1, Math.max(0, 1.15 - here.s))
        const fade = Math.min(1, Math.max(0, 1 - (here.d / reach) ** 1.6))
        // dust does not hug what is written; between the rows of a lattice,
        // where every point is near something, it may still stand
        const near = Math.min(...written.map((k) => Math.hypot(x - k.x, y - k.y) / Math.max(1, k.size)))
        const clear = Math.min(1, Math.max(0, (near - 0.35) / 0.5))
        if (dither(i + 2, j + 1) >= coverage) continue
        const d = thinning * fade * clear
        if (d * w * (0.35 + 0.9 * p.density) <= dither(i, j)) continue
        out.push(grain(charAt(order, i, j, fallback), x, y, size, 'v4 material dust', p.fineness < 0.35 ? 'satellite' : 'grain'))
      }
  return out
}

/** a form read inside a character: the strongest relation the computer reads in it */
function innerOf(a: Analysis, char: string): { char: string; scale: number } | null {
  const r = a.glyphRelations.find((x) => x.outer === char && x.kind === 'containment')
  return r ? { char: r.inner, scale: r.scale ?? 1 } : null
}
