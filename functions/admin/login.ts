// /admin/login — GET shows the door, POST checks the password (server-side only).
import { loginPage } from '../../server/admin'
import { attemptSucceeded, issueSession, MAX_PASSWORD, passwordMatches, sessionCookie, takeAttempt } from '../../server/auth'
import { readText, sameOrigin } from '../../server/http'

/** the form holds one field; nothing larger is read */
const MAX_FORM = 4_096

export const onRequestGet: PagesFunction<Env> = () => loginPage()

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!sameOrigin(request)) return new Response(null, { status: 403 })
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/x-www-form-urlencoded')) return loginPage('', 400)
  if (Number(request.headers.get('content-length') ?? 0) > MAX_FORM) return loginPage('', 413)
  let password = ''
  try {
    const text = await readText(request, MAX_FORM)
    if (text === null) return loginPage('', 413)
    password = new URLSearchParams(text).get('password') ?? ''
  } catch {
    return loginPage('', 400)
  }
  // a password that cannot be right is not checked, and takes no attempt from anyone
  if (!password || password.length > MAX_PASSWORD) return loginPage('違います', 401)
  // an attempt is taken before the password is checked: none left, nothing is checked
  const rows = await takeAttempt(request, env)
  if (!rows) return loginPage('しばらく時間をおいてください', 429)
  if (!(await passwordMatches(password, env.ADMIN_PASSWORD_HASH!))) return loginPage('違います', 401)
  await attemptSucceeded(env, rows)
  return new Response(null, { status: 303, headers: { location: '/admin/', 'set-cookie': sessionCookie(await issueSession(env)) } })
}
