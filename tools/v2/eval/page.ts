// Development only (tools/v2/eval.mjs): compose v2 pages in the browser — the reading face measured by v1,
// the relations between a title's own glyphs read by v1 — draw them with v1's renderer, check them with v1's
// invariants, and lay a contact sheet of them with what decided each. Never part of the site.
import '../../../src/glyph/font-face'
import { covers } from '../../../src/glyph/coverage'
import { readRelations } from '../../../src/glyph/relation'
import { GlyphLibrary } from '../../../src/glyph/source'
import { parseTable } from '../../../src/language/semantic/axes'
import { analyze } from '../../../src/poem/compose'
import { soundness } from '../../../src/poem/invariants'
import { renderCanvas } from '../../../src/render/png'
import { normalizeTitle } from '../../../src/title'
import { alignIndex } from '../../../src/v2/align/lookup'
import type { AlignManifest, AlignShard } from '../../../src/v2/align/table'
import { composeV2, type V2Tables } from '../../../src/v2/compose'
import { resonanceIndex, type ResonanceManifest, type ResonanceShard } from '../../../src/v2/resonance'
import { structureIndex } from '../../../src/v2/structure/lookup'
import type { StructureManifest, StructureShard } from '../../../src/v2/structure/table'

const lib = new GlyphLibrary()

