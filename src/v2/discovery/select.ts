/**
 * Discovery Selection (spec-1 §4): each type's own gates (§4.1), the demotion
 * of a pictograph's graphic decomposition (§4.2), a fixed order of types and a
 * canonical tie-break (§4.3). No score: a candidate passes its gates or names
 * the gates it failed. Nothing passing is a result (primary null), never a
 * reason to make one up.
 *
 * align-1's geometry enters only through gates that read ink, and only when
 * the placement they read is aligned: an approximate or unavailable placement
 * fails the ink gate (the reading is not observed), and never denies that the
 * component is there.
 */
import { RELATION_THRESHOLD } from '../../glyph/relation'
import { CONSTANTS, TYPE_ORDER } from '../spec'
import { homogeneous } from '../structure/view'
import type { Discovery, DiscoveryId } from '../types/discovery'
import type { SemanticEvidence } from '../types/resonance'
import type { GateName, Selection } from '../types/selection'
import type { DiscoveryInput } from './input'

const DELTA_TIERS = new Set(['variant', 'stroke', 'unknown'])
const LOCAL_SIDES = new Set(['left', 'right', 'top', 'bottom', 'interleaved'])

/** the characters a Discovery names, apart from the title's own character it lies in */
export function termsOf(d: Discovery): string[] {
  switch (d.type) {
    case 'internal_repetition': return [d.unit.char, d.whole.char, ...(d.remainder ? [d.remainder.char] : [])]
    case 'addition': return [d.base.char, ...d.delta.map((x) => x.char)]
    case 'composition': return d.parts.map((p) => p.char)
    case 'enclosure': return [d.container.char, d.contained.char]
    case 'partial_enclosure': return [d.wrapper.char, d.core.char]
    case 'intersection': return [d.within, ...d.strokes.map((s) => s.char)]
    case 'nested': return [d.term]
    case 'inter_containment':
    case 'inter_similarity': return [d.inner.char, d.outer.char]
    default: return []
  }
}

