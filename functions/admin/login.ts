// /admin/login — GET shows the door, POST checks the password (server-side only).
import { loginPage } from '../../server/admin'
import { issueSession, loginFailed, loginSucceeded, passwordMatches, sessionCookie, throttled } from '../../server/auth'
import { sameOrigin } from '../../server/http'

export const onRequestGet: PagesFunction<Env> = () => loginPage()

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!sameOrigin(request)) return new Response(null, { status: 403 })
  if (await throttled(env.DB)) return loginPage('しばらく時間をおいてください', 429)
  let password = ''
  try {
    const form = await request.formData()
    password = String(form.get('password') ?? '')
  } catch {
    return loginPage('', 400)
  }
  if (!(await passwordMatches(password, env.ADMIN_PASSWORD_HASH!))) {
    await loginFailed(env.DB)
    return loginPage('違います', 401)
  }
  await loginSucceeded(env.DB)
  return new Response(null, { status: 303, headers: { location: '/admin/', 'set-cookie': sessionCookie(await issueSession(env)) } })
}
