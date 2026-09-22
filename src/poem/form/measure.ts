/**
 * v3 — the form of a drawn page, measured from its marks alone.
 *
 * Nothing here knows which composition or grammar made the page: a ring is a
 * ring whether orbit drew it or a path bent into one. That is the point — it
 * is what lets pages made by different grammars stand in one space.
 *
 * Every mark is a point at its ink centre, weighted by its size (a compromise
 * between counting marks and weighing ink: one macro glyph must not silence
 * a hundred grains, nor the grains the glyph), times the share of it that is
 * on the page, times the share of its glyph a mask keeps.
 *
 * Deterministic and pure: the same marks always give the same profile.
 */
import { EM } from '../../glyph/font'
import { PAGE } from '../../render/stage'
import type { Mark } from '../types'
import { AXES, type FormProfile } from './profile'

interface Pt {
  x: number
  y: number
  s: number
  w: number
  rot: number
  partial: boolean
  /** which character of the title it writes, when it writes one (for the reading's own curve) */
  g?: number
}

export interface FormMeasure {
  profile: FormProfile
  /** descriptive, not part of the space */
  extra: { marks: number; clusters: number; coverage: number; offset: number }
}

const clip = (v: number, lo = 0, hi = 1) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo)
const TAU = Math.PI * 2

function points(marks: Mark[]): Pt[] {
  const out: Pt[] = []
  for (const k of marks) {
    const h = k.size / 2
    const w = Math.max(0, Math.min(PAGE, k.x + h) - Math.max(0, k.x - h))
    const v = Math.max(0, Math.min(PAGE, k.y + h) - Math.max(0, k.y - h))
    const visible = (w * v) / (k.size * k.size || 1)
    if (visible <= 0.02) continue
    const kept = k.keep?.length ? Math.min(1, k.keep.reduce((s, r) => s + r.w * r.h, 0) / (EM * EM)) : 1
    out.push({
      x: Math.min(PAGE, Math.max(0, k.x)),
      y: Math.min(PAGE, Math.max(0, k.y)),
      s: k.size,
      w: k.size * visible * Math.sqrt(Math.max(0.05, kept)),
      rot: ((k.rotate ?? 0) * Math.PI) / 180,
      partial: !!(k.keep?.length || k.minus),
      ...(k.grapheme !== undefined && !k.derived && !k.context ? { g: k.grapheme } : {}),
    })
  }
  return out
}

function moments(ps: Pt[]) {
  const W = ps.reduce((s, p) => s + p.w, 0) || 1
  const mx = ps.reduce((s, p) => s + p.w * p.x, 0) / W
  const my = ps.reduce((s, p) => s + p.w * p.y, 0) / W
  let a = 0
  let b = 0
  let c = 0
  for (const p of ps) {
    a += p.w * (p.x - mx) ** 2
    b += p.w * (p.x - mx) * (p.y - my)
    c += p.w * (p.y - my) ** 2
  }
  a /= W
  b /= W
  c /= W
  const t = Math.sqrt(((a - c) / 2) ** 2 + b * b)
  const l1 = (a + c) / 2 + t
  const l2 = Math.max(0, (a + c) / 2 - t)
  const phi = 0.5 * Math.atan2(2 * b, a - c)
  return { W, mx, my, l1, l2, ux: Math.cos(phi), uy: Math.sin(phi) }
}

/** the gap between two marks' ink boxes (0 when they touch), roughly */
const gap = (p: Pt, q: Pt) => Math.max(0, Math.hypot(p.x - q.x, p.y - q.y) - 0.36 * (p.s + q.s))

/** minimum spanning tree (Prim), on centre distances */
function mst(ps: Pt[]): [number, number, number][] {
  const n = ps.length
  const inTree = new Uint8Array(n)
  const best = new Float64Array(n).fill(Infinity)
  const from = new Int32Array(n).fill(-1)
  const edges: [number, number, number][] = []
  if (!n) return edges
  best[0] = 0
  for (let it = 0; it < n; it++) {
    let u = -1
    for (let i = 0; i < n; i++) if (!inTree[i] && (u < 0 || best[i] < best[u])) u = i
    inTree[u] = 1
    if (from[u] >= 0) edges.push([from[u], u, best[u]])
    for (let v = 0; v < n; v++) {
      if (inTree[v]) continue
      const d = Math.hypot(ps[u].x - ps[v].x, ps[u].y - ps[v].y)
      if (d < best[v]) {
        best[v] = d
        from[v] = u
      }
    }
  }
  return edges
}

