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
import { RELATION_THRESHOLD } from '../../glyph/relation'
import { isRelationWord } from '../salience'
import type { Mark } from '../types'
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
