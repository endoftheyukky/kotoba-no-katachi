/**
 * A snapshot, parsed, checked again against the renderer's own vocabulary
 * (archive/svg.ts) and made safe to stand beside others in one document.
 */
import { ALLOWED, ok, PARENTS } from '../archive/svg'

const SVG_NS = 'http://www.w3.org/2000/svg'

function allowed(el: Element, parent: string): boolean {
  const name = el.localName
  const rules = ALLOWED[name]
  if (!rules || el.namespaceURI !== SVG_NS || !PARENTS[name]?.includes(parent)) return false
  for (const a of Array.from(el.attributes)) {
    const rule = rules[a.name]
    if (!rule || !ok(rule, a.value)) return false
  }
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === Node.TEXT_NODE) {
      if (name !== 'text' && n.textContent?.trim()) return false
    } else if (n.nodeType === Node.ELEMENT_NODE) {
      if (!allowed(n as Element, name)) return false
    } else return false
  }
  return true
}

/**
 * The page as an element, or null if it is not exactly what the renderer
 * writes. Parsed inert (a template runs nothing), then its clip and mask ids
 * are given a prefix: every snapshot numbers them from c0.
 */
export function paper(markup: string, prefix: string): SVGSVGElement | null {
  const t = document.createElement('template')
  t.innerHTML = markup
  const root = t.content.firstChild
  if (t.content.childNodes.length !== 1 || !(root instanceof Element) || !allowed(root, '')) return null
  for (const el of Array.from(root.querySelectorAll('[id]'))) el.id = prefix + el.id
  for (const el of Array.from(root.querySelectorAll('[clip-path], [mask]'))) {
    for (const a of ['clip-path', 'mask']) {
      const v = el.getAttribute(a)
      if (v) el.setAttribute(a, v.replace('url(#', `url(#${prefix}`))
    }
  }
  return document.importNode(root, true) as SVGSVGElement
}
