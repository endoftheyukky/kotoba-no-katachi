/**
 * v4 — the material: what a page is made of, as one continuous field.
 *
 * v2b–v2c keep this in separate grammars, and a page belongs to one of them:
 * silhouette (a form sampled in small marks), orbit (satellites on a ring),
 * field (dust over the page), attenuation (a trail), residue (the form is
 * what a subtraction left). Here they are one generator, and a title takes a
 * place in it.
 *
 * Small marks stand where a density field says they may:
 *
 *   onForm   the ink of the page's own nucleus — sampling it draws the form
 *            in small marks (silhouette)
 *   onRing   a ring at some radius around the nucleus (satellites, an orbit)
 *   onPage   the page itself, thinning toward the writing (dust, a field)
 *
 * The three are weights that sum to one: a page can be nine parts form and one
 * part dust, or half a ring and half a field. `density` says how much material
 * there is at all — at 0 the page is the figure alone, which is what a v2c page
 * with no grammar is. `fineness` runs from a few satellites to many grains of
 * dust; `cut` takes the inner glyph out of the form before it is sampled (the
 * residue); `sources` mixes what the small marks are written with.
 *
 * Nothing is random: the lattice the field is sampled on is fixed, the order in
 * which points are dropped is a fixed dither (as in v2c's field), and which
 * character a grain carries follows the shares in order.
 */
import { EM } from '../../glyph/font'
import { PAGE } from '../../render/stage'
import type { Analysis, Mark } from '../types'

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
  /** the ring's radius, as a share of the page */
  radius: number
  /** how much of the form's ink the inner glyph takes out before it is sampled */
  cut: number
  /** how far the sampling lattice keeps its interval (1) or follows the ink (0) */
  regularity: number
  sources: MaterialSources
}

/** an ordered dither, as in v2c's field: the same points always go first */
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

/** the ink of a character, sampled in the em space of a mark that is not drawn */
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
}

/**
 * The material of a page: small marks over the figure, and the figure itself
 * where the material has taken over its nucleus (the glyph is written only as
 * far as the form has not been sampled — at full density it is not written at
 * all, and the grains stand for it).
 */
