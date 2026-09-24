/**
 * The page as it was drawn, kept as a snapshot for the archive.
 *
 * Shared by the page (which sends it), the server (which accepts or refuses
 * it) and the admin sheet (which checks it again before showing it). Nothing
 * here touches the generator: it only reads the markup the generator wrote.
 *
 *   canonical  clip and mask ids come from a counter that runs for the whole
 *              page load (c0 on a fresh page, c57 after a few poems). They are
 *              renumbered in order of appearance, so the same poem always has
 *              the same markup — and exactly the markup of a fresh page load.
 *   allowed    the only elements and attributes the renderer ever writes
 *              (render/stage.ts, glyph/figure.ts, glyph/source.ts), each with
 *              the only shape of value it can have. Anything else — a script,
 *              an event handler, a link, a comment, an unknown attribute —
 *              makes the whole snapshot unacceptable. Nothing is repaired.
 *   hash       SHA-256 of the canonical markup, hex: the output hash.
 */

/**
 * The limits of a snapshot, set from the pages the work draws. `npm run
 * verify:snapshots` draws every title of the public sets and the longest
 * titles with every generator and measures them. At this version the largest
 * page found — among those and 300 kanji written sixteen times — is ≈ 237 000
 * characters (絵 sixteen times, v3), with ≈ 3 500 elements; at most 25 masks and
 * 25 references, 7 levels, one character in each <text>, and numbers of at most
 * 20 characters. Each limit leaves room above that; none
 * lets a snapshot carry what the renderer never writes: long text, long
 * numbers, or a mask drawn through another.
 */
/** the largest snapshot accepted, in characters */
export const MAX_SVG = 500_000

export const SNAPSHOT_LIMITS = {
  elements: 12_000,
  depth: 16,
  /** characters in one <text>: the renderer writes one glyph; no text is longer than a title */
  text: 16,
  /** characters in one number: String(n) never writes more than 25 */
  number: 32,
  /** <mask> and <clipPath> */
  masks: 500,
  /** clip-path= and mask= */
  references: 1_000,
  /** references inside a <mask> or <clipPath>: the renderer writes none */
  nested: 0,
}

