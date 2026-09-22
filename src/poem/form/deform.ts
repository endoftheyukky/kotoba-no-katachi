/**
 * v3 — continuous deformations of a drawn page.
 *
 * Each operator moves the page along one or two axes of the form space, by an
 * amount the title's pressures ask for (form/target.ts). None adds material:
 * they move, turn, resize, and — for an orbit's open arc — leave out marks
 * the page already had. None draws a random number except where noted as
 * plastic (the orientation of rays, as in the grammars).
 *
 * The geometry of each comes from the page's own structure, never from noise:
 *   scale   the title's characters are sized by the weight of their ink
 *   warp    the heavier letterforms pull the space toward themselves; special beats push it away
 *   bend    a line curves toward what it depends on (the nucleus, or the heavier mass)
 *   kink    a line turns where the reading turns (its word boundaries)
 *   ring    an orbit leans toward the other pole, drifts off its centre, opens toward it
 *   drift   where the title erases something, a form of small marks slumps on from where its reading ends
 *   radial  small marks round a nucleus gather onto rays
 *   turn    the title's characters turn gradually along the reading
 */
import { PAGE } from '../../render/stage'
import type { Rng } from '../../core/random'
import type { Analysis, Mark } from '../types'
import type { FormProfile } from './profile'

export interface Frame {
  a: Analysis
  marks: Mark[]
  /** the title's own marks that are the figure (not context, not derived) */
  title: number[]
  context: number[]
  derived: number[]
  /** the mark the page is organised around, if any */
  nucleus: number | null
  /** unit vector of the writing direction */
  dir: { x: number; y: number }
  /** a repetition page: its own marks are texture, and may move as its derived marks do */
  repetition: boolean
}

export interface Wanted {
  amount: number
  why: string
}

export interface Operator {
  id: string
  /** what the pressures ask of this operator on this page, or null when the page has nothing it can act on */
  wanted(f: Frame, delta: FormProfile, before: FormProfile): Wanted | null
  apply(f: Frame, amount: number, rng: Rng): Mark[]
}

const clip = (v: number, lo = 0, hi = 1) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo)
const deg = (r: number) => (r * 180) / Math.PI

export function frameOf(a: Analysis, marks: Mark[], repetition = false): Frame {
  const title: number[] = []
  const context: number[] = []
  const derived: number[] = []
  marks.forEach((k, i) => (k.derived ? derived : k.context ? context : title).push(i))
  const nuclei = marks.map((k, i) => [k, i] as const).filter(([k]) => k.role === 'nucleus')
  const pool = nuclei.length ? nuclei : title.map((i) => [marks[i], i] as const)
  const nucleus = pool.length ? pool.reduce((b, c) => (c[0].size > b[0].size ? c : b))[1] : null
  const dir = a.direction === 'vertical' ? { x: 0, y: 1 } : { x: 1, y: 0 }
  return { a, marks, title, context, derived, nucleus, dir, repetition }
}

function inkOf(a: Analysis, k: Mark): number {
  try {
    return a.glyphs.get(k.char, k.face ?? 'sans').metrics.density
  } catch {
    return 0.2
  }
}

const mass = (a: Analysis, k: Mark) => inkOf(a, k) * k.size * k.size

/** marks in a line: principal axis, extent, and how line-like (1 − λ2/λ1) */
function lineOf(ps: Mark[]) {
  const n = ps.length
  const mx = ps.reduce((s, p) => s + p.x, 0) / n
  const my = ps.reduce((s, p) => s + p.y, 0) / n
  let a = 0
  let b = 0
  let c = 0
  for (const p of ps) {
    a += (p.x - mx) ** 2
    b += (p.x - mx) * (p.y - my)
    c += (p.y - my) ** 2
  }
  const t = Math.sqrt(((a - c) / 2) ** 2 + b * b)
  const l1 = (a + c) / 2 + t
  const l2 = Math.max(0, (a + c) / 2 - t)
  const phi = 0.5 * Math.atan2(2 * b, a - c)
  const u = { x: Math.cos(phi), y: Math.sin(phi) }
  const proj = ps.map((p) => (p.x - mx) * u.x + (p.y - my) * u.y)
  return { mx, my, u, linear: l1 > 0 ? 1 - l2 / l1 : 0, extent: Math.max(...proj) - Math.min(...proj) }
}

