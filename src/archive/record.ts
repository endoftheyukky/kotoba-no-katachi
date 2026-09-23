/**
 * The archive, from the page's side: when a poem is newly written by someone
 * (typed words), one record is sent — and only then. Opening a shared
 * address or a 作例, Back / Forward, reloading, saving, sharing and About
 * send nothing.
 *
 * It never stands in the way of the poem: the page is already drawn when this
 * is called, the work is done later, and every failure (no storage, no
 * network, a slow or broken server) ends here in silence.
 *
 * What identifies the writer is only what this browser keeps:
 *   visitor  a random UUID in localStorage, made at the first generation
 *   session  a random UUID in sessionStorage (this tab), renewed after 30
 *            minutes without a generation
 * No fingerprint, no user agent, no screen, no address.
 */
import { UUID, type Generator, type GenerationEvent, type Source } from './protocol'
import { canonicalSVG, sha256 } from './svg'

const VISITOR = 'kotoba:visitor'
const SESSION = 'kotoba:session'
/** a pause this long ends a visit */
const IDLE = 30 * 60_000
const TIMEOUT = 10_000

/** where storage is refused (some private modes), ids last as long as the page */
const memory: { visitor?: string; session?: { id: string; last: number } } = {}

function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

function visitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR)
    if (!id || !UUID.test(id)) {
      id = uuid()
      localStorage.setItem(VISITOR, id)
    }
    return id
  } catch {
    return (memory.visitor ??= uuid())
  }
}

function sessionId(now: number): string {
  const renew = (s: { id: string; last: number } | undefined) =>
    s && UUID.test(s.id) && now - s.last < IDLE ? { id: s.id, last: now } : { id: uuid(), last: now }
  try {
    const raw = sessionStorage.getItem(SESSION)
    const s = renew(raw ? (JSON.parse(raw) as { id: string; last: number }) : undefined)
    sessionStorage.setItem(SESSION, JSON.stringify(s))
    return s.id
  } catch {
    return (memory.session = renew(memory.session)).id
  }
}

export interface Written {
  text: string
  reading: string
  source: Source
  generator: Generator
  /** the page just drawn; read later, it does not change */
  svg: SVGSVGElement
}

/** Record a poem that was just written. Returns at once; never throws. */
export function record(w: Written): void {
  // `npm run dev` writes nothing anywhere
  if (import.meta.env.DEV) return
  try {
    const at = Date.now()
    // taken now, so that the order of the poems is the order they were written
    const ids = { visitor: visitorId(), session: sessionId(at) }
    window.setTimeout(() => void send(w, ids, at).catch(() => {}), 0)
  } catch {
    // no archive this time
  }
}

async function send(w: Written, ids: { visitor: string; session: string }, at: number): Promise<void> {
  const svg = canonicalSVG(w.svg.outerHTML)
  const event: GenerationEvent = {
    visitor_id: ids.visitor,
    session_id: ids.session,
    title: w.text,
    reading: w.reading,
    source: w.source,
    generator_version: w.generator,
    output_hash: await sha256(svg),
    svg,
    client_created_at: at,
  }
  if (navigator.onLine === false) return
  const abort = new AbortController()
  const timer = window.setTimeout(() => abort.abort(), TIMEOUT)
  try {
    await fetch('/api/generations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event),
      credentials: 'omit',
      signal: abort.signal,
    })
  } catch {
    // offline, blocked, slow: nothing to say
  } finally {
    window.clearTimeout(timer)
  }
}