/** groups of marks separated by white wider than `tau` (single linkage on ink gaps) */
function clusters(ps: Pt[], tau: number): number[][] {
  const n = ps.length
  const parent = Array.from({ length: n }, (_, i) => i)
  const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i])))
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (gap(ps[i], ps[j]) <= tau) parent[root(i)] = root(j)
  const groups = new Map<number, number[]>()
  for (let i = 0; i < n; i++) groups.set(root(i), [...(groups.get(root(i)) ?? []), i])
  return [...groups.values()].sort((a, b) => a[0] - b[0])
}

/** weighted algebraic circle fit (Kåsa); null when the points are (nearly) on a line */
function circle(ps: Pt[]): { cx: number; cy: number; r: number } | null {
  let sw = 0
  let sx = 0
  let sy = 0
  let sxx = 0
  let syy = 0
  let sxy = 0
  let sz = 0
  let sxz = 0
  let syz = 0
  for (const p of ps) {
    const z = p.x * p.x + p.y * p.y
    sw += p.w
    sx += p.w * p.x
    sy += p.w * p.y
    sxx += p.w * p.x * p.x
    syy += p.w * p.y * p.y
    sxy += p.w * p.x * p.y
    sz += p.w * z
    sxz += p.w * p.x * z
    syz += p.w * p.y * z
  }
  // [sxx sxy sx; sxy syy sy; sx sy sw] [D E F]ᵀ = −[sxz syz sz]ᵀ
  const m = [
    [sxx, sxy, sx, -sxz],
    [sxy, syy, sy, -syz],
    [sx, sy, sw, -sz],
  ]
  for (let i = 0; i < 3; i++) {
    let p = i
    for (let r = i + 1; r < 3; r++) if (Math.abs(m[r][i]) > Math.abs(m[p][i])) p = r
    ;[m[i], m[p]] = [m[p], m[i]]
    if (Math.abs(m[i][i]) < 1e-9) return null
    for (let r = 0; r < 3; r++) {
      if (r === i) continue
      const f = m[r][i] / m[i][i]
      for (let c = i; c < 4; c++) m[r][c] -= f * m[i][c]
    }
  }
  const D = m[0][3] / m[0][0]
  const E = m[1][3] / m[1][1]
  const F = m[2][3] / m[2][2]
  const cx = -D / 2
  const cy = -E / 2
  const r2 = cx * cx + cy * cy - F
  if (!(r2 > 0)) return null
  const r = Math.sqrt(r2)
  return r > 4 * PAGE ? null : { cx, cy, r }
}

/** the ring a group's minor marks make around its fitted circle: how curved, how closed */
function ringOf(ps: Pt[]): { curvature: number; closure: number } {
  if (ps.length < 5) return { curvature: 0, closure: 0 }
  const c = circle(ps)
  if (!c || c.r < 0.03 * PAGE) return { curvature: 0, closure: 0 }
  const W = ps.reduce((s, p) => s + p.w, 0)
  const rs = ps.map((p) => Math.hypot(p.x - c.cx, p.y - c.cy))
  const mean = rs.reduce((s, r, i) => s + ps[i].w * r, 0) / W
  const sd = Math.sqrt(rs.reduce((s, r, i) => s + ps[i].w * (r - mean) ** 2, 0) / W)
  const ringness = 1 - sd / (mean || 1)
  const arcness = clip((ringness - 0.6) / 0.3)
  const angles = ps.map((p) => Math.atan2(p.y - c.cy, p.x - c.cx)).sort((a, b) => a - b)
  let widest = angles[0] + TAU - angles[angles.length - 1]
  for (let i = 1; i < angles.length; i++) widest = Math.max(widest, angles[i] - angles[i - 1])
  const span = TAU - widest
  return { curvature: arcness * clip(span / Math.PI), closure: arcness * clip((span - Math.PI) / Math.PI) }
}

/**
 * The curve the reading makes: the title's own marks in the order they are
 * read. A page of four large characters has no ring to fit, but it can still
 * bend and close, and this is how far it does — the turning along the line
 * they make, and how near its end comes back to its beginning.
 */
