/**
 * What small marks are written in (v2).
 *
 * A field of grains or a form drawn in small marks needs a character to be
 * made of. It is never chosen for its meaning. It is taken, in this order,
 * from a structure the analysis already read:
 *
 *   1. a repetition the title makes of its content (a particle said twice is
 *      grammar, not repetition)
 *   2. a form the reading found inside the character itself: one of its own
 *      parts read as a character (森's 木), or a character the title writes
 *      found inside it above the reading's threshold (中 inside 雨)
 *   3. the rest of the title, in the order it is read — only when it holds
 *      some content, not particles alone; failing that, what the poem erased
 *   4. the character itself
 *
 * Nothing here invents a character the title and its letterforms do not
 * already hold.
 */
import { readPart } from '../../glyph/legibility'
import { islands, type GlyphPart } from '../../glyph/parts'
import { RELATION_THRESHOLD } from '../../glyph/relation'
import { RELATION_TITLE, relatedTo, type SemanticItem } from '../../language/lexicon'
import { structuralParts } from '../operations/decomposition'
import { contentGraphemes, isRelationWord } from '../salience'
import type { Mark, Provenance } from '../types'
import type { PageView } from './page'

export interface Material {
  /** the characters, in the order they are to be written */
  chars: string[]
  /** the grapheme each comes from, where it comes from one */
  from: (number | undefined)[]
  kind: 'repeat' | 'form' | 'rest' | 'self'
  note: string
}

/** a form the reading found inside this character, strong enough and written in the title */
export function formInside(v: PageView, char: string): Material | null {
  const units = v.m.tokens.flat()
  const found = v.a.glyphRelations
    .filter((r) => r.kind === 'containment' && r.outer === char && r.inner !== char && r.score >= RELATION_THRESHOLD)
    .map((r) => ({ r, u: units.find((u) => u.char === r.inner) }))
    .find(({ u }) => u)
  if (!found) return null
  return { chars: [found.r.inner], from: [found.u!.grapheme], kind: 'form', note: `「${char}」の中に読まれた「${found.r.inner}」` }
}

export function materialOf(v: PageView, form: Mark[]): Material {
  const { a, m } = v
  const f = m.primary.focus
  const at = (g: number) => a.graphemes[g]?.char ?? ''
  const absent = (g: number) => m.tokens.flat().some((u) => u.grapheme === g && u.absent)

  // 1. a repetition of the title's content
  let unit: number[] | undefined
  if (f.kind === 'repetition') unit = f.occurrences[0]
  else
    for (const r of a.relations) {
      if (r.kind === 'reduplication') unit = r.occurrences[0]
      else if (r.kind === 'recurrence' && r.unit === 'grapheme' && !isRelationWord(a, r.members[0])) unit = r.members.slice(0, 1)
      if (unit) break
    }
  if (unit?.length && unit.some((g) => !isRelationWord(a, g))) {
    const chars = unit.map(at).filter((c) => c.trim())
    if (chars.length) return { chars, from: unit, kind: 'repeat', note: `題が繰り返す「${chars.join('')}」` }
  }

  // 2. a form read inside the character: one of its own parts read as a
  // character (intrinsic, 森's 木), or a character the title writes found
  // inside it above the reading's threshold (中 inside 雨)
  if (f.kind === 'parts' && form.some((k) => k.grapheme === f.grapheme)) {
    const read = f.readings.find((r) => r?.kind === 'character')
    if (read) return { chars: [read.char], from: [f.grapheme], kind: 'form', note: `「${at(f.grapheme)}」の部品に読まれた「${read.char}」` }
  }
  if (f.kind === 'pair' && f.relation.kind === 'containment' && f.relation.score >= RELATION_THRESHOLD) {
    const u = m.tokens.flat().find((x) => x.char === f.relation.inner)
    if (u) return { chars: [f.relation.inner], from: [u.grapheme], kind: 'form', note: `「${f.relation.outer}」の中に読まれた「${f.relation.inner}」` }
  }
  for (const k of form) {
    const inside = formInside(v, k.char)
    if (inside) return inside
  }

  // 3. the rest of the title, in reading order, if it holds any content
  const taken = new Set(form.map((k) => k.grapheme).filter((g): g is number => g !== undefined))
  const rest = a.graphemes.filter((g) => g.char.trim() && !taken.has(g.index) && g.script !== 'symbol' && !absent(g.index))
  if (rest.some((g) => !isRelationWord(a, g.index)))
    return { chars: rest.map((g) => g.char), from: rest.map((g) => g.index), kind: 'rest', note: `題の残り「${rest.map((g) => g.char).join('')}」` }
  // what the poem erased is still the title's own material
  const erased = a.graphemes.filter((g) => g.char.trim() && !taken.has(g.index) && absent(g.index))
  if (erased.length) return { chars: erased.map((g) => g.char), from: erased.map((g) => g.index), kind: 'rest', note: `消された「${erased.map((g) => g.char).join('')}」` }

  // 4. the character itself
  const self = form[0]
  return { chars: [self?.char ?? at(0)], from: [self?.grapheme], kind: 'self', note: `「${self?.char ?? at(0)}」そのもの` }
}

