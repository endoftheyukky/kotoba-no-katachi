/** What every admin response carries, and the login page. */

const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
].join('; ')

/** never indexed, never framed, never cached unless the response says so itself */
export function guard(response: Response): Response {
  const r = new Response(response.body, response)
  r.headers.set('x-robots-tag', 'noindex, nofollow')
  // same-origin, not no-referrer: with no-referrer a form's POST says Origin: null,
  // and the login and logout forms are checked for coming from this site
  r.headers.set('referrer-policy', 'same-origin')
  r.headers.set('x-frame-options', 'DENY')
  r.headers.set('x-content-type-options', 'nosniff')
  r.headers.set('content-security-policy', CSP)
  if (!r.headers.has('cache-control') || !r.headers.get('cache-control')!.includes('private')) r.headers.set('cache-control', 'no-store')
  return r
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** the door: one line, as quiet as the work's own */
export function loginPage(message = '', status = 200): Response {
  const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Generations</title>
<style>
  :root { --ground: #e8e6e1; --ink: #1b1b19; --mute: #85837c; --faint: #aeaba3 }
  * { box-sizing: border-box }
  body { margin: 0; min-height: 100dvh; display: grid; place-items: center; background: var(--ground); color: var(--ink);
    font-family: system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif; -webkit-font-smoothing: antialiased }
  form { width: min(18em, calc(100vw - 32px)); display: grid; gap: 14px; justify-items: center }
  h1 { margin: 0 0 6px; font-size: 13px; font-weight: 400; letter-spacing: 0.14em; color: var(--mute) }
  input { width: 100%; font: inherit; font-size: 16px; letter-spacing: 0.06em; text-align: center; color: var(--ink);
    background: none; border: 0; border-bottom: 1px solid var(--ink); border-radius: 0; padding: 6px 0 7px; outline: none }
  button { font: inherit; font-size: 13px; letter-spacing: 0.1em; color: var(--mute); background: none; border: 0; min-height: 44px; padding: 0 12px; cursor: pointer }
  button:hover, button:focus-visible { color: var(--ink); outline: none }
  p { margin: 0; min-height: 18px; font-size: 12px; color: var(--mute) }
</style>
</head>
<body>
<form method="post" action="/admin/login">
  <h1>Generations</h1>
  <label for="password" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">password</label>
  <input id="password" name="password" type="password" autocomplete="current-password" autofocus required>
  <button type="submit">Enter</button>
  <p role="status">${esc(message)}</p>
</form>
</body>
</html>`
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8' } })
}

/** what the admin sheet reads of a record (never the snapshot, which comes on its own) */
export const COLUMNS = 'id, created_at, client_created_at, visitor_id, session_id, title, reading, source, generator_version, output_hash'

export const idParam = (p: string | string[] | undefined) => (typeof p === 'string' ? p : '')

/** D1 hands a BLOB back as an array of bytes (or an ArrayBuffer) */
export const bytes = (v: unknown): Uint8Array<ArrayBuffer> | null =>
  v instanceof ArrayBuffer ? new Uint8Array(v) : Array.isArray(v) ? Uint8Array.from(v as number[]) : v instanceof Uint8Array ? new Uint8Array(v) : null