function readingCurve(ps: Pt[]): { curvature: number; closure: number } {
  const seen = new Map<number, Pt>()
  for (const p of ps) if (p.g !== undefined && (!seen.has(p.g) || seen.get(p.g)!.s < p.s)) seen.set(p.g, p)
  const line = [...seen.entries()].sort((a, b) => a[0] - b[0]).map(([, p]) => p)
  if (line.length < 4) return { curvature: 0, closure: 0 }
  let turning = 0
  let length = 0
  for (let i = 1; i < line.length; i++) length += Math.hypot(line[i].x - line[i - 1].x, line[i].y - line[i - 1].y)
  for (let i = 1; i < line.length - 1; i++) {
    const a = Math.atan2(line[i].y - line[i - 1].y, line[i].x - line[i - 1].x)
    const b = Math.atan2(line[i + 1].y - line[i].y, line[i + 1].x - line[i].x)
    turning += Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)))
  }
  const gap = Math.hypot(line[line.length - 1].x - line[0].x, line[line.length - 1].y - line[0].y)
  return { curvature: clip(turning / TAU), closure: length > 0 ? clip(1 - gap / length) : 0 }
}

/**
 * Around one centre: a mark clearly unlike the marks around it in size (a
 * nucleus among grains, a small core among large parts), with marks on every
 * side of it. The best such centre on the page.
 */
function radialOf(ps: Pt[], mx: number, my: number): number {
  if (ps.length < 5) return 0
  const bySize = ps.map((_, i) => i).sort((a, b) => ps[b].s - ps[a].s)
  const central = ps.reduce((b, p, i) => (Math.hypot(p.x - mx, p.y - my) < Math.hypot(ps[b].x - mx, ps[b].y - my) ? i : b), 0)
  let best = 0
  for (const c of new Set([...bySize.slice(0, 12), central])) {
    const o = ps[c]
    const reach = Math.max(1.4 * o.s, 0.25 * PAGE)
    const around = ps.filter((p, i) => i !== c && Math.hypot(p.x - o.x, p.y - o.y) <= reach)
    if (around.length < 4) continue
    const sizes = around.map((p) => p.s).sort((a, b) => a - b)
    const median = sizes[Math.floor(sizes.length / 2)]
    const contrast = clip(Math.abs(Math.log(o.s / median)) / Math.log(2.5))
    const bins = new Set(around.map((p) => Math.floor(((Math.atan2(p.y - o.y, p.x - o.x) + Math.PI) / TAU) * 12) % 12))
    best = Math.max(best, contrast * clip((bins.size / 12 - 0.25) / 0.6) * clip(around.length / 8))
  }
  return best
}

function spanningBranches(ps: Pt[], edges: [number, number, number][]): number {
  const n = ps.length
  if (n < 5) return 0
  const adj = Array.from({ length: n }, () => [] as [number, number][])
  for (const [a, b, d] of edges) {
    adj[a].push([b, d])
    adj[b].push([a, d])
  }
  let significant = 0
  for (let leaf = 0; leaf < n; leaf++) {
    if (adj[leaf].length !== 1) continue
    // walk inward to the first junction
    let prev = -1
    let at = leaf
    let hops = 0
    let length = 0
    while (adj[at].length <= 2 && hops < n) {
      const next = adj[at].find(([v]) => v !== prev)
      if (!next) break
      prev = at
      at = next[0]
      length += next[1]
      hops++
    }
    if (hops >= 2 && length >= 0.1 * PAGE) significant++
  }
  return clip((significant - 2) / 4)
}

