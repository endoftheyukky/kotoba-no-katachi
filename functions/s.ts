// /s?title=…&reading=…&v=… — the address the share buttons give. The same page
// as the poem's own address (index.html, a static file), with its head written
// for this poem on the server, so that a link preview reads the right card
// without running any script (server/share.ts). Nothing is recorded here: the
// page records only words someone has just written (src/archive/record.ts).
// Only /s runs here (public/_routes.json); / stays a static file.
import { shareMeta } from '../server/share'

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } })
  const url = new URL(request.url)
  const page = await env.ASSETS.fetch(new Request(new URL('/', url), { method: request.method }))
  const meta = page.ok ? shareMeta(url) : null
  if (!meta) return page

  // setAttribute escapes the quote but not the ampersand, which a reader would take as the start of an entity
  const attr = (value: string) => value.replace(/&/g, '&amp;')
  const content = (value: string) => ({ element: (e: RewriterElement) => void e.setAttribute('content', attr(value)) })
  const rewritten = new HTMLRewriter()
    .on('title', { element: (e) => void e.setInnerContent(meta.documentTitle) })
    .on('meta[property="og:title"]', content(meta.title))
    .on('meta[name="twitter:title"]', content(meta.title))
    .on('meta[property="og:image"]', content(meta.image))
    .on('meta[name="twitter:image"]', content(meta.image))
    .on('meta[property="og:url"]', content(meta.url))
    .on('link[rel="canonical"]', { element: (e) => void e.setAttribute('href', attr(meta.canonical)) })
    .transform(page)
  const headers = new Headers(rewritten.headers)
  // the body is not the static file's any more
  headers.delete('etag')
  headers.delete('content-length')
  return new Response(rewritten.body, { status: rewritten.status, headers })
}
