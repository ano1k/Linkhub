import { randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import {
  MOCK_PORT,
  buildRedirectUri,
  detectPublicProto,
  getDiscordConfig,
  isDiscordConfigured,
  isMockMode,
  redirectRelative,
} from '@/lib/config'
import { DISCORD_SCOPES, buildAuthorizeUrl } from '@/lib/discord'

// GET /api/auth/discord -> lance la connexion Discord
export async function GET(req: Request) {
  const config = await getDiscordConfig()

  if (!isDiscordConfigured(config)) {
    return redirectRelative(
      `/?auth_error=${encodeURIComponent(
        "Configure d'abord ton application Discord dans l'onglet Reglages.",
      )}`,
    )
  }

  const state = randomBytes(16).toString('hex')
  const redirectUri = buildRedirectUri(req)
  const isHttps = detectPublicProto(req) === 'https'

  const setAuthCookie = (res: NextResponse) => {
    // En https, SameSite=None + Secure pour que le cookie survive au aller-retour OAuth.
    res.cookies.set('dlh_oauth_state', state, {
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? 'none' : 'lax',
      path: '/',
      maxAge: 600,
    })
    return res
  }

  // ------------------------------------------------------------------
  // Mode demo : le mock Discord est appele DIRECTEMENT depuis le serveur.
  // Avantage : aucun ping-pong navigateur -> passerelle -> mock, donc le flux
  // fonctionne meme si la passerelle publique perd le protocole ou les en-tetes.
  // La redirection finale vers le callback est RELATIVE (resolue par le navigateur
  // sur l'origine courante, donc toujours en https en preview).
  // ------------------------------------------------------------------
  if (isMockMode()) {
    try {
      const authorizeEndpoint = new URL(`http://localhost:${MOCK_PORT}/oauth2/authorize`)
      authorizeEndpoint.searchParams.set('client_id', config.clientId)
      authorizeEndpoint.searchParams.set('redirect_uri', redirectUri)
      authorizeEndpoint.searchParams.set('response_type', 'code')
      authorizeEndpoint.searchParams.set('scope', DISCORD_SCOPES)
      authorizeEndpoint.searchParams.set('state', state)
      authorizeEndpoint.searchParams.set('prompt', 'consent')

      const mockRes = await fetch(authorizeEndpoint, { redirect: 'manual', cache: 'no-store' })
      const location = mockRes.headers.get('location')
      if (!location) {
        return redirectRelative(
          `/?auth_error=${encodeURIComponent('Le serveur de demo ne repond pas correctement, reessaie.')}`,
        )
      }
      const code = new URL(location, authorizeEndpoint).searchParams.get('code')
      if (!code) {
        return redirectRelative(
          `/?auth_error=${encodeURIComponent('Code d\'autorisation de demo manquant, reessaie.')}`,
        )
      }
      return setAuthCookie(
        redirectRelative(
          `/api/auth/discord/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
        ),
      )
    } catch {
      return redirectRelative(
        `/?auth_error=${encodeURIComponent('Serveur de demo injoignable, reessaie dans un instant.')}`,
      )
    }
  }

  // ------------------------------------------------------------------
  // Mode reel : le navigateur doit visiter discord.com (page d'autorisation).
  // redirect_uri est absolu (exige par Discord) et calcule avec le proto public correct.
  // ------------------------------------------------------------------
  const authorizeUrl = buildAuthorizeUrl(config.clientId, redirectUri, state)
  return setAuthCookie(NextResponse.redirect(authorizeUrl))
}