/** which gates of §4.1 a candidate fails (empty: it may be the primary) */
export function gates(d: Discovery, input: DiscoveryInput): GateName[] {
  const failed: GateName[] = []
  const fail = (ok: boolean, g: GateName) => { if (!ok) failed.push(g) }
  const own = (g: number) => input.language.graphemes[g]?.char
  const lookup = (c: string) => input.structure.lookup(c)
  switch (d.type) {
    case 'internal_repetition': {
      // a component's own repetition (淋's 林) is nested: never the primary
      if (d.whole.char !== own(d.graphemes[0])) return ['type:not-primary-capable']
      const alike = input.align.entry(d.whole.char)?.ink?.alike.some((a) => a.members.length === d.n) ?? false
      const through = d.evidence.some((e) => e.id.endsWith(':through'))
      if (d.unitTier === 'character') {
        fail(d.unit.tier === 'character', 'repetition:unit-is-character')
        // the whole is the units, or the units and exactly one leaf beside them (a variant or a character)
        const s = lookup(d.whole.char)
        const tree = s.status === 'found' ? s.structure.tree : null
        const whole = tree ? homogeneous(tree, lookup) : null
        let lessOne = false
        if (tree?.kind === 'op' && d.remainder && (d.remainder.tier === 'variant' || d.remainder.tier === 'character')) {
          const rest = tree.children.filter((c) => !(c.kind === 'leaf' && c.char === d.remainder!.char))
          const hs = rest.map((c) => homogeneous(c, lookup))
          lessOne = rest.length === tree.children.length - 1 && hs.every((h) => h && h.unit === d.unit.char) && hs.reduce((n, h) => n + h!.n, 0) === d.n
        }
        fail(!!(whole && whole.n === d.n && whole.unit === d.unit.char) || lessOne, 'repetition:homogeneous')
        fail(alike, 'repetition:ink-alike-count')
      } else {
        fail(!through, 'repetition:stroke-explicit-subtree')
        fail(d.n >= CONSTANTS.STROKE_REPETITION_MIN.value, 'repetition:stroke-min-count')
        fail(d.arrangement === '2x2' || d.arrangement === 'row' || d.arrangement === 'stack', 'repetition:stroke-regular')
        fail(alike, 'repetition:ink-alike-count')
      }
      break
    }
    case 'addition': {
      fail(d.base.tier === 'character', 'addition:one-character-base')
      fail(d.delta.every((t) => DELTA_TIERS.has(t.tier)), 'addition:delta-tier')
      const sameUnit = d.delta.some((t) => {
        if (t.char === d.base.char) return true
        const s = lookup(t.char)
        const h = s.status === 'found' ? homogeneous(s.structure.tree, lookup) : null
        return !!h && h.unit === d.base.char
      })
      fail(!sameUnit, 'addition:delta-not-same-unit')
      // ink: only an aligned placement of the base is read (approximate: not observed)
      const s = lookup(d.derived.char)
      const e = input.align.entry(d.derived.char)
      const baseRow = e?.rows.find((r) => r.depth === 1 && r.node.kind === 'leaf' && r.node.char === d.base.char)
      const aligned = baseRow?.status === 'aligned' && !!baseRow.box && !!baseRow.residual
      fail(aligned && d.ink.baseScale >= CONSTANTS.ADDITION_MIN_BASE_SCALE.value, 'addition:base-scale')
      fail(aligned && d.ink.baseAspect <= CONSTANTS.ADDITION_MAX_BASE_ASPECT.value, 'addition:base-aspect')
      fail(aligned && d.ink.deltaShare <= CONSTANTS.ADDITION_MAX_DELTA_SHARE.value, 'addition:delta-share')
      fail(aligned && d.ink.deltaPieces >= 1 && d.ink.deltaPieces <= CONSTANTS.ADDITION_MAX_DELTA_PIECES.value, 'addition:delta-pieces')
      // the side the IDS gives, and the residual's centroid, agree: beyond the base's centre on that
      // side (⿰ ⿱), or inside the base's box (⿻, interleaved); a wrapping delta has no side
      let agrees = false
      if (aligned && LOCAL_SIDES.has(d.side) && s.status === 'found') {
        const b = baseRow!.box!
        const c = d.ink.residueCentroid
        const cx = b.x + b.w / 2
        const cy = b.y + b.h / 2
        agrees =
          d.side === 'left' ? c.x < cx
          : d.side === 'right' ? c.x > cx
          : d.side === 'top' ? c.y < cy
          : d.side === 'bottom' ? c.y > cy
          : c.x >= b.x && c.x <= b.x + b.w && c.y >= b.y && c.y <= b.y + b.h
      }
      fail(agrees, 'addition:side-agrees')
      break
    }
    case 'enclosure':
      fail(d.contained.tier === 'character', 'enclosure:contained-is-character')
      fail(d.container.tier === 'character', 'enclosure:container-writable')
      break
    case 'partial_enclosure':
      fail(d.wrapper.tier === 'variant', 'partial-enclosure:wrapper-is-variant')
      fail(d.core.tier === 'character', 'partial-enclosure:core-is-character')
      break
    case 'composition':
      fail(d.parts.every((p) => p.tier === 'character') && new Set(d.parts.map((p) => p.char)).size >= 2, 'composition:distinct-characters')
      break
    case 'intersection':
      // a component's crossing (辻 → 十) is nested: never the primary
      if (d.within !== own(d.graphemes[0])) return ['type:not-primary-capable']
      fail(d.strokes.every((s) => s.tier === 'stroke'), 'intersection:two-strokes')
      break
    case 'inter_containment':
    case 'inter_similarity': {
      const written = new Set(input.language.graphemes.map((g) => g.char))
      fail(written.has(d.inner.char) && written.has(d.outer.char), 'inter:both-written')
      fail(d.relation.score >= RELATION_THRESHOLD, 'inter:relation-threshold')
      if (d.type === 'inter_containment') {
        // a containment is read as an addition between two written characters (Stage 6): the outer is the inner
        // and a residue. Structure is the truth of what exists: where the outer's structure is decomposed and
        // never names the inner, the ink's reading is not a component (§2.1: ink does not decide a component)
        fail(structureOf(d.outer.char, d.inner.char, input) !== 'denies', 'inter:structure-names-inner')
        // the residue is the addition's delta, read from ink: the addition's own ink gates (§4.1, appendix A)
        const pieces = d.relation.residue.pieces.length
        fail(d.relation.residue.share <= CONSTANTS.ADDITION_MAX_DELTA_SHARE.value, 'inter:delta-share')
        fail(pieces >= 1 && pieces <= CONSTANTS.ADDITION_MAX_DELTA_PIECES.value, 'inter:delta-pieces')
      }
      break
    }
    default:
      return ['type:not-primary-capable']
  }
  return failed
}

/** code point order (not UTF-16 unit order: 𤣩 after 龜) */
function byCodePoint(a: string, b: string): number {
  const x = [...a]
  const y = [...b]
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const d = x[i].codePointAt(0)! - y[i].codePointAt(0)!
    if (d) return d
  }
  return x.length - y.length
}

/**
 * What the outer's structure says of the inner (Stage 11): `names` — the inner is a component of it, followed
 * down (天 → 大 → 人) with another region's name for an unencoded component (州: 川) and a written-as form
 * (囗 as 口); `denies` — the structure is decomposed, fully encoded, and never names it (東 = 木 日: no 天);
 * `silent` — no structure to ask (a kana, a letter, a digit, a character outside structure-1), an atomic one
 * (三), or an unencoded component nothing names. Only `denies` stops a relation: silence is not a denial.
 */
