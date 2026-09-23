// GET /admin/api/stats — the three totals, from counters kept at each record.
import { json } from '../../../server/http'

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare(`SELECT name, value FROM counters WHERE name IN ('generations', 'visitors', 'sessions')`).all<{
    name: string
    value: number
  }>()
  const total = (name: string) => results.find((r) => r.name === name)?.value ?? 0
  return json({ generations: total('generations'), visitors: total('visitors'), sessions: total('sessions') })
}