async function json<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url}: ${r.status}`)
  return (await r.json()) as T
}

let tables: V2Tables | null = null
async function load(): Promise<V2Tables> {
  if (tables) return tables
  const sm = await json<StructureManifest>('/v2/structure-1/manifest.json')
  const am = await json<AlignManifest>('/v2/align-1/manifest.json')
  const rm = await json<ResonanceManifest>('/v2/resonance-1/manifest.json')
  const ss = await Promise.all(sm.shards.files.map((f) => json<StructureShard>(`/v2/structure-1/${f.name}`)))
  const as = await Promise.all(am.shards.files.map((f) => json<AlignShard>(`/v2/align-1/${f.name}`)))
  const rs = await Promise.all(rm.shards.files.map((f) => json<ResonanceShard>(`/v2/resonance-1/${f.name}`)))
  const ax = await Promise.all(Array.from({ length: 64 }, (_, i) => fetch(`/semantic/axes-1/${String(i).padStart(2, '0')}.tsv`).then((r) => r.text())))
  tables = {
    structure: structureIndex(sm, ss),
    align: alignIndex(am, as),
    resonance: resonanceIndex(rm, rs),
    axes: parseTable('axes-1', ax.join('\n')),
    data: { 'structure-1': { id: 'structure-1', sha256: sm.sha256 }, 'align-1': { id: 'align-1', sha256: am.sha256 }, 'resonance-1': { id: 'resonance-1', sha256: rm.sha256 }, 'axes-1': { id: 'axes-1', sha256: 'v1' } },
  }
  return tables
}

async function one(text: string, reading: string | undefined, px: number) {
  const t = await load()
  const input = normalizeTitle({ text, reading })
  if (typeof input === 'string') return { text, error: input }
  const chars = [...new Set([...input.text].filter((c) => c.trim() && covers('sans', c)))]
  await lib.prepare(chars)
  const glyphs = new Map(chars.map((c) => [c, lib.get(c).metrics]))
  const relations = glyphs.size > 1 ? readRelations(glyphs) : []
  const comp = composeV2(input, relations, t)
  const need = [...new Set(comp.draft.marks.map((m) => m.char).filter((c) => covers('sans', c)))]
  await lib.prepare(need)
  const canvas = renderCanvas(comp.draft, lib, px)
  const a = await analyze(input)
  const plan = comp.rationale.plan
  // v1's inkHit samples a derived mark's em box round its point; a stroke unit is a glyph at the whole's size cut
  // to one island (keep), so it is checked as the mark its kept ink is: that box, at its centre (v1 unchanged)
  const checked = comp.draft.marks.map((m) => {
    if (!m.keep?.length || !m.derived) return m
    const k = m.size / 100
    const xs = m.keep.flatMap((r) => [r.x + (m.shift?.x ?? 0), r.x + r.w + (m.shift?.x ?? 0)])
    const ys = m.keep.flatMap((r) => [r.y + (m.shift?.y ?? 0), r.y + r.h + (m.shift?.y ?? 0)])
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2
    const { keep: _k, shift: _s, ...rest } = m
    return { ...rest, x: m.x + cx * k, y: m.y + cy * k, size: Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * k }
  })
  const inv = soundness(a, checked, { repetition: plan !== 'Sequence' && plan !== 'Absent', absent: [] })
  const g = comp.trace.geometry
  return {
    collide: collisions(comp.draft.marks, t),
    text, reading: reading ?? '',
    primary: comp.rationale.selection.primary,
    primaryType: comp.trace.primary?.type ?? null,
    discoveries: comp.trace.discoveries,
    constraints: comp.rationale.constraints.map((c) => c.kind),
    evidence: comp.rationale.resonance.map((e) => `${e.type} ${e.distance}`),
    plan,
    plans: comp.rationale.plans.map((p) => p.rule),
    geometry: { name: g.name, count: g.count, cols: g.cols, rows: g.rows, unitSize: g.unitSize, visibility: g.visibility ?? null, extent: g.extent, whitespace: g.whitespace.length, unmotivated: g.unmotivated },
    marks: comp.draft.marks.length,
    invariants: { lost: inv.lost, overlaps: inv.overlaps, inkHits: inv.inkHits, infinite: inv.infinite },
    draft: comp.draft,
    png: canvas.toDataURL('image/png'),
  }
}

/**
 * Marks whose ink boxes cover each other (any roles; v1's overlap skips pairs of very different sizes and
 * inkHit only derived-on-title). The box: the glyph's ink half (align-1), or a keep's rects; a pair counts
 * when they share more than a tenth of the smaller box.
 */
function collisions(marks: readonly import('../../../src/poem/types').Mark[], t: V2Tables): number {
  const boxes = marks.map((m) => {
    if (m.keep?.length) {
      const k = m.size / 100
      const sx = m.shift?.x ?? 0
      const sy = m.shift?.y ?? 0
      const xs = m.keep.flatMap((r) => [r.x + sx, r.x + r.w + sx])
      const ys = m.keep.flatMap((r) => [r.y + sy, r.y + r.h + sy])
      return { x0: m.x + Math.min(...xs) * k, x1: m.x + Math.max(...xs) * k, y0: m.y + Math.min(...ys) * k, y1: m.y + Math.max(...ys) * k }
    }
    const h = t.align.entry(m.char)?.whole?.half ?? { w: 45, h: 45 }
    return { x0: m.x - (h.w / 100) * m.size, x1: m.x + (h.w / 100) * m.size, y0: m.y - (h.h / 100) * m.size, y1: m.y + (h.h / 100) * m.size }
  })
  let n = 0
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]
      const b = boxes[j]
      const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)
      const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)
      if (w <= 0 || h <= 0) continue
      const area = (r: typeof a) => (r.x1 - r.x0) * (r.y1 - r.y0)
      if (w * h > 0.1 * Math.min(area(a), area(b))) n++
    }
  return n
}

type Result = Awaited<ReturnType<typeof one>>

/** a contact sheet: each page with what decided it */
async function sheet(results: Result[], cols: number, cell: number): Promise<string> {
  const pad = 8
  const cap = 64
  const rows = Math.ceil(results.length / cols)
  const cv = document.createElement('canvas')
  cv.width = cols * (cell + pad) + pad
  cv.height = rows * (cell + cap + pad) + pad
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = '#e8e6e1'
  ctx.fillRect(0, 0, cv.width, cv.height)
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    const x = pad + (i % cols) * (cell + pad)
    const y = pad + Math.floor(i / cols) * (cell + cap + pad)
    if ('png' in r && r.png) {
      const img = new Image()
      img.src = r.png
      await img.decode()
      ctx.drawImage(img, x, y, cell, cell)
    }
    ctx.fillStyle = '#222'
    ctx.font = '13px sans-serif'
    const lines = 'error' in r && r.error ? [r.text, r.error] : [
      `${(r as Exclude<Result, { error: string }>).text}  ${(r as Exclude<Result, { error: string }>).plan}`,
      `${(r as Exclude<Result, { error: string }>).primaryType ?? 'no primary'} · ${(r as Exclude<Result, { error: string }>).constraints.length} constraints · ${(r as Exclude<Result, { error: string }>).marks} marks`,
      `${(r as Exclude<Result, { error: string }>).geometry.name}${(r as Exclude<Result, { error: string }>).geometry.visibility ? ' · ' + (r as Exclude<Result, { error: string }>).geometry.visibility : ''}`,
      (() => { const v = (r as Exclude<Result, { error: string }>).invariants; return `lost ${v.lost} overlap ${v.overlaps} inkHit ${v.inkHits} collide ${(r as Exclude<Result, { error: string }>).collide} ${(r as Exclude<Result, { error: string }>).evidence.join(', ')}` })(),
    ]
    lines.forEach((l, j) => ctx.fillText(l.slice(0, 60), x + 2, y + cell + 15 + j * 15))
  }
  return cv.toDataURL('image/png')
}

async function run(titles: { text: string; reading?: string }[], px = 600) {
  const out: Result[] = []
  for (const t of titles) {
    try {
      out.push(await one(t.text, t.reading, px))
    } catch (e) {
      out.push({ text: t.text, error: String(e) } as Result)
    }
  }
  return out
}

Object.assign(window, { v2eval: { run, sheet } })
document.body.dataset.state = 'ready'