/** groups of derived marks that touch or nearly touch (single linkage on gaps) */
function groupsOf(marks: Mark[], idx: number[], reach = 1.8): number[][] {
  const parent = new Map(idx.map((i) => [i, i]))
  const root = (i: number): number => (parent.get(i) === i ? i : root(parent.get(i)!))
  for (let p = 0; p < idx.length; p++)
    for (let q = p + 1; q < idx.length; q++) {
      const i = idx[p]
      const j = idx[q]
      const d = Math.hypot(marks[i].x - marks[j].x, marks[i].y - marks[j].y)
      if (d <= reach * Math.max(marks[i].size, marks[j].size)) parent.set(root(i), root(j))
    }
  const out = new Map<number, number[]>()
  for (const i of idx) out.set(root(i), [...(out.get(root(i)) ?? []), i])
  return [...out.values()]
}

/** which side of a line its bend goes: toward the nucleus (or the heaviest mass off the line), else toward the page's centre */
function bendSide(f: Frame, group: number[], line: ReturnType<typeof lineOf>): number {
  const normal = { x: -line.u.y, y: line.u.x }
  const off = [...f.title, ...(f.nucleus !== null ? [f.nucleus] : [])].filter((i) => !group.includes(i))
  const anchor = off.length ? off.reduce((b, i) => (mass(f.a, f.marks[i]) > mass(f.a, f.marks[b]) ? i : b)) : null
  const to = anchor !== null ? { x: f.marks[anchor].x, y: f.marks[anchor].y } : { x: PAGE / 2, y: PAGE / 2 }
  const side = (to.x - line.mx) * normal.x + (to.y - line.my) * normal.y
  return side >= 0 ? 1 : -1
}

// --- the operators ---------------------------------------------------------------

const scale: Operator = {
  id: 'scale',
  wanted(f, delta) {
    if (Math.abs(delta.hierarchy) < 0.05) return null
    const distinct = new Set(f.title.map((i) => f.marks[i].char)).size
    if (distinct < 2) return null
    return { amount: delta.hierarchy, why: delta.hierarchy > 0 ? 'the title’s characters are sized by the weight of their ink' : 'sizes draw together' }
  },
  apply(f, amount) {
    const title = f.title.map((i) => f.marks[i]).filter((k) => !k.keep && !k.minus)
    const mean = title.reduce((s, k) => s + inkOf(f.a, k), 0) / (title.length || 1)
    return f.marks.map((k, i) => {
      if (k.context || k.keep || k.minus) return k
      if (!k.derived) {
        if (i === f.nucleus && title.length < 2) return k
        const factor = clip((inkOf(f.a, k) / (mean || 1)) ** (0.6 * amount), 0.78, 1.28)
        return { ...k, size: k.size * factor }
      }
      return k
    })
  },
}

