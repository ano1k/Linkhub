import { db } from '@/lib/db'
import { setSessionCookie } from '@/lib/auth'
import { buildRedirectUri, getDiscordConfig, isDiscordConfigured, redirectRaw } from '@/lib/config'
import { exchangeCode, fetchMe } from '@/lib/discord'

function fail(message: string) {
  // Location relative : resolue par le navigateur sur l'origine courante (https en preview).
  return redirectRaw(`/?auth_error=${encodeURIComponent(message)}`)
}

// Lit un cookie de la requete sans passer par cookies() : ce store Next.js reconstruit
// les Set-Cookie de la reponse retournee et les dedoublonne par nom, ce qui empeche
// d'emettre les deux variantes (Partitioned / non partitionnee) du cookie de session.
function readRequestCookie(req: Request, name: string): string | null {
  const header = req.headers.get('cookie') || ''
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return rest.join('=') || null
  }
  return null
}

// GET /api/auth/discord/callback -> finalise la connexion
export async function GET(req: Request) {
  const config = await getDiscordConfig()
  if (!isDiscordConfigured(config)) return fail('Application Discord non configuree.')

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const savedState = readRequestCookie(req, 'dlh_oauth_state')

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

    const res = redirectRaw('/')
    setSessionCookie(res, me.id, req)
    // Le state a served : on l'efface en brut (auto-expire dans 10 min sinon).
    res.headers.append('set-cookie', 'dlh_oauth_state=; Path=/; HttpOnly; Max-Age=0')
    return res
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur inconnue pendant la connexion.'
    return fail(message)
  }
}