// String(n) can write a tiny clip rect as 1.2e-7
const NUM = /^-?\d+(\.\d+)?(e[-+]?\d+)?$/
const REF = /^url\(#[cm]\d+\)$/
const COLOUR = /^#[0-9a-fA-F]{3,8}$/
const TRANSFORM = /^(?:(?:translate|rotate|scale)\((?:-?\d+(?:\.\d+)?)(?: -?\d+(?:\.\d+)?)?\) ?)+$/
const UNITS = /^(userSpaceOnUse|objectBoundingBox)$/

export type Rule = RegExp | ((v: string) => boolean)

export const ALLOWED: Record<string, Record<string, Rule>> = {
  svg: {
    viewBox: /^0 0 1000 1000$/,
    preserveAspectRatio: /^xMidYMid meet$/,
    'text-rendering': /^geometricPrecision$/,
  },
  defs: {},
  clipPath: { id: /^c\d+$/, clipPathUnits: UNITS },
  mask: { id: /^m\d+$/, maskUnits: UNITS, maskContentUnits: UNITS, x: NUM, y: NUM, width: NUM, height: NUM },
  rect: { x: NUM, y: NUM, width: NUM, height: NUM, fill: COLOUR },
  g: { 'clip-path': REF, mask: REF, transform: TRANSFORM, display: /^(inline|none)$/ },
  text: {
    x: NUM,
    y: NUM,
    'font-size': NUM,
    // as serialized: font-family="&quot;Noto Sans JP&quot;" (or the same value unescaped, as the DOM reads it)
    'font-family': /^(&quot;|")Noto (Sans|Serif) JP(&quot;|")$/,
    'font-weight': /^\d{3}$/,
    fill: COLOUR,
    stroke: COLOUR,
    'stroke-width': NUM,
    'stroke-linejoin': /^round$/,
  },
}

/** where each element may stand */
export const PARENTS: Record<string, string[]> = {
  svg: [''],
  defs: ['svg'],
  clipPath: ['defs'],
  mask: ['defs'],
  rect: ['clipPath', 'mask'],
  g: ['svg', 'g', 'mask'],
  text: ['g'],
}

export const ok = (rule: Rule, v: string) => (typeof rule === 'function' ? rule(v) : rule.test(v))

/** renumber clip / mask ids in order of appearance: c57 m58 c59 → c0 m1 c2 */
export function canonicalSVG(svg: string): string {
  const ids = new Map<string, string>()
  return svg.replace(/(id="|url\(#)([cm])(\d+)/g, (_, lead: string, kind: string, n: string) => {
    const key = kind + n
    if (!ids.has(key)) ids.set(key, kind + ids.size)
    return lead + ids.get(key)
  })
}

const TAG = /<(\/?)([A-Za-z][A-Za-z0-9]*)((?:\s+[A-Za-z][A-Za-z0-9:-]*="[^"<>]*")*)\s*(\/?)>/y
const ATTR = /\s+([A-Za-z][A-Za-z0-9:-]*)="([^"<>]*)"/g
const TEXT = /[^<]+/y
/** text between tags: glyphs, and only the entities the serializer writes */
const TEXT_OK = /^(?:[^&<>]|&(?:amp|lt|gt|quot|nbsp|#\d+);)*$/

/** what a snapshot is made of, by the measures its limits are set in */
export interface SnapshotMeasure {
  /** elements, all kinds */
  elements: number
  /** deepest nesting of elements */
  depth: number
  /** the longest text of one <text>, in characters (an entity counts as one) */
  text: number
  /** the longest number written in one attribute value, in characters */
  number: number
  /** <mask> and <clipPath> elements */
  masks: number
  /** clip-path= and mask= references */
  references: number
  /** references made inside a <mask> or <clipPath>: a mask drawn through another mask */
  nested: number
}

const ENTITY = /&(?:amp|lt|gt|quot|nbsp|#\d+);/g
const NUMBER = /-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/g

type Scan = { verdict: true | string; measure: SnapshotMeasure }

/**
 * Read the markup once: the reason it is not the renderer's, if it is not,
 * and its measures. With `limits` the reading stops at the first measure
 * beyond its limit, so a refused snapshot costs no more than its limits.
 */
function scan(svg: string, limits: typeof SNAPSHOT_LIMITS | null): Scan {
  const measure: SnapshotMeasure = { elements: 0, depth: 0, text: 0, number: 0, masks: 0, references: 0, nested: 0 }
  const refuse = (verdict: string): Scan => ({ verdict, measure })
  const stack: string[] = []
  let pos = 0
  let roots = 0
  let inMask = 0
  while (pos < svg.length) {
    if (svg[pos] === '<') {
      TAG.lastIndex = pos
      const m = TAG.exec(svg)
      if (!m) return refuse(`unreadable markup at ${pos}`)
      pos = TAG.lastIndex
      const [, closing, name, attrs, selfClosing] = m
      // own entries only: a name such as constructor or toString is not the renderer's
      const allowed = Object.hasOwn(ALLOWED, name) ? ALLOWED[name] : undefined
      if (!allowed) return refuse(`element <${name}>`)
      if (closing) {
        if (attrs || selfClosing) return refuse(`malformed </${name}>`)
        if (stack.pop() !== name) return refuse(`unbalanced </${name}>`)
        if (name === 'mask' || name === 'clipPath') inMask--
        continue
      }
      const parent = stack.at(-1) ?? ''
      if (!PARENTS[name].includes(parent)) return refuse(`<${name}> inside <${parent || 'nothing'}>`)
      if (name === 'svg' && ++roots > 1) return refuse('more than one <svg>')
      if (++measure.elements > (limits?.elements ?? Infinity)) return refuse('too many elements')
      if (name === 'mask' || name === 'clipPath') {
        if (++measure.masks > (limits?.masks ?? Infinity)) return refuse('too many masks')
      }
      const seen = new Set<string>()
      for (const [, attr, value] of attrs.matchAll(ATTR)) {
        const rule = Object.hasOwn(allowed, attr) ? allowed[attr] : undefined
        if (!rule) return refuse(`attribute ${attr} on <${name}>`)
        if (seen.has(attr)) return refuse(`repeated ${attr}`)
        seen.add(attr)
        if (!ok(rule, value)) return refuse(`value of ${attr} on <${name}>`)
        for (const n of value.matchAll(NUMBER)) measure.number = Math.max(measure.number, n[0].length)
        if (measure.number > (limits?.number ?? Infinity)) return refuse(`number in ${attr} on <${name}>`)
        if (attr === 'clip-path' || attr === 'mask') {
          if (++measure.references > (limits?.references ?? Infinity)) return refuse('too many references')
          if (inMask && ++measure.nested > (limits?.nested ?? Infinity)) return refuse('references inside a mask')
        }
      }
      if (!selfClosing) {
        stack.push(name)
        if (name === 'mask' || name === 'clipPath') inMask++
      }
      measure.depth = Math.max(measure.depth, stack.length)
      if (stack.length > (limits?.depth ?? Infinity)) return refuse('too deep')
    } else {
      TEXT.lastIndex = pos
      const m = TEXT.exec(svg)!
      pos = TEXT.lastIndex
      const text = m[0]
      if (stack.at(-1) !== 'text') {
        if (text.trim()) return refuse('text outside <text>')
      } else {
        if (!TEXT_OK.test(text)) return refuse('text')
        measure.text = Math.max(measure.text, Array.from(text.replace(ENTITY, '_')).length)
        if (measure.text > (limits?.text ?? Infinity)) return refuse('text too long')
      }
    }
  }
  if (stack.length) return refuse('unclosed elements')
  if (roots !== 1) return refuse('no <svg>')
  return { verdict: true, measure }
}

/**
 * The snapshot as the renderer writes it, or the reason it is not.
 * A check only: the markup is never altered to make it pass.
 */
export function checkSVG(svg: string): true | string {
  if (svg.length > MAX_SVG) return 'too large'
  try {
    return scan(svg, SNAPSHOT_LIMITS).verdict
  } catch {
    // nothing in the markup should reach here; if it does, it is refused, not thrown
    return 'unreadable markup'
  }
}

/** the measures of a snapshot, whatever its size (for tools and tests; not a check of the limits) */
export function measureSVG(svg: string): SnapshotMeasure {
  return scan(svg, null).measure
}

/** SHA-256, hex */
export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}
