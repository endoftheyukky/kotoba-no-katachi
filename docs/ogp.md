# Link previews (OGP): what is done, what is not, and how to go further

A shared address (`/?title=孤独&v=3`) is today previewed by X, LINE, Slack and
iMessage with the site's own card: the name, the description and
`public/ogp.png`. The poem's title reaches the post only through the text the
page writes (ことばのかたち / 「孤独」 / address). This note records why no
per-poem card is served yet, what is ready, and the steps to add one.

## What is in the repository now

- `public/ogp.png` — the site's card, redrawn for v3: three of the 作例 (孤独 ·
  雨の中の雨 · 余白) as papers on the ground, laid out as the v2c card was.
  Drawn by the site's own renderer (`tools/examples/make.mjs`, checked with
  `CHECK=1`); the poems are not altered, cropped or restyled.
- `public/og/v3/<name>.png` — for each of the nine 作例, a 1200 × 630 card of
  its own paper (540 px, centred on the ground). Nothing names them yet: they
  are ready for step 1 below and cost nothing while unused.

## The constraint

A crawler reads the HTML of an address and does not run its script. The page
is the same static `index.html` for every address, so a per-poem card needs
something on the server that knows the address — on Cloudflare Pages, a
Function in front of `/`.

The poem itself **cannot be drawn on the server**. The generator measures the
title's glyphs through the page's canvas (ink, components, counters); the same
code in a Worker has no canvas and no fonts, and a second implementation would
be a second generator — exactly what the work must not have (a v3 card would
no longer be a v3 poem). So an image of a poem can only come from a browser.

## Options

| | per-poem title | per-poem image | risk |
| --- | --- | --- | --- |
| **0. now** — static card | no | no (site card) | none |
| **1. title in the head** — a Function on `/` writes 「題」 into `og:title`, `twitter:title`, `og:url`, `canonical`; the image stays the site card, except the nine 作例, which get their own | yes | 作例 only | every visit to `/` becomes a Function request (below) |
| **2. images drawn ahead of time by a trusted renderer** — a scheduled job (the CDP harness, `tools/form/cdp.mjs`, in CI or on a machine) opens each address that has been written, saves its paper to R2 as `og/v<n>/<sha256(title, reading, v)>.png`; the Function of step 1 names it when it exists | yes | yes, after the job has run (a new title shows the site card until then) | job to run and watch; R2 bucket; the archive is the list of addresses (never published) |
| **3. drawn on demand** — Cloudflare Browser Rendering opens the address in headless Chrome at the first crawl and caches the paper in R2 | yes | yes, at once | Workers Paid plan; a crawler waits several seconds on the first request (X may give up and cache no image); cost per render |
| ~~4. uploaded by the visitor's browser~~ — the page already makes the PNG | — | — | **rejected**: the server cannot tell a real paper from any other image; anyone could attach an arbitrary picture to any title's address |

Rasterising the stored SVG snapshot inside a Worker (resvg-wasm) was also
considered: the SVG sets characters as `<text>` in Noto Sans/Serif JP, so the
Worker would need several MB of fonts (over the free bundle limit) and more
than the free 10 ms of CPU per request; and the snapshot is sent by the
visitor's browser, so it has the same trust problem as option 4.

## Why step 1 is not switched on in this change

`public/_routes.json` sends only `/api/*` and `/admin*` to Functions. Step 1
adds `/` (a route cannot match a query string, so the blank root is included):