const warp: Operator = {
  id: 'warp',
  wanted(f, delta) {
    const amount = Math.max(0, -delta.periodicity) + 0.5 * Math.max(0, -delta.symmetry)
    if (amount < 0.05 || (!f.derived.length && !f.repetition)) return null
    if (!sources(f).length) return null
    return { amount: clip(amount), why: 'the heavier letterforms pull the spacing toward themselves; special beats push it apart' }
  },
  apply(f, amount) {
    const src = sources(f)
    const sigma = 0.28 * PAGE
    const A = amount * 0.1 * PAGE
    const field = (x: number, y: number) => {
      let dx = 0
      let dy = 0
      for (const s of src) {
        const rx = s.x - x
        const ry = s.y - y
        const r = Math.hypot(rx, ry) || 1
        const k = s.strength * Math.exp(-(r * r) / (2 * sigma * sigma))
        dx += (k * rx) / r
        dy += (k * ry) / r
      }
      return { dx: A * dx, dy: A * dy }
    }
    return f.marks.map((k) => {
      const damp = k.derived ? 1 : k.context ? 0.15 : f.repetition ? 0.8 : 0.3
      let { dx, dy } = field(k.x, k.y)
      dx *= damp
      dy *= damp
      // an attracted mark stops short of the ink that attracts it
      for (const s of src) {
        const d = Math.hypot(s.x - (k.x + dx), s.y - (k.y + dy))
        if (s.strength > 0 && d < 0.62 * s.size + k.size * 0.5) {
          const keep = clip((Math.hypot(s.x - k.x, s.y - k.y) - 0.62 * s.size - k.size * 0.5) / (Math.hypot(dx, dy) || 1))
          dx *= keep
          dy *= keep
        }
      }
      return dx || dy ? { ...k, x: k.x + dx, y: k.y + dy } : k
    })
  },
}

/** the masses that bend the page: ink heavier than the page's mean attracts, lighter repels; a special beat repels */
function sources(f: Frame) {
  const own = f.title.map((i) => f.marks[i])
  if (!own.length) return []
  const masses = own.map((k) => mass(f.a, k))
  const mean = masses.reduce((s, v) => s + v, 0) / masses.length
  const special = new Set(f.a.morae.filter((m) => m.kind === 'Q' || m.kind === 'N' || m.kind === 'R').flatMap((m) => m.graphemes))
  return own
    .map((k, i) => ({
      x: k.x,
      y: k.y,
      size: k.size,
      strength: clip((masses[i] - mean) / (mean || 1), -1, 1.5) - (k.grapheme !== undefined && special.has(k.grapheme) ? 0.8 : 0),
    }))
    .filter((s) => Math.abs(s.strength) >= 0.12)
}

/** the lines a page draws: its own writing in a row, and rows of derived marks */
function lines(f: Frame): number[][] {
  const out: number[][] = []
  const own = f.title.filter((i) => !f.marks[i].keep).sort((p, q) => (f.marks[p].grapheme ?? 0) - (f.marks[q].grapheme ?? 0))
  if (own.length >= 4 && lineOf(own.map((i) => f.marks[i])).linear >= 0.85) out.push(own)
  for (const g of groupsOf(f.marks, f.derived)) {
    if (g.length < 4) continue
    const l = lineOf(g.map((i) => f.marks[i]))
    if (l.linear >= 0.9 && l.extent >= 0.12 * PAGE) out.push(g)
  }
  return out
}

function bendGroup(f: Frame, marks: Mark[], group: number[], theta: number, follow: number): void {
  const line = lineOf(group.map((i) => f.marks[i]))
  if (theta < 0.02 || line.extent <= 0) return
  const side = bendSide(f, group, line)
  const normal = { x: -line.u.y * side, y: line.u.x * side }
  const R = line.extent / theta
  for (const i of group) {
    const k = f.marks[i]
    const u = (k.x - line.mx) * line.u.x + (k.y - line.my) * line.u.y
    const v = (k.x - line.mx) * normal.x + (k.y - line.my) * normal.y
    const phi = u / R
    const rho = R - v
    const lu = rho * Math.sin(phi)
    const lv = R - rho * Math.cos(phi)
    const turn = deg(phi) * follow * (line.u.x * normal.y - line.u.y * normal.x > 0 ? 1 : -1)
    marks[i] = {
      ...k,
      x: line.mx + lu * line.u.x + lv * normal.x,
      y: line.my + lu * line.u.y + lv * normal.y,
      ...(turn ? { rotate: (k.rotate ?? 0) + turn } : {}),
    }
  }
}

