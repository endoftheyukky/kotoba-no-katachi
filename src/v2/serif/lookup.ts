/**
 * Runtime: serif-ink-1 as published, read for one title. Pure and deterministic: no browser, no canvas, no
 * measurement, no builder; the manifest and the shards the title reaches are handed in (observation/tables.ts
 * serifInkFor). A table that is not canonical (made anywhere but the canonical environment, or any check failed)
 * is refused here, not later.
 *
 * Three answers, each from the fixed data only:
 *   view         the serif's whole and direct components per character, as FieldGeometry reads a face (types/ink.ts)
 *   glyph        the serif glyph's v1 ink raster and density, as v1 relate / readRelations read a glyph
 *   writable     whether the serif writes a character with a glyph of its own (v1 poem/face.ts writable)
 */
import type { InkEntryView, InkView } from '../types/ink'
import type { SerifEntry, SerifEntryShard, SerifInkManifest, SerifRaster, SerifRasterShard, SerifWriting } from './table'

/** the shard a character lives in (code point mod count, as align-1) */
export const serifShardOf = (char: string, count: number): number => char.codePointAt(0)! % count

/** what v1 relate and readRelations read of a glyph (src/glyph/relation.ts: ink and density; nothing else) */
export interface SerifGlyph {
  density: number
  ink: { w: number; h: number; left: number; top: number; px: number; data: Uint8Array }
}

export interface SerifInkIndex {
  readonly manifest: SerifInkManifest
  /** the character's entry, or null when serif-ink-1 has none (outside the domain) */
  entry(char: string): SerifEntry | null
  /** the serif's ink as FieldGeometry reads a face */
  readonly view: InkView
  /** the serif glyph of one of the title's characters, or null when not observed (outside the domain, no glyph) */
  glyph(char: string): SerifGlyph | null
  /** v1 writable, from the fixed record: declared by the face, and not drawn empty where the reading face has ink */
  writable(char: string): boolean
}

/** refuse a manifest that is not a canonical serif-ink-1 */
export function checkManifest(m: unknown): asserts m is SerifInkManifest {
  const x = m as Partial<SerifInkManifest> | null
  if (!x || x.id !== 'serif-ink-1') throw new Error('serif-ink-1: not its manifest')
  if (x.schema !== 1) throw new Error(`serif-ink-1: schema ${String(x.schema)} is not 1`)
  if (x.canonical !== true) throw new Error('serif-ink-1: the table is not canonical (made off the canonical environment or a check failed): it is not read')
}

export function unpackBits(bits: string, n: number): Uint8Array {
  const bin = atob(bits)
  const out = new Uint8Array(n)
  for (let k = 0; k < n; k++) out[k] = (bin.charCodeAt(k >> 3) >> (7 - (k & 7))) & 1 ? 255 : 0
  return out
}

/**
 * An index over serif-ink-1. `entries` and `rasters` must be every shard in shard order (a shard not read for this
 * title answers every question with an error, as the other tables do); `writing` is the one writing record.
 */
export function serifInkIndex(manifest: unknown, entries: readonly SerifEntryShard[], rasters: readonly SerifRasterShard[], writing: SerifWriting): SerifInkIndex {
  checkManifest(manifest)
  const count = manifest.shards.count
  if (entries.length !== count || rasters.length !== count) throw new Error(`serif-ink-1: ${entries.length} and ${rasters.length} shards for ${count}`)
  const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)
  const entry = (char: string): SerifEntry | null => {
    if (!char || [...char].length !== 1) return null
    const s = entries[serifShardOf(char, count)]
    return own(s.entries, char) ? s.entries[char] : null
  }
  const glyphs = new Map<string, SerifGlyph | null>()
  const glyph = (char: string): SerifGlyph | null => {
    if (glyphs.has(char)) return glyphs.get(char)!
    const e = entry(char)
    let g: SerifGlyph | null = null
    if (e?.measure && e.raster) {
      const s = rasters[serifShardOf(char, count)]
      if (!own(s.entries, char)) throw new Error(`serif-ink-1: ${char} names a raster its shard does not hold`)
      const r: SerifRaster = s.entries[char]
      g = { density: e.measure.density, ink: { w: r.w, h: r.h, left: r.left, top: r.top, px: r.px, data: unpackBits(r.bits, r.w * r.h) } }
    }
    glyphs.set(char, g)
    return g
  }
  const unwritable = new Set(writing.unwritable)
  const declared = (cp: number) => {
    // ranges are sorted and disjoint: a binary search
    let lo = 0
    let hi = writing.ranges.length - 1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      const [a, b] = writing.ranges[mid]
      if (cp < a) hi = mid - 1
      else if (cp > b) lo = mid + 1
      else return true
    }
    return false
  }
  const writable = (char: string): boolean => {
    // blank space is always written (v1 glyph/coverage)
    if (!char.trim()) return true
    for (const c of char) {
      const cp = c.codePointAt(0)!
      // a variation selector or joiner rides on the character before it (v1 glyph/coverage)
      if (cp === 0x200d || (cp >= 0xfe00 && cp <= 0xfe0f)) continue
      if (!declared(cp) || unwritable.has(c)) return false
    }
    return true
  }
  const view: InkView = {
    entry: (char: string): InkEntryView | null => {
      const e = entry(char)
      return e ? { char: e.char, ...(e.whole ? { whole: { half: e.whole.half } } : {}), rows: e.rows } : null
    },
  }
  return { manifest, entry, view, glyph, writable }
}
