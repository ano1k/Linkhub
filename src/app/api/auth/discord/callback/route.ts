import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { setSessionCookie } from '@/lib/auth'
import { buildRedirectUri, getDiscordConfig, isDiscordConfigured, redirectRelative } from '@/lib/config'
import { exchangeCode, fetchMe } from '@/lib/discord'

function fail(message: string) {
  // Location relative : resolue par le navigateur sur l'origine courante (https en preview).
  return redirectRelative(`/?auth_error=${encodeURIComponent(message)}`)
}

// GET /api/auth/discord/callback -> finalise la connexion
export async function GET(req: Request) {
  const config = await getDiscordConfig()
  if (!isDiscordConfigured(config)) return fail('Application Discord non configuree.')

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  const store = await cookies()
  const savedState = store.get('dlh_oauth_state')?.value
  try {
    store.set('dlh_oauth_state', '', { path: '/', maxAge: 0 })
  } catch {
    // pas grave si l'effacement echoue
  }

  if (!code) return fail("Discord n'a pas renvoye de code d'autorisation.")
  if (!state || state !== savedState)
    return fail("Session d'autorisation expiree, reessaie.")

  try {
    const tokens = await exchangeCode(config.clientId, config.clientSecret, code, buildRedirectUri(req))
    const me = await fetchMe(tokens.access_token)

    const data = {
      username: me.username,
      globalName: me.global_name ?? null,
      avatar: me.avatar ?? null,
      email: me.email ?? null,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    }

    await db.user.upsert({
      where: { id: me.id },
      create: { id: me.id, ...data },
      update: data,
    })

    await setSessionCookie(me.id, req)
    return redirectRelative('/')
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur inconnue pendant la connexion.'
    return fail(message)
  }
}