const bend: Operator = {
  id: 'bend',
  wanted(f, delta) {
    const amount = Math.max(0, delta.curvature) + 0.5 * Math.max(0, delta.closure)
    if (amount < 0.05 || !lines(f).length) return null
    return { amount: clip(amount), why: 'lines curve toward what they depend on, as far as the reading turns and returns' }
  },
  apply(f, amount) {
    const marks = [...f.marks]
    const follow = f.marks.some((k) => k.rotate) ? 1 : 0
    // the title's own line bends little (it is read); a row of small marks may bend further
    for (const g of lines(f)) bendGroup(f, marks, g, amount * Math.PI * (g.every((i) => f.title.includes(i)) ? 0.22 : 0.6), follow)
    return marks
  },
}

const kink: Operator = {
  id: 'kink',
  wanted(f, delta) {
    if (delta.branching < 0.05) return null
    const own = lines(f)[0]
    if (!own || !own.every((i) => f.title.includes(i))) return null
    const breaks = own.filter((i, n) => n > 0 && f.a.tokenOf[f.marks[i].grapheme ?? 0] !== f.a.tokenOf[f.marks[own[n - 1]].grapheme ?? 0])
    if (!breaks.length) return null
    return { amount: clip(delta.branching), why: 'the written line turns at each word boundary, a little further each time' }
  },
  apply(f, amount) {
    const own = lines(f)[0]
    const marks = [...f.marks]
    const line = lineOf(own.map((i) => f.marks[i]))
    const side = bendSide(f, own, line)
    const psi = (amount * 28 * Math.PI) / 180 * side
    let turned = 0
    for (let n = 1; n < own.length; n++) {
      const prev = f.marks[own[n - 1]]
      const k = f.marks[own[n]]
      if (f.a.tokenOf[k.grapheme ?? 0] === f.a.tokenOf[prev.grapheme ?? 0]) continue
      // everything after this boundary turns about the boundary
      turned += psi
      const px = (prev.x + k.x) / 2
      const py = (prev.y + k.y) / 2
      for (const j of own.slice(n)) {
        const m = marks[j]
        const dx = m.x - px
        const dy = m.y - py
        marks[j] = { ...m, x: px + dx * Math.cos(psi) - dy * Math.sin(psi), y: py + dx * Math.sin(psi) + dy * Math.cos(psi) }
      }
    }
    return turned ? marks : f.marks
  },
}

/** an orbit's rings: marks the orbit grammar added, by the pole they go round */
function rings(f: Frame) {
  const orbit = f.derived.filter((i) => f.marks[i].derived?.grammar === 'orbit')
  const poles = f.title.filter((i) => !f.marks[i].keep).sort((p, q) => f.marks[q].size - f.marks[p].size).slice(0, 2)
  if (!orbit.length || poles.length < 2) return []
  return poles.map((p, n) => ({
    pole: p,
    other: poles[1 - n],
    members: orbit.filter((i) => {
      const k = f.marks[i]
      const d = (q: number) => Math.hypot(k.x - f.marks[q].x, k.y - f.marks[q].y)
      return d(p) <= d(poles[1 - n])
    }),
  }))
}