// ---------------------------------------------------------------------------
// strands: material from three distances (v2, second stage)
//
// A grammar that places more than one kind of material keeps them apart by
// where they come from, and that is also how far they are from the title:
//
//   structure  what the title's writing holds: a repetition, a form read in
//              a character, the rest of the title (the material above)
//   sound      the title's reading, reduced to its vowels: what is left of
//              the words when their consonants are taken away
//   meaning    characters a lexicon relates to the title's own (review only:
//              at most three, never the nucleus or the body, always with the
//              relation they were read by)

export interface Strand {
  layer: 'structure' | 'sound' | 'meaning'
  chars: string[]
  from: (number | undefined)[]
  kind: Provenance['kind']
  note: string
  /** for meaning: the statement of the lexicon each character was read from */
  source?: string[]
  /** for meaning: the items themselves */
  items?: SemanticItem[]
}

const VOWEL: Record<string, string> = { a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お' }

/**
 * The parts of a character where the font already separates it, each with
 * what it reads as. `islands`: only its separate islands of ink, never a cut
 * the computer makes along a seam.
 */
export function partsRead(v: PageView, grapheme: number, only: 'islands' | 'structural' = 'structural'): { part: GlyphPart; char: string | null }[] {
  const g = v.a.graphemes[grapheme]
  if (!g?.char.trim()) return []
  let m
  try {
    m = v.a.glyphs.get(g.char).metrics
  } catch {
    return []
  }
  const parts = only === 'islands' ? islands(m).slice(0, 6) : structuralParts(v.a, grapheme)
  if (parts.length < 2) return []
  return parts.map((part) => {
    const r = readPart(part, m, v.a.readables, g.char)
    return { part, char: r?.kind === 'character' ? r.char : null }
  })
}

export function structureOf(v: PageView, form: Mark[]): Strand {
  const mat = materialOf(v, form)
  return { layer: 'structure', chars: mat.chars, from: mat.from, kind: mat.kind === 'self' ? 'repeat' : mat.kind, note: mat.note }
}

/**
 * The reading reduced to its vowels, one per beat that is read (a moraic
 * nasal stays ん, a held silence is left out). Only where at least two beats
 * are read and one of them belongs to a word that is not a particle: a
 * title whose only sound is its particles has no sound of its own to give.
 */
export function soundOf(v: PageView): Strand | null {
  const read = v.a.morae.filter((mo) => mo.kind === 'cv' || mo.kind === 'N' || mo.kind === 'R')
  if (read.length < 2) return null
  if (read.every((mo) => mo.graphemes.every((g) => isRelationWord(v.a, g)))) return null
  const chars = read.map((mo) => (mo.kind === 'N' ? 'ん' : VOWEL[mo.vowel ?? ''] ?? '')).filter(Boolean)
  if (chars.length < 2) return null
  return {
    layer: 'sound',
    chars,
    from: read.map((mo) => mo.graphemes[0]),
    kind: 'sound',
    note: `読み「${read.map((mo) => mo.text).join('')}」の母音「${chars.join('')}」`,
  }
}

/**
 * Characters the lexicon relates to the title's content characters, the
 * nucleus first and then the rest in reading order. Only when a review asks
 * for it; never one the title writes, never one the structure already gives.
 */
export function meaningOf(v: PageView, heads: Mark[], taken: Set<string>): Strand | null {
  if (!v.semantic) return null
  const content = new Set(contentGraphemes(v.a).map((g) => g.index))
  const ordered = [...heads, ...v.body.filter((k) => !heads.includes(k))]
    .filter((k) => k.grapheme !== undefined && content.has(k.grapheme))
    .map((k) => ({ char: k.char, grapheme: k.grapheme! }))
  const written = new Set(v.a.graphemes.map((g) => g.char))
  const items = relatedTo(ordered, written, taken)
  if (!items.length) return null
  return {
    layer: 'meaning',
    chars: items.map((i) => i.char),
    from: items.map((i) => i.from),
    kind: 'semantic',
    note: items.map((i) => `「${i.head}」の${RELATION_TITLE[i.relation]}「${i.char}」`).join('、'),
    source: items.map((i) => i.source),
    items,
  }
}

/** every strand this page has, nearest first */
export function strandsOf(v: PageView, form: Mark[]): Strand[] {
  const structure = structureOf(v, form)
  const sound = soundOf(v)
  const meaning = meaningOf(v, form, new Set([...structure.chars, ...(sound?.chars ?? [])]))
  return [structure, ...(sound ? [sound] : []), ...(meaning ? [meaning] : [])]
}
