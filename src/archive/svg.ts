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

/** the largest snapshot accepted, in characters (the largest known page is ≈ 70 000) */
export const MAX_SVG = 1_000_000

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

/**
 * The snapshot as the renderer writes it, or the reason it is not.
 * A check only: the markup is never altered to make it pass.
 */
export function checkSVG(svg: string): true | string {
  if (svg.length > MAX_SVG) return 'too large'
  const stack: string[] = []
  let pos = 0
  let roots = 0
  let count = 0
  while (pos < svg.length) {
    if (svg[pos] === '<') {
      TAG.lastIndex = pos
      const m = TAG.exec(svg)
      if (!m) return `unreadable markup at ${pos}`
      pos = TAG.lastIndex
      const [, closing, name, attrs, selfClosing] = m
      const allowed = ALLOWED[name]
      if (!allowed) return `element <${name}>`
      if (closing) {
        if (attrs || selfClosing) return `malformed </${name}>`
        if (stack.pop() !== name) return `unbalanced </${name}>`
        continue
      }
      const parent = stack.at(-1) ?? ''
      if (!PARENTS[name].includes(parent)) return `<${name}> inside <${parent || 'nothing'}>`
      if (name === 'svg' && ++roots > 1) return 'more than one <svg>'
      if (++count > 50_000) return 'too many elements'
      const seen = new Set<string>()
      for (const [, attr, value] of attrs.matchAll(ATTR)) {
        const rule = allowed[attr]
        if (!rule) return `attribute ${attr} on <${name}>`
        if (seen.has(attr)) return `repeated ${attr}`
        seen.add(attr)
        if (!ok(rule, value)) return `value of ${attr} on <${name}>`
      }
      if (!selfClosing) stack.push(name)
      if (stack.length > 64) return 'too deep'
    } else {
      TEXT.lastIndex = pos
      const m = TEXT.exec(svg)!
      pos = TEXT.lastIndex
      const text = m[0]
      if (stack.at(-1) !== 'text') {
        if (text.trim()) return 'text outside <text>'
      } else if (!TEXT_OK.test(text)) return 'text'
    }
  }
  if (stack.length) return 'unclosed elements'
  if (roots !== 1) return 'no <svg>'
  return true
}

/** SHA-256, hex */
export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}
