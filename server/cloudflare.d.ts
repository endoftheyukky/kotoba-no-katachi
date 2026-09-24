/**
 * The few Cloudflare runtime types the archive uses (Pages Functions + D1),
 * written out here instead of adding a types package.
 */

interface D1Meta {
  changes?: number
  rows_read?: number
  rows_written?: number
  duration?: number
}

interface D1Result<T = Record<string, unknown>> {
  results: T[]
  success: boolean
  meta: D1Meta
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>
}

interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>
}

/** the bindings of the Pages project (wrangler.toml, secrets) */
interface Env {
  DB: D1Database
  /** pbkdf2:sha256:<iterations>:<salt b64>:<hash b64> — set with `npm run admin:password` */
  ADMIN_PASSWORD_HASH?: string
  /** random, ≥ 32 bytes, base64: signs the admin session cookie */
  SESSION_SECRET?: string
  /** the project's static files (functions/s.ts reads index.html through it) */
  ASSETS: { fetch(request: Request): Promise<Response> }
}

/** the part of Cloudflare's HTMLRewriter the functions use (functions/s.ts) */
interface RewriterElement {
  setAttribute(name: string, value: string): RewriterElement
  setInnerContent(content: string, options?: { html?: boolean }): RewriterElement
}

declare class HTMLRewriter {
  on(selector: string, handlers: { element?(element: RewriterElement): void | Promise<void> }): HTMLRewriter
  transform(response: Response): Response
}

interface EventContext<E, P extends string, D> {
  request: Request
  env: E
  params: Record<P, string | string[]>
  data: D
  functionPath: string
  next(input?: Request | string, init?: RequestInit): Promise<Response>
  waitUntil(promise: Promise<unknown>): void
}

type PagesFunction<E = Env, P extends string = string, D extends Record<string, unknown> = Record<string, unknown>> = (
  context: EventContext<E, P, D>,
) => Response | Promise<Response>
