import { db } from '@/lib/db'
import { getSessionUser, isStaffUser } from '@/lib/auth'
import {
  buildBaseUrl,
  buildBotInviteUrl,
  buildRedirectUri,
  getDiscordConfig,
  isDiscordConfigured,
  isMockMode,
} from '@/lib/config'

// GET /api/config -> etat de la configuration de la plateforme (public)
export async function GET(req: Request) {
  const config = await getDiscordConfig()
  return Response.json({
    discordConfigured: isDiscordConfigured(config),
    mockMode: isMockMode(),
    clientId: config.clientId || null,
    // en mode demo, le Discord simule accepte tout : le bot est "virtuellement" configure
    botConfigured: Boolean(config.botToken) || isMockMode(),
    addBotUrl: config.clientId ? buildBotInviteUrl(config.clientId) : null,
    redirectUri: buildRedirectUri(req),
    baseUrl: buildBaseUrl(req),
  })
}

// POST /api/config -> enregistre les identifiants de l'application Discord (+ Bot Token)
// Autorise le premier reglage (bootstrap) sans connexion, puis exige une session staff.
export async function POST(req: Request) {
  let body: { clientId?: string; clientSecret?: string; botToken?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Corps de requete invalide.' }, { status: 400 })
  }

  const clientId = (body.clientId || '').trim()
  const clientSecret = (body.clientSecret || '').trim()
  const botToken = typeof body.botToken === 'string' ? body.botToken.trim() : undefined
  if (!clientId || !clientSecret) {
    return Response.json(
      { error: 'Le Client ID et le Client Secret sont requis.' },
      { status: 400 },
    )
  }

  const current = await getDiscordConfig()
  const alreadyConfigured = isDiscordConfigured(current)
  if (alreadyConfigured) {
    const user = await getSessionUser()
    if (!isStaffUser(user)) {
      return Response.json(
        { error: 'Les reglages sont reserves au staff.' },
        { status: 403 },
      )
    }
  }

  // Verifie les identifiants aupres de Discord (grant client_credentials) AVANT
  // d'enregistrer : sinon l'utilisateur decouvre l'erreur plus tard, au moment de
  // se connecter (401 invalid_client sur l'echange du code).
  if (!isMockMode()) {
    try {
      const check = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'client_credentials',
        }).toString(),
        cache: 'no-store',
      })
      if (!check.ok) {
        // Mauvais Client ID / Secret : Discord repond invalid_client (400 ou 401 selon le cas).
        let discordError = ''
        try {
          discordError = ((await check.json()) as { error?: string })?.error || ''
        } catch {
          // pas de corps JSON
        }
        if (discordError === 'invalid_client') {
          return Response.json(
            {
              error:
                'Discord refuse ces identifiants (invalid_client) : le Client ID ou le Client Secret est incorrect. Copie-les depuis le portail developpeur Discord (Application > OAuth2), sans espace avant/apres, puis reessaie.',
            },
            { status: 400 },
          )
        }
        // Autre erreur Discord (rate limit...) : on enregistre quand meme.
      }
    } catch {
      // Discord injoignable : on enregistre quand meme, l'erreur resurface a la connexion.
    }
  }

  try {
    await db.appConfig.upsert({
      where: { id: 'main' },
      create: {
        id: 'main',
        discordClientId: clientId,
        discordClientSecret: clientSecret,
        discordBotToken: botToken || null,
      },
      update: {
        discordClientId: clientId,
        discordClientSecret: clientSecret,
        // champ envoye seulement si l'utilisateur a saisi quelque chose : sinon on conserve
        ...(botToken !== undefined ? { discordBotToken: botToken || null } : {}),
      },
    })
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'Erreur inconnue'
    const hint = /no such table|does not exist/i.test(detail)
      ? "La base n'est pas initialisee : applique le schema (npm run db:sql | turso db shell <base>, ou colle turso-schema.sql dans la console web Turso)."
      : /no column named discordBotToken|no such column/i.test(detail)
        ? "La colonne du bot n'existe pas encore : applique la migration (console Turso) : ALTER TABLE AppConfig ADD COLUMN discordBotToken TEXT;"
        : 'Verifie TURSO_DATABASE_URL et TURSO_AUTH_TOKEN, puis l\'etat de la base sur /api/health.'
    console.error('[config] echec enregistrement :', detail)
    return Response.json(
      { error: `Ecriture en base impossible : ${detail}. ${hint}` },
      { status: 500 },
    )
  }

  return Response.json({ ok: true, discordConfigured: true })
}