const ring: Operator = {
  id: 'ring',
  wanted(f, delta) {
    const amount = Math.max(0, -delta.symmetry) + 0.5 * Math.max(0, -delta.closure)
    if (amount < 0.05 || !rings(f).some((r) => r.members.length >= 6)) return null
    return { amount: clip(amount), why: 'the rings lean toward the other pole, off their centre, and open toward it on the lighter side' }
  },
  apply(f, amount) {
    const marks: (Mark | null)[] = [...f.marks]
    const rs = rings(f)
    const w = new Map(rs.map((r) => [r.pole, mass(f.a, f.marks[r.pole])]))
    for (const r of rs) {
      const P = f.marks[r.pole]
      const Q = f.marks[r.other]
      const toward = Math.atan2(Q.y - P.y, Q.x - P.x)
      const light = (w.get(r.other) ?? 1) / ((w.get(r.pole) ?? 1) + (w.get(r.other) ?? 1))
      const radius = r.members.reduce((s, i) => s + Math.hypot(f.marks[i].x - P.x, f.marks[i].y - P.y), 0) / (r.members.length || 1)
      const cx = P.x + 0.14 * amount * radius * Math.cos(toward)
      const cy = P.y + 0.14 * amount * radius * Math.sin(toward)
      const open = amount * light * 0.9
      for (const i of r.members) {
        const k = f.marks[i]
        const th = Math.atan2(k.y - P.y, k.x - P.x)
        const rel = Math.atan2(Math.sin(th - toward), Math.cos(th - toward))
        // an arc facing the other pole is left open, wider round the lighter term
        if (Math.abs(rel) < open * Math.PI * 0.5) {
          marks[i] = null
          continue
        }
        const rr = Math.hypot(k.x - P.x, k.y - P.y) * (1 + 0.3 * amount * Math.cos(rel))
        marks[i] = { ...k, x: cx + rr * Math.cos(th), y: cy + rr * Math.sin(th) }
      }
    }
    return marks.filter((k): k is Mark => k !== null)
  },
}

const drift: Operator = {
  id: 'drift',
  wanted(f, delta) {
    const erased = f.a.relations.some((r) => r.kind === 'negation' || r.kind === 'silence')
    const out = erased ? Math.max(0, delta.fragmentation) + 0.5 * Math.max(0, delta.dispersion) : 0
    const inward = Math.min(0, delta.dispersion)
    const amount = out >= 0.05 ? out : inward <= -0.05 ? inward : 0
    if (!amount) return null
    const grains = f.derived.filter((i) => f.marks[i].role === 'grain')
    const parts = f.title.filter((i) => f.marks[i].keep)
    if (grains.length < 12 && parts.length < 2) return null
    return {
      amount: clip(amount, -1, 1),
      why: amount > 0 ? 'the form loosens from where its reading ends, and flows on in the reading direction' : 'a perfect repetition draws its marks together',
    }
  },
  apply(f, amount) {
    const marks = [...f.marks]
    const grains = f.derived.filter((i) => f.marks[i].role === 'grain')
    for (const g of groupsOf(f.marks, grains, 2.4).filter((g) => g.length >= 12)) {
      const cx = g.reduce((s, i) => s + f.marks[i].x, 0) / g.length
      const cy = g.reduce((s, i) => s + f.marks[i].y, 0) / g.length
      if (amount < 0) {
        for (const i of g) {
          const k = f.marks[i]
          marks[i] = { ...k, x: cx + (k.x - cx) * (1 + 0.25 * amount), y: cy + (k.y - cy) * (1 + 0.25 * amount) }
        }
        continue
      }
      // the part of the form past where its reading ends slumps on as one body: stretched
      // along the reading, narrowed toward its own middle, the grains keeping their order
      // (a flow, not a scatter)
      const t = g.map((i) => f.marks[i].x * f.dir.x + f.marks[i].y * f.dir.y)
      const lo = Math.min(...t)
      const hi = Math.max(...t)
      const phi = 0.6 * amount
      const across = { x: -f.dir.y, y: f.dir.x }
      const mid = g.reduce((s, i) => s + f.marks[i].x * across.x + f.marks[i].y * across.y, 0) / g.length
      g.forEach((i, n) => {
        const pos = hi > lo ? (t[n] - lo) / (hi - lo) : 0
        if (pos < 1 - phi) return
        const p = (pos - (1 - phi)) / phi
        const k = f.marks[i]
        const along = 0.22 * PAGE * amount * p * p
        const off = (k.x * across.x + k.y * across.y - mid) * -0.4 * p
        marks[i] = {
          ...k,
          x: k.x + along * f.dir.x + off * across.x,
          y: k.y + along * f.dir.y + off * across.y,
          size: k.size * (1 - 0.22 * p),
        }
      })
    }
    // the parts of one character move apart from their common centre
    const byGrapheme = new Map<number, number[]>()
    for (const i of f.title) if (f.marks[i].keep && f.marks[i].grapheme !== undefined) byGrapheme.set(f.marks[i].grapheme!, [...(byGrapheme.get(f.marks[i].grapheme!) ?? []), i])
    for (const g of byGrapheme.values()) {
      if (g.length < 2) continue
      const cx = g.reduce((s, i) => s + f.marks[i].x, 0) / g.length
      const cy = g.reduce((s, i) => s + f.marks[i].y, 0) / g.length
      for (const i of g) {
        const k = marks[i]
        marks[i] = { ...k, x: cx + (k.x - cx) * (1 + 0.35 * amount), y: cy + (k.y - cy) * (1 + 0.35 * amount) }
      }
    }
    return marks
  },
}