export function structureOf(outer: string, inner: string, input: DiscoveryInput): 'names' | 'denies' | 'silent' {
  const top = input.structure.lookup(outer)
  if (top.status !== 'found' || top.structure.tree.kind === 'leaf') return 'silent'
  const written = new Set(input.structure.manifest.forms.filter((f) => f.kind === 'written-as' && f.chars.includes(inner)).map((f) => f.form))
  const seen = new Set<string>([outer])
  let unknown = false
  const walk = (c: string, depth: number): boolean => {
    const r = input.structure.lookup(c)
    if (r.status !== 'found') return false
    // another region's name for an unencoded component: its characters (not its operators, U+2FF0–2FFF)
    const named = r.entry.supplements.flatMap((s) => [...s.named].filter((ch) => ch.codePointAt(0)! < 0x2ff0 || ch.codePointAt(0)! > 0x2fff))
    const supplied = new Set(r.entry.supplements.map((s) => s.unknown))
    const leaves: string[] = []
    const collect = (n: typeof r.structure.tree): void => {
      if (n.kind === 'op') n.children.forEach(collect)
      else if (n.tier === 'unknown') { if (!supplied.has(n.char)) unknown = true }
      else leaves.push(n.char)
    }
    collect(r.structure.tree)
    for (const l of [...leaves, ...named]) {
      if (l === inner || written.has(l)) return true
      if (seen.has(l) || depth >= 8 || [...l].length !== 1) continue
      seen.add(l)
      if (walk(l, depth + 1)) return true
    }
    return false
  }
  if (walk(outer, 0)) return 'names'
  return unknown ? 'silent' : 'denies'
}

/** why nothing was found at all: a structure with no relation, or no structure to read (never the same thing) */
function noCandidate(input: DiscoveryInput): string {
  const unread = [...new Set(input.language.graphemes.map((g) => g.char).filter((c) => c.trim() && input.structure.lookup(c).status !== 'found'))]
  const base = 'no candidate: the structure offers no relation of a known type'
  return unread.length ? `${base}; structure-1 has no structure for ${unread.join(' ')}` : base
}

/** the Discoveries F demotes: from the decomposition of a character its origin names a pictograph (§4.2) */
function demotedBy(d: Discovery, evidence: readonly SemanticEvidence[], input: DiscoveryInput): boolean {
  if (d.type !== 'enclosure' && d.type !== 'composition' && d.type !== 'intersection') return false
  const c = input.language.graphemes[d.graphemes[0]]?.char
  return evidence.some((e) => e.type === 'origin' && e.char === c && e.formation === 'pictograph')
}

export function select(discoveries: readonly Discovery[], input: DiscoveryInput, evidence: readonly SemanticEvidence[] = []): Selection {
  const order = (a: Discovery, b: Discovery) => {
    const ta = (TYPE_ORDER as readonly string[]).indexOf(a.type)
    const tb = (TYPE_ORDER as readonly string[]).indexOf(b.type)
    return ta - tb || a.graphemes[0] - b.graphemes[0] || byCodePoint(a.id, b.id)
  }
  const judged = discoveries.map((d) => ({ d, failed: gates(d, input) }))
  const demoted = judged.filter((j) => j.failed.length === 0 && demotedBy(j.d, evidence, input)).map((j) => ({ id: j.d.id, by: 'origin:pictograph' as const }))
  const isDemoted = new Set(demoted.map((x) => x.id))
  const passed = judged.filter((j) => j.failed.length === 0 && !isDemoted.has(j.d.id)).map((j) => j.d).sort(order)
  const primary = passed[0] ?? null
  if (!primary) {
    const stops = [...new Set(judged.flatMap((j) => j.failed))].filter((g) => g !== 'type:not-primary-capable')
    return {
      primary: null,
      secondary: [],
      rejected: judged.map((j) => ({ id: j.d.id, failed: j.failed })),
      demoted,
      none: { reason: discoveries.length === 0 ? noCandidate(input) : demoted.length ? `demoted by origin (F); otherwise stopped at: ${stops.join(', ') || 'none'}` : `every candidate stopped at a gate: ${stops.join(', ') || 'none primary-capable'}` },
    }
  }
  // secondary: candidates sharing a term with the primary, not a re-reading of the same observation
  const own = input.language.graphemes[primary.graphemes[0]]?.char
  const pTerms = new Set(termsOf(primary).filter((t) => t !== own))
  const pBasis = new Set(primary.basis)
  // (a candidate that failed its own gates stays rejected: only those that passed, or cannot be primary by type)
  const failedOwn = new Set(judged.filter((j) => j.failed.length && !j.failed.includes('type:not-primary-capable')).map((j) => j.d.id))
  const secondary: DiscoveryId[] = discoveries
    .filter((d) => d.id !== primary.id && !failedOwn.has(d.id) && !d.basis.some((b) => pBasis.has(b)) && termsOf(d).some((t) => t !== own && pTerms.has(t)))
    .sort(order)
    .map((d) => d.id)
  // also the Discoveries the primary holds (its nested ones and what they hold)
  for (const n of primary.nested ?? []) {
    if (!secondary.includes(n)) secondary.push(n)
    const held = discoveries.find((d) => d.id === n)
    if (held?.type === 'nested' && !secondary.includes(held.holds)) secondary.push(held.holds)
  }
  return {
    primary: primary.id,
    secondary,
    // every candidate not chosen: the gates it failed (none: it passed and ranked lower)
    rejected: judged.filter((j) => j.d.id !== primary.id && !secondary.includes(j.d.id)).map((j) => ({ id: j.d.id, failed: j.failed })),
    demoted,
  }
}