export function materialMarks(a: Analysis, figure: Figure, p: MaterialParams, chars: MaterialSources & { chars: Record<keyof MaterialSources, string | null> }): Material {
  const dir = a.direction === 'vertical' ? { x: 0, y: 1 } : { x: 1, y: 0 }
  const weights = [p.onForm, p.onRing, p.onPage]
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0) || 1
  const [wForm, wRing, wPage] = weights.map((w) => Math.max(0, w) / total)
  const n = figure.nucleus
  if (p.density <= 0.02 || !n) return { marks: [], figure: figure.marks, grains: 0 }

  // How fine: the interval of the lattice the material is sampled on. A form
  // has to be read as the letterform it is, so where the material stands on the
  // nucleus's ink the interval follows the nucleus, not the page: eleven to
  // twenty-four grains across it, as in v2c's silhouette.
  const pageStep = (0.075 - 0.05 * p.fineness) * PAGE
  const formStep = n.size / (11 + 13 * p.fineness)
  const step = wForm >= 0.2 ? Math.min(pageStep, formStep) : pageStep
  const grainSize = step * (0.6 + 0.25 * (1 - p.fineness))
  const radius = p.radius * PAGE
  // a ring of satellites is one mark wide, not a band of haze
  const cut = p.cut > 0.25 ? innerOf(a, n.char) : null

  // the sources, in the order their shares run out
  const order: { char: string; share: number }[] = (Object.keys(p.sources) as (keyof MaterialSources)[])
    .map((k) => ({ char: chars.chars[k] ?? '', share: p.sources[k] }))
    .filter((s) => s.char && s.share > 0)
  const shareTotal = order.reduce((s, o) => s + o.share, 0) || 1

  const marks: Mark[] = []
  // The ring: small characters walked round the nucleus, as many as its
  // circumference holds — satellites, not a dotted outline sampled from a field.
  if (wRing > 0.02) {
    const satellite = PAGE * (0.030 + 0.022 * (1 - p.fineness))
    const room = Math.floor((2 * Math.PI * radius) / (satellite * 1.35))
    const count = Math.max(5, Math.round(room * (0.35 + 0.65 * p.density) * wRing))
    for (let t = 0; t < count; t++) {
      const th = (2 * Math.PI * t) / count
      marks.push({
        char: ringChar(chars, n.char),
        x: n.x + radius * Math.cos(th),
        y: n.y + radius * Math.sin(th),
        size: satellite,
        role: 'satellite',
        derived: { grammar: 'material', kind: 'form', note: 'v4 material ring' },
      })
    }
  }
  const cols = Math.ceil(PAGE / step)
  for (let j = 0; j <= cols; j++)
    for (let i = 0; i <= cols; i++) {
      // the lattice, as even as `regularity` says
      const jitter = (1 - p.regularity) * step * 0.45
      const x = i * step + (hash2(i, j) - 0.5) * 2 * jitter
      const y = j * step + (hash2(j + 977, i) - 0.5) * 2 * jitter
      if (x < 0.02 * PAGE || y < 0.02 * PAGE || x > 0.98 * PAGE || y > 0.98 * PAGE) continue

      const form = wForm ? formDensity(a, n, cut, x, y) : 0
      // Dust over the page thins along the reading, as v2c's field does —
      // dense where the writing begins, open where it ends — and keeps off
      // what is written. A halo around the figure would be a new family.
      const near = Math.min(...figure.marks.filter((k) => !k.derived).map((k) => Math.hypot(x - k.x, y - k.y) / Math.max(1, k.size)))
      const along = (x * dir.x + y * dir.y) / PAGE
      const thinning = Math.min(1, Math.max(0, 1.15 - along))
      const clear = Math.min(1, Math.max(0, (near - 0.75) / 0.8))
      const coverage = 0.15 + 0.5 * p.density
      const page = wPage && dither(i + 2, j + 1) < coverage ? thinning * clear : 0

      const d = wForm * form + wPage * page
      if (d * (0.35 + 0.9 * p.density) <= dither(i, j)) continue

      // which character this grain is written with: the shares, in order
      const at = (((i * 7 + j * 13) % 100) / 100) * shareTotal
      let acc = 0
      let char = order[0]?.char ?? n.char
      for (const o of order) {
        acc += o.share
        if (at <= acc) {
          char = o.char
          break
        }
      }
      marks.push({
        char,
        x,
        y,
        size: grainSize,
        role: p.fineness < 0.35 ? 'satellite' : 'grain',
        derived: { grammar: 'material', kind: 'form', note: 'v4 material field' },
        ...(wForm > 0.5 && n.grapheme !== undefined ? { represents: n.grapheme } : {}),
      })
    }

  // the nucleus is written only as far as the material has not taken it over
  const taken = wForm * Math.min(1, p.density * 1.4)
  let own = figure.marks
  if (taken > 0.12 && n.grapheme !== undefined) {
    own = figure.marks.map((k) => {
      if (k !== n) return k
      if (taken >= 0.88) return null as unknown as Mark
      // keep the part of the glyph the grains have not taken: the reading's own direction
      const keep = { x: -EM / 2, y: -EM / 2, w: EM, h: EM * (1 - taken) }
      return { ...k, keep: [keep] }
    }).filter(Boolean)
  }
  // A grain never stands on ink the page still writes — tested as the audits
  // test it, at the grain's centre and its four corners.
  const kept = marks.filter((g) => {
    const pts = [[0, 0], [0.3, 0.3], [-0.3, 0.3], [0.3, -0.3], [-0.3, -0.3]].map(([u, v]) => [g.x + u * g.size, g.y + v * g.size] as const)
    return !own.some((k) => !k.derived && Math.abs(k.x - g.x) < k.size && Math.abs(k.y - g.y) < k.size && pts.some(([x, y]) => inkAt(a, k, x, y)))
  })
  return { marks: kept, figure: own, grains: kept.length }
}

/** what the ring is written with: the title's repetition first, then what it offers next */
function ringChar(chars: MaterialSources & { chars: Record<keyof MaterialSources, string | null> }, fallback: string): string {
  return chars.chars.repeat ?? chars.chars.rest ?? chars.chars.inner ?? fallback
}

/** a form read inside a character: the strongest relation the computer reads in it */
function innerOf(a: Analysis, char: string): { char: string; scale: number } | null {
  const r = a.glyphRelations.find((x) => x.outer === char && x.kind === 'containment')
  return r ? { char: r.inner, scale: r.scale ?? 1 } : null
}