- **Quota.** On the Workers Free plan, Functions have 100,000 requests a day,
  shared with the archive's `/api/generations`. Every page view of `/` would
  count. Once exhausted, Functions stop until the next day; with
  **Settings → Runtime → Fail open** the static page is served untouched (the
  card falls back to the site's), with *fail closed* visitors get an error.
  The archive's endpoint would also stop for the rest of the day in both cases.
- **Latency.** Every `/` request runs the Function (`next()` + one string
  rewrite of a ~10 KB page): a few ms, but the page is no longer served
  straight from the static asset cache.
- **Scope.** It is a production routing change, which the release brief asked
  to decide before it is made.

## Step 1, ready to add

Three files; nothing else changes (the page, its script, the addresses).

`public/_routes.json`

```json
{ "version": 1, "include": ["/", "/api/*", "/admin", "/admin/*"], "exclude": [] }
```

`functions/index.ts`

```ts
// GET / — the page, as it is, with a poem's address written into its link
// tags (server/poem-meta.ts). Any failure serves the page untouched.
import { poemMeta, withPoemMeta } from '../server/poem-meta'

const SITE = { title: 'ことばのかたち', url: 'https://kotoba-no-katachi.pages.dev' }

export const onRequestGet: PagesFunction<Env> = async ({ request, next }) => {
  const page = await next()
  try {
    const meta = poemMeta(new URL(request.url), SITE)
    if (!meta || !page.ok || !(page.headers.get('content-type') ?? '').includes('text/html')) return page
    const headers = new Headers(page.headers)
    headers.delete('content-length')
    headers.delete('etag')
    return new Response(withPoemMeta(await page.text(), meta), { status: page.status, headers })
  } catch {
    return page
  }
}
```

`server/poem-meta.ts` (add `"resolveJsonModule": true` to
`functions/tsconfig.json`, or pass the nine names as a literal list)

```ts
import manifest from '../tools/examples/manifest.json'
import { normalizeTitle } from '../src/title'

const drawn = new Map((manifest as { text: string; v: number; file: string }[])
  .map((e) => [`${e.text}\u0000\u0000${e.v}`, `/og/v${e.v}/${e.file}`]))
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
/** as poem/generators.ts reads it */
const versionOf = (v: string | null) => (v === '1' ? 1 : v === '3' ? 3 : 2)

export interface PoemMeta { title: string; url: string; image: string | null }

/** the tags a poem's address should carry, or null for the site's own */
export function poemMeta(address: URL, site: { url: string; title: string }): PoemMeta | null {
  const raw = address.searchParams.get('title')
  if (!raw) return null
  const input = normalizeTitle({ text: raw, reading: address.searchParams.get('reading') ?? '' })
  if (typeof input === 'string') return null // an address the page would refuse keeps the site's card
  const v = versionOf(address.searchParams.get('v'))
  const q = new URLSearchParams({ title: input.text })
  if (input.reading) q.set('reading', input.reading)
  if (v !== 2) q.set('v', String(v))
  const image = input.reading ? undefined : drawn.get(`${input.text}\u0000\u0000${v}`)
  return { title: `「${input.text}」 — ${site.title}`, url: `${site.url}/?${q}`, image: image ? `${site.url}${image}` : null }
}

/** only tags the page already carries are changed; anything not found is left as it is */
export function withPoemMeta(html: string, meta: PoemMeta): string {
  const set = (attr: 'property' | 'name', key: string, value: string) => {
    html = html.replace(new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`), `$1${esc(value)}$2`)
  }
  set('property', 'og:title', meta.title)
  set('name', 'twitter:title', meta.title)
  set('property', 'og:url', meta.url)
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${esc(meta.url)}$2`)
  if (meta.image) {
    set('property', 'og:image', meta.image)
    set('name', 'twitter:image', meta.image)
  }
  return html
}
```

### To switch it on

1. In the Cloudflare dashboard, Pages → kotoba-no-katachi → Settings →
   Runtime: set **Fail open** first.
2. Add the three files; `npm run build`; check under `npm run dev:archive`
   (wrangler pages dev) that `/?title=孤独&v=3` carries 「孤独」 — ことばのかたち
   and `/og/v3/kodoku.png`, that `/?title=見えない` carries its v2c address, that
   `/` and a refused title (17 characters) carry the site card unchanged, and
   that the page's SVG is byte-identical with and without the Function.
3. Deploy (a production deploy: stop and confirm first).
4. Check with the X post composer and LINE (both cache cards; a changed card
   may take days to refresh for an address already shared).
5. Watch Workers → Functions requests for a week; if the daily count comes
   near 100,000, remove `/` from `_routes.json` again (one line, no data).

### Known limits of step 1

- A title the page refuses because the font lacks a character still gets a
  per-poem card (coverage is checked by the page's own font data, not on the
  server).
- Only the nine 作例 carry their own image; step 2 is what extends it.