const radial: Operator = {
  id: 'radial',
  wanted(f, delta) {
    if (delta.radiality < 0.05 || f.nucleus === null) return null
    const n = f.marks[f.nucleus]
    const around = f.derived.filter((i) => Math.hypot(f.marks[i].x - n.x, f.marks[i].y - n.y) <= 1.6 * n.size)
    if (around.length < 8) return null
    return { amount: clip(delta.radiality), why: 'the marks round the head gather onto rays, one for each word that hangs on it' }
  },
  apply(f, amount, rng) {
    const n = f.marks[f.nucleus!]
    const heads = new Map<number, number>()
    for (const r of f.a.relations) if (r.kind === 'dependency') heads.set(r.head, (heads.get(r.head) ?? 0) + 1)
    const rays = Math.max(3, ...heads.values())
    // plastic: where the first ray points
    const base = rng.range(0, (2 * Math.PI) / rays)
    return f.marks.map((k, i) => {
      if (!f.derived.includes(i)) return k
      const dx = k.x - n.x
      const dy = k.y - n.y
      const r = Math.hypot(dx, dy)
      if (r > 1.6 * n.size) return k
      const th = Math.atan2(dy, dx)
      const step = (2 * Math.PI) / rays
      const ray = base + Math.round((th - base) / step) * step
      const to = th + (Math.atan2(Math.sin(ray - th), Math.cos(ray - th)) * amount * 0.6)
      return { ...k, x: n.x + r * Math.cos(to), y: n.y + r * Math.sin(to) }
    })
  },
}

const turn: Operator = {
  id: 'turn',
  wanted(_f, delta, before) {
    if (delta.rotation <= -0.05) return { amount: clip(-delta.rotation), why: 'the marks turn gradually along the reading' }
    if (delta.rotation >= 0.05 && before.rotation < 0.6) return { amount: -clip(delta.rotation), why: 'the turning settles' }
    return null
  },
  apply(f, amount) {
    if (amount < 0) return f.marks.map((k) => (k.rotate ? { ...k, rotate: k.rotate * (1 + 0.6 * amount) } : k))
    const own = f.title.filter((i) => !f.marks[i].keep).sort((p, q) => (f.marks[p].grapheme ?? 0) - (f.marks[q].grapheme ?? 0))
    const order = new Map(own.map((i, n) => [i, own.length > 1 ? n / (own.length - 1) : 0.5]))
    return f.marks.map((k, i) => {
      if (k.context) return k
      const pos = order.has(i) ? order.get(i)! : null
      if (pos === null) return k
      const beta = 34 * amount
      return { ...k, rotate: (k.rotate ?? 0) + beta * (pos - 0.5) }
    })
  },
}

/** in the order they act: sizes first, then the space, then lines, rings, loosening, and last the turning */
export const OPERATORS: readonly Operator[] = [scale, warp, bend, kink, ring, radial, drift, turn]
