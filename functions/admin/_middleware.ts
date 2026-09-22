// Everything under /admin passes here first: the sheet, its API, its assets.
// Only /admin/login is open; the rest needs a valid session cookie.
import { guard } from '../../server/admin'
import { authenticated, configured } from '../../server/auth'
import { json } from '../../server/http'

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx
  const path = new URL(request.url).pathname
  const response = await (async () => {
    if (!configured(env)) {
      return new Response('The archive is not configured yet.', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } })
    }
    if (path === '/admin/login') return ctx.next()
    if (await authenticated(request, env)) return ctx.next()
    if (path.startsWith('/admin/api/')) return json({ error: 'unauthorized' }, 401)
    return new Response(null, { status: 303, headers: { location: '/admin/login' } })
  })()
  return guard(response)
}
