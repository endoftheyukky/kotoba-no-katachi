/**
 * One generation, as the page sends it to the archive (POST /api/generations).
 * The server checks every field again and keeps nothing else.
 */

/**
 * how the words came: typed on the line (also after 別のことばで試す). A poem
 * opened at its address — a shared link, a 作例 — is not recorded.
 */
export const SOURCES = ['manual'] as const
export type Source = (typeof SOURCES)[number]

/**
 * which generator wrote the page (poem/generators.ts). A snapshot is kept with
 * the name of the generator that drew it and is never redrawn by another.
 */
export const GENERATORS = ['v1'] as const
export type Generator = (typeof GENERATORS)[number]

export interface GenerationEvent {
  /** random, kept in this browser's localStorage */
  visitor_id: string
  /** random, kept in this tab's sessionStorage; renewed after 30 minutes without a generation */
  session_id: string
  title: string
  /** '' when none was given */
  reading: string
  source: Source
  generator_version: Generator
  /** SHA-256 of the canonical snapshot, hex */
  output_hash: string
  /** the page as drawn, canonical (see archive/svg.ts) */
  svg: string
  /** the browser's clock, ms since 1970; kept only as a note, never trusted */
  client_created_at: number
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
export const HASH = /^[0-9a-f]{64}$/
