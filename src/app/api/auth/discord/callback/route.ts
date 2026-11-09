import { db } from '@/lib/db'
import { setSessionCookie } from '@/lib/auth'
import { buildRedirectUri, getDiscordConfig, isDiscordConfigured, redirectRaw } from '@/lib/config'
import { exchangeCode, fetchMe } from '@/lib/discord'
import { getClientIp, rateLimit, rateLimitHeaders, recordAudit } from '@/lib/security'
import { sealSecret } from '@/lib/secrets'

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
  const ip = getClientIp(req)
  const limit = rateLimit(`oauth-callback:${ip}`, 20, 60_000)
  if (!limit.allowed) {
    return fail('Trop de tentatives de connexion. Reessaie dans une minute.')
  }

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
      // Tokens chiffres en base (AES-256-GCM, cle derivee de APP_SECRET).
      accessToken: sealSecret(tokens.access_token),
      refreshToken: sealSecret(tokens.refresh_token),
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    }

    const user = await db.user.upsert({
      where: { id: me.id },
      create: { id: me.id, ...data },
      update: data,
    })

    const res = redirectRaw('/')
    // Le cookie porte la version de session courante (0 au premier passage).
    setSessionCookie(res, me.id, req, user.sessionVersion ?? 0)
    await recordAudit({
      action: 'auth.login',
      actorId: me.id,
      actorName: me.global_name || me.username,
      target: 'discord',
      ip,
      userAgent: req.headers.get('user-agent'),
      metadata: { provider: 'discord' },
    })
    // Le state a served : on l'efface en brut (auto-expire dans 10 min sinon).
    res.headers.append('set-cookie', 'dlh_oauth_state=; Path=/; HttpOnly; Max-Age=0')
    return res
  } catch (e) {
    const raw = e instanceof Error ? e.message : 'Erreur inconnue pendant la connexion.'
    if (raw.includes('invalid_client')) {
      // Client ID / Secret invalides en base : on les efface pour REOUVRIR le panneau
      // de configuration publique. Sans ca, les Reglages (reserves au staff connecte)
      // seraient inaccessibles : le login est casse, personne ne peut plus y acceder.
      // Les identifiants effaces sont de toute facon morts (Discord les refuse).
      try {
        await db.appConfig.update({
          where: { id: 'main' },
          data: { discordClientId: '', discordClientSecret: '' },
        })
      } catch {
        // pas de ligne 'main' en base : rien a reinitialiser
      }
      return fail(
        'Identifiants Discord refuses (Client ID ou Client Secret incorrect). Ils ont ete reinitialises : clique sur « Reglages » en haut a droite, colle les bons identifiants depuis le portail developpeur Discord (Application > OAuth2), enregistre, puis reconnecte-toi.',
      )
    }
    return fail(raw)
  }
}
