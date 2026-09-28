/**
 * Build time only: serif-ink-1's records from what the builder measured and fitted. Pure: the same fit and
 * rasters give the same records.
 *
 * What is kept is what B3a reads, and nothing else (the audit of 2026-09-27, docs in the serif-ink-1 NOTICE):
 *
 *   kept                                              read by
 *   measure.half, measure.density                     v1 readRelations (density gates) for the serif relation;
 *                                                     the page's ink box of a serif mark
 *   whole (as align-1's builder records it)           FieldGeometry: mapper (the derived / whole character's em
 *                                                     box), pitchOf (a unit's own ink extent)
 *   depth-1 leaf rows: path, index, node, parentOp,   FieldGeometry: differenceOf (addition: the base's box,
 *     status, because, transform, box, residual      transform and the delta), CrossRoads (the core's box),
 *     (share, box, centroid, pieces' centroids)       Separation (the parts' order)
 *   the same rows' ink (explained, precision, lift,   no run-time rule yet: telling a serif placement from a fit
 *     shared) and confidence                          that took a sibling's ink, once the canonical table exists
 *                                                     (the 辻 / 十 audit), without measuring again
 *   the ink raster (v1 measure, alpha > 127)          v1 relate, for the serif relation between two of the
 *                                                     title's characters (inter_containment, inter_similarity)
 *
 *   not kept                                          why
 *   nested rows (depth > 1), op rows                  FieldGeometry reads only a character's direct leaves
 *   islands, alike, crossings                         WholeEmerges and stroke units stay in the reading face
 *   unexplained, unexplainedInRegion, region, glyph   read by nothing (Discovery and Selection read align-1,
 *                                                     never the serif)
 *   residual.distribution / interleaved / pieces'      Discovery's reading of an interleaved delta is align-1's
 *     keep, share and side
 */
import type { AlignEntry, AlignRow, AlignStatus } from '../../align/table'
import type { EntryStatus } from '../../align/table'
import type { SerifEntry, SerifRaster, SerifRow } from '../table'

/** a measured glyph as the builder's page returns it (tools/v2/serif-ink/page.ts) */
export interface SerifMeasured {
  c: string
  covered: boolean
  half?: { w: number; h: number }
  density?: number
  ink?: SerifRaster
}

/** a direct leaf row of align-1's fit, as serif-ink-1 keeps it (null for any other row) */
export function projectRow(r: AlignRow): SerifRow | null {
  if (r.depth !== 1 || r.node.kind !== 'leaf') return null
  const row: SerifRow = {
    path: r.path,
    depth: 1,
    node: { kind: 'leaf', char: r.node.char, tier: r.node.tier },
    parentOp: r.parentOp,
    index: r.index,
    status: r.status,
    because: [...r.because],
  }
  if (r.transform) row.transform = { ...r.transform }
  if (r.box) row.box = { ...r.box }
  if (r.ink) row.ink = { ...r.ink }
  if (r.confidence !== undefined) row.confidence = r.confidence
  if (r.residual)
    row.residual = {
      share: r.residual.share,
      box: r.residual.box ? { ...r.residual.box } : null,
      centroid: r.residual.centroid ? { ...r.residual.centroid } : null,
      pieces: r.residual.pieces.map((p) => ({ centroid: { ...p.centroid } })),
    }
  return row
}

/** one entry of serif-ink-1: the fit (align-1's builder on the serif) projected, with the serif's own measure */
export function projectEntry(fit: AlignEntry, m: SerifMeasured | undefined, rasterSha: string | undefined): SerifEntry {
  const e: SerifEntry = { char: fit.char, status: fit.status, rows: fit.rows.map(projectRow).filter((r): r is SerifRow => r !== null) }
  if (m?.covered && m.half && m.density !== undefined) e.measure = { half: { ...m.half }, density: m.density }
  if (fit.whole) e.whole = { half: { ...fit.whole.half }, ink: fit.whole.ink }
  if (rasterSha) e.raster = rasterSha
  return e
}

/** the raster record of a measured glyph (null when the serif has no glyph for it or draws it empty) */
export function rasterOf(m: SerifMeasured | undefined): SerifRaster | null {
  if (!m?.covered || !m.ink || !m.ink.w || !m.ink.h) return null
  const { w, h, left, top, px, bits } = m.ink
  return { w, h, left, top, px, bits }
}

export function countStatus(entries: Iterable<SerifEntry>) {
  const status: Record<EntryStatus, number> = { fitted: 0, atomic: 0, 'no-structure': 0, 'whole-not-in-face': 0 }
  const rows: Record<AlignStatus, number> = { aligned: 0, approximate: 0, unavailable: 0 }
  for (const e of entries) {
    status[e.status]++
    for (const r of e.rows) rows[r.status]++
  }
  return { status, rows }
}

/** merge sorted code points into [first, last] ranges */
export function rangesOf(codePoints: Iterable<number>): [number, number][] {
  const cps = [...new Set(codePoints)].sort((a, b) => a - b)
  const out: [number, number][] = []
  for (const c of cps) {
    const last = out[out.length - 1]
    if (last && c === last[1] + 1) last[1] = c
    else out.push([c, c])
  }
  return out
}

/** the code points a face's CSS declares (its @font-face unicode-range descriptors), as v1 glyph/coverage parses them */
export function declared(css: string): number[] {
  const out = new Set<number>()
  for (const m of css.matchAll(/unicode-range:\s*([^;]+);/g))
    for (const part of m[1].split(',')) {
      const s = part.trim().replace(/^U\+/i, '')
      if (!s) continue
      const [a, b] = s.includes('?') ? [s.replace(/\?/g, '0'), s.replace(/\?/g, 'F')] : s.split('-')
      const lo = parseInt(a, 16)
      const hi = parseInt(b ?? a, 16)
      for (let c = lo; c <= hi; c++) out.add(c)
    }
  return [...out].sort((x, y) => x - y)
}
