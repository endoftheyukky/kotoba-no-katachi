/**
 * What a shared link says about its poem, before any script runs: the card a
 * link preview shows (functions/s.ts puts it into the page's head).
 *
 *   /s?title=孤独&v=1   the address the share buttons give (src/main.ts)
 *   /?title=孤独&v=1    the poem's own address, the canonical one
 *
 * The same words, reading and version as the page reads them from the address;
 * nothing is drawn here. A 作例 has a card of its own, drawn ahead of time
 * (public/og/v1/, tools/examples/manifest.json); every other poem, for now,
 * the site's card.
 */
import site from '../site.config.json'
import examples from '../tools/examples/manifest.json'
import { normalizeTitle } from '../src/title'

export const SITE_URL = site.url.replace(/\/+$/, '')

/** the site's own card (site.config.json) */
export const SITE_IMAGE = `${SITE_URL}${site.ogImage}`

/**
 * The versions an address may name, and the current one, as
 * src/poem/generators.ts has them. Written again here so that the server does
 * not load the generator.
 */
export const VERSIONS = [1] as const
export type Version = (typeof VERSIONS)[number]
export const CURRENT: Version = 1

/** the version an address asks for: one that was published, or the current one (generators.ts versionOf) */
export const versionOf = (param: string | null): Version => VERSIONS.find((v) => String(v) === param) ?? CURRENT

/** the query of a poem's address, as the page writes it (src/main.ts addressOf): the version always named */
export function poemQuery(text: string, reading: string, v: Version): string {
  const q = new URLSearchParams({ title: text })
  if (reading) q.set('reading', reading)
  q.set('v', String(v))
  return q.toString()
}

/** the 作例 cards, by their words and version (no reading) */
const CARDS = new Map((examples as { text: string; v: number; file: string }[]).map((e) => [`${e.v}:${e.text}`, `/og/v${e.v}/${e.file}`]))

export interface ShareMeta {
  /** og:title, twitter:title */
  title: string
  /** the browser's title, as the page itself sets it */
  documentTitle: string
  /** og:image, twitter:image: absolute */
  image: string
  /** og:url: this /s address, written the way the page writes it */
  url: string
  /** the poem's own address */
  canonical: string
}

/** the card for a /s address, or null when it names no poem the page would draw (then the site's own head stays) */
export function shareMeta(address: URL): ShareMeta | null {
  const q = address.searchParams
  const raw = q.get('title')
  if (!raw) return null
  const input = normalizeTitle({ text: raw, reading: q.get('reading') ?? '' })
  if (typeof input === 'string') return null
  // what the archive also refuses: controls and separators do not belong in a card
  if (/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(input.text)) return null
  const reading = input.reading ?? ''
  const v = versionOf(q.get('v'))
  const query = poemQuery(input.text, reading, v)
  const card = reading ? undefined : CARDS.get(`${v}:${input.text}`)
  return {
    title: `「${input.text}」 — ${site.title}`,
    documentTitle: `${input.text} — ${site.title}`,
    image: card ? `${SITE_URL}${card}` : SITE_IMAGE,
    url: `${SITE_URL}/s?${query}`,
    canonical: `${SITE_URL}/?${query}`,
  }
}
