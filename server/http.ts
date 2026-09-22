/** Small helpers shared by the functions. */

export const json = (data: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  })

export const empty = (status: number, headers: HeadersInit = {}) => new Response(null, { status, headers })

/** the body as text, refusing more than `limit` bytes however the request is sent */
export async function readText(request: Request, limit: number): Promise<string | null> {
  if (!request.body) return ''
  const reader = request.body.getReader()
  const parts: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > limit) {
      await reader.cancel()
      return null
    }
    parts.push(value)
  }
  const all = new Uint8Array(size)
  let at = 0
  for (const p of parts) {
    all.set(p, at)
    at += p.byteLength
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(all)
}

export async function gzip(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function gunzip(data: Uint8Array<ArrayBuffer>): Promise<string> {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).text()
}

/** a POST from a page of this site, and not from anywhere else */
export const sameOrigin = (request: Request) => request.headers.get('origin') === new URL(request.url).origin