function symmetryOf(ps: Pt[], mx: number, my: number): number {
  const W = ps.reduce((s, p) => s + p.w, 0) || 1
  const cell = 40
  const grid = new Map<string, number[]>()
  for (const [i, p] of ps.entries()) {
    const key = `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)}`
    grid.set(key, [...(grid.get(key) ?? []), i])
  }
  const near = (x: number, y: number, s: number) => {
    const tol = Math.max(0.03 * PAGE, 0.35 * s)
    const r = Math.ceil(tol / cell)
    const gx = Math.floor(x / cell)
    const gy = Math.floor(y / cell)
    for (let i = -r; i <= r; i++)
      for (let j = -r; j <= r; j++)
        for (const q of grid.get(`${gx + i},${gy + j}`) ?? []) {
          const p = ps[q]
          if (Math.hypot(p.x - x, p.y - y) <= tol && Math.max(p.s, s) <= 1.5 * Math.min(p.s, s)) return true
        }
    return false
  }
  const mirrors: ((p: Pt) => [number, number])[] = [
    (p) => [2 * mx - p.x, p.y],
    (p) => [p.x, 2 * my - p.y],
    (p) => [2 * mx - p.x, 2 * my - p.y],
  ]
  return Math.max(...mirrors.map((f) => ps.reduce((s, p) => s + (near(...f(p), p.s) ? p.w : 0), 0) / W))
}

function containmentOf(ps: Pt[]): number {
  if (ps.length < 2) return 0
  const order = ps.map((_, i) => i).sort((a, b) => ps[b].s - ps[a].s)
  let inside = 0
  let counted = 0
  for (const j of order.slice(1)) {
    counted++
    const q = ps[j]
    if (ps.some((p) => p.s >= 2 * q.s && Math.abs(q.x - p.x) <= 0.42 * p.s && Math.abs(q.y - p.y) <= 0.42 * p.s)) inside++
  }
  return counted ? inside / counted : 0
}

/** white inside the figure's own hull, on a coarse raster of the marks' ink boxes */
function porosityOf(ps: Pt[]): { porosity: number; coverage: number } {
  const N = 48
  const c = PAGE / N
  const occ = new Uint8Array(N * N)
  const corners: [number, number][] = []
  for (const p of ps) {
    const h = 0.36 * p.s
    const x0 = Math.max(0, Math.floor((p.x - h) / c))
    const x1 = Math.min(N - 1, Math.floor((p.x + h) / c))
    const y0 = Math.max(0, Math.floor((p.y - h) / c))
    const y1 = Math.min(N - 1, Math.floor((p.y + h) / c))
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) occ[j * N + i] = 1
    corners.push([p.x - h, p.y - h], [p.x + h, p.y - h], [p.x - h, p.y + h], [p.x + h, p.y + h])
  }
  const hull = convexHull(corners)
  if (hull.length < 3) return { porosity: 0, coverage: 0 }
  let inHull = 0
  let filled = 0
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      if (!insideHull(hull, (i + 0.5) * c, (j + 0.5) * c)) continue
      inHull++
      filled += occ[j * N + i]
    }
  return { porosity: inHull ? 1 - filled / inHull : 0, coverage: (inHull * c * c) / (PAGE * PAGE) }
}

function convexHull(pts: [number, number][]): [number, number][] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (p.length < 3) return p
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower: [number, number][] = []
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop()
    lower.push(q)
  }
  const upper: [number, number][] = []
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop()
    upper.push(q)
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

function insideHull(h: [number, number][], x: number, y: number): boolean {
  for (let i = 0; i < h.length; i++) {
    const [ax, ay] = h[i]
    const [bx, by] = h[(i + 1) % h.length]
    if ((bx - ax) * (y - ay) - (by - ay) * (x - ax) < 0) return false
  }
  return true
}

