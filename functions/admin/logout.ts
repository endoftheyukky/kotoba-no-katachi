// /admin/logout — POST from the sheet: the cookie is cleared.
import { clearedCookie } from '../../server/auth'
import { sameOrigin } from '../../server/http'

export const onRequestPost: PagesFunction<Env> = ({ request }) => {
  if (!sameOrigin(request)) return new Response(null, { status: 403 })
  return new Response(null, { status: 303, headers: { location: '/admin/login', 'set-cookie': clearedCookie } })
}
