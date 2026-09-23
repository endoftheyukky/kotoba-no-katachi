/**
 * Which characters the bundled faces actually have.
 *
 * A character the faces do not have would be measured and drawn in whatever
 * font the reader's system falls back to — a different letterform on every
 * device, and so a different reading and a different page for the same title.
 * The work reads one set of letterforms; a character outside them cannot be
 * read, and is refused rather than guessed.
 *
 * Coverage is taken from the unicode ranges the bundled @font-face rules
 * declare, not from a rendering (a rendering would succeed in the fallback).
 */
import { FACES, type Face } from './font'

type Range = [number, number]
const cache = new Map<Face, Range[]>()

function parse(unicodeRange: string): Range[] {
  return unicodeRange
    .split(',')
    .map((s) => s.trim().replace(/^U\+/i, ''))
    .filter(Boolean)
    .map((s): Range => {
      if (s.includes('?')) return [parseInt(s.replace(/\?/g, '0'), 16), parseInt(s.replace(/\?/g, 'F'), 16)]
      const [a, b] = s.split('-')
      return [parseInt(a, 16), parseInt(b ?? a, 16)]
    })
}

function rangesOf(face: Face): Range[] {
  const had = cache.get(face)
  if (had) return had
  const name = FACES[face].name
  const out: Range[] = []
  for (const f of document.fonts)
    if (f.family.replace(/["']/g, '') === name && String(f.weight) === String(FACES[face].weight)) out.push(...parse(f.unicodeRange))
  if (out.length) cache.set(face, out)
  return out
}

/** whether the face has this character; blank space always counts */
export function covers(face: Face, char: string): boolean {
  if (!char.trim()) return true
  const ranges = rangesOf(face)
  // no declared faces at all (a test page without the font CSS): do not refuse
  if (!ranges.length) return true
  for (const c of char) {
    const cp = c.codePointAt(0)!
    // a variation selector or joiner rides on the character before it
    if (cp === 0x200d || (cp >= 0xfe00 && cp <= 0xfe0f)) continue
    if (!ranges.some(([lo, hi]) => cp >= lo && cp <= hi)) return false
  }
  return true
}

/** the characters of a title the reading face does not have, once each */
export function uncovered(text: string): string[] {
  return [...new Set(Array.from(text).filter((c) => !covers('sans', c)))]
}