export function measureForm(marks: Mark[]): FormMeasure {
  const ps = points(marks)
  const profile = Object.fromEntries(AXES.map((k) => [k, 0])) as FormProfile
  if (!ps.length) return { profile, extra: { marks: 0, clusters: 0, coverage: 0, offset: 0 } }
  const m = moments(ps)
  profile.dispersion = clip(Math.sqrt(m.l1 + m.l2) / (0.5 * PAGE))
  const anisotropy = m.l1 > 0 ? 1 - m.l2 / m.l1 : 0

  // along the principal direction: the widest white between two masses, and the extent
  const proj = ps.map((p, i) => ({ t: (p.x - m.mx) * m.ux + (p.y - m.my) * m.uy, i })).sort((a, b) => a.t - b.t)
  const extent = proj.length ? proj[proj.length - 1].t - proj[0].t : 0
  let widest = 0
  let split = 0
  for (let i = 1; i < proj.length; i++) {
    const a = ps[proj[i - 1].i]
    const b = ps[proj[i].i]
    const g = proj[i].t - proj[i - 1].t - 0.36 * (a.s + b.s)
    if (g > widest) {
      widest = g
      split = i
    }
  }
  const left = proj.slice(0, split).reduce((s, q) => s + ps[q.i].w, 0)
  const right = m.W - left
  profile.axis = split ? clip(widest / (0.45 * PAGE)) * Math.sqrt((2 * Math.min(left, right)) / m.W) : 0

  const edges = mst(ps)
  const longest = edges.reduce((s, e) => Math.max(s, e[2]), 0)
  profile.linearity = ps.length >= 3 && extent > 0 ? anisotropy * clip(1 - longest / extent) * clip((ps.length - 2) / 4) : 0
  profile.branching = spanningBranches(ps, edges)

  // groups separated by white
  const nn = ps.map((p, i) => Math.min(...ps.map((q, j) => (i === j ? Infinity : gap(p, q)))))
  const medianGap = [...nn].sort((a, b) => a - b)[Math.floor(nn.length / 2)]
  const groups = clusters(ps, Math.max(0.05 * PAGE, 2 * (Number.isFinite(medianGap) ? medianGap : 0)))
  const significant = groups.filter((g) => g.reduce((s, i) => s + ps[i].w, 0) >= 0.03 * m.W)
  const partial = ps.reduce((s, p) => s + (p.partial ? p.w : 0), 0) / m.W
  profile.fragmentation = 0.5 * partial + 0.5 * clip((significant.length - 1) / 4)

  // rings, group by group: a page may hold two poles each with its own ring.
  // A group's outsized marks (a pole standing inside its ring) are left out of the fit.
  let rw = 0
  for (const g of significant) {
    const members = g.map((i) => ps[i])
    const sizes = members.map((p) => p.s).sort((a, b) => a - b)
    const median = sizes[Math.floor(sizes.length / 2)]
    const ringed = members.filter((p) => p.s <= 2 * median)
    const weight = ringed.reduce((s, p) => s + p.w, 0)
    const ring = ringOf(ringed)
    profile.curvature += weight * ring.curvature
    profile.closure += weight * ring.closure
    rw += weight
  }
  profile.curvature = rw ? profile.curvature / rw : 0
  profile.closure = rw ? profile.closure / rw : 0
  profile.radiality = radialOf(ps, m.mx, m.my)
  // a page of a few large characters carries its curve in the reading itself
  const reading = readingCurve(ps)
  profile.curvature = Math.max(profile.curvature, reading.curvature)
  profile.closure = Math.max(profile.closure, reading.closure)

  // spacing of the dominant population
  const sizes = ps.map((p) => p.s).sort((a, b) => a - b)
  const median = sizes[Math.floor(sizes.length / 2)]
  const body = ps.filter((p) => p.s >= median / 1.5 && p.s <= median * 1.5)
  if (body.length >= 5) {
    const d = body.map((p, i) => Math.min(...body.map((q, j) => (i === j ? Infinity : Math.hypot(p.x - q.x, p.y - q.y)))))
    const mean = d.reduce((s, v) => s + v, 0) / d.length
    const sd = Math.sqrt(d.reduce((s, v) => s + (v - mean) ** 2, 0) / d.length)
    profile.periodicity = clip(1 - sd / (mean || 1) / 0.6) * clip(body.length / 12)
  }

  const logs = ps.map((p) => Math.log(p.s))
  const lm = logs.reduce((s, v) => s + v, 0) / logs.length
  profile.hierarchy = clip(Math.sqrt(logs.reduce((s, v) => s + (v - lm) ** 2, 0) / logs.length) / Math.log(3))

  const cx = ps.reduce((s, p) => s + p.w * Math.cos(p.rot), 0)
  const sy = ps.reduce((s, p) => s + p.w * Math.sin(p.rot), 0)
  profile.rotation = clip(Math.hypot(cx, sy) / m.W)

  profile.symmetry = symmetryOf(ps, m.mx, m.my)
  profile.containment = containmentOf(ps)
  const hull = porosityOf(ps)
  profile.porosity = clip(hull.porosity)

  return {
    profile,
    extra: {
      marks: ps.length,
      clusters: significant.length,
      coverage: hull.coverage,
      offset: clip(Math.hypot(m.mx - PAGE / 2, m.my - PAGE / 2) / (0.5 * PAGE)),
    },
  }
}
