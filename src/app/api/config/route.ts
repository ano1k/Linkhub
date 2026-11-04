import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import {
  buildBaseUrl,
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
    redirectUri: buildRedirectUri(req),
    baseUrl: buildBaseUrl(req),
  })
}

// POST /api/config -> enregistre les identifiants de l'application Discord
// Autorise le premier reglage (bootstrap) sans connexion, puis exige une session.
export async function POST(req: Request) {
  let body: { clientId?: string; clientSecret?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Corps de requete invalide.' }, { status: 400 })
  }

  const clientId = (body.clientId || '').trim()
  const clientSecret = (body.clientSecret || '').trim()
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
    if (!user) {
      return Response.json(
        { error: 'La plateforme est deja configuree : connecte-toi pour modifier les reglages.' },
        { status: 403 },
      )
    }
  }

  await db.appConfig.upsert({
    where: { id: 'main' },
    create: { id: 'main', discordClientId: clientId, discordClientSecret: clientSecret },
    update: { discordClientId: clientId, discordClientSecret: clientSecret },
  })

  return Response.json({ ok: true, discordConfigured: true })
}
