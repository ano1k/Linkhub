import { db } from '@/lib/db'
import { getSessionUser, isStaffUser } from '@/lib/auth'
import {
  APP_VERSION,
  buildBaseUrl,
  buildBotInviteUrl,
  buildRedirectUri,
  getDiscordConfig,
  isDiscordConfigured,
  isMockMode,
} from '@/lib/config'
import { getWebhookPublicConfig } from '@/lib/webhook'
import { evaluateConfigWriteAccess } from '@/lib/setup'
import { sealSecret } from '@/lib/secrets'
import {
  checkSameOrigin,
  getRequestMeta,
  isSnowflake,
  rateLimit,
  rateLimitHeaders,
  recordAudit,
  sanitizeText,
  getClientIp,
} from '@/lib/security'

// GET /api/config -> etat de la configuration de la plateforme (public, sans secret)
export async function GET(req: Request) {
  const ip = getClientIp(req)
  const limit = rateLimit(`config:${ip}`, 60, 60_000)
  if (!limit.allowed) {
    return Response.json(
      { error: 'Trop de requetes. Reessaie dans un instant.' },
      { status: 429, headers: rateLimitHeaders(limit) },
    )
  }
  const config = await getDiscordConfig()
  const webhook = await getWebhookPublicConfig().catch(() => null)
  return Response.json(
    {
      discordConfigured: isDiscordConfigured(config),
      mockMode: isMockMode(),
      clientId: config.clientId || null,
      // en mode demo, le Discord simule accepte tout : le bot est "virtuellement" configure
      botConfigured: Boolean(config.botToken) || isMockMode(),
      addBotUrl: config.clientId ? buildBotInviteUrl(config.clientId) : null,
      redirectUri: buildRedirectUri(req),
      baseUrl: buildBaseUrl(req),
      version: APP_VERSION,
      // L'UI affiche le champ « jeton d'installation » quand la variable existe.
      setupTokenRequired: Boolean((process.env.SETUP_TOKEN || '').trim()),
      webhook: webhook
        ? {
            configured: webhook.configured,
            enabled: webhook.enabled,
            intervalMinutes: webhook.intervalMinutes,
            status: webhook.status,
            lastSentAt: webhook.lastSentAt,
            lastLatencyMs: webhook.lastLatencyMs,
            successCount: webhook.successCount,
            failureCount: webhook.failureCount,
          }
        : null,
    },
    { headers: { 'Cache-Control': 'no-store', ...rateLimitHeaders(limit) } },
  )
}

// POST /api/config -> enregistre les identifiants de l'application Discord (+ Bot Token)
// Autorise le premier reglage (bootstrap) sans connexion, puis exige une session staff.
export async function POST(req: Request) {
  const originError = checkSameOrigin(req)
  if (originError) {
    return Response.json({ error: originError }, { status: 403 })
  }

  const meta = getRequestMeta(req)
  const limit = rateLimit(`config:${meta.ip}`, 12, 60_000)
  if (!limit.allowed) {
    return Response.json(
      { error: 'Trop de tentatives. Reessaie dans une minute.' },
      { status: 429, headers: rateLimitHeaders(limit) },
    )
  }

  let body: { clientId?: string; clientSecret?: string; botToken?: string; setupToken?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Corps de requete invalide.' }, { status: 400 })
  }

  const clientId = sanitizeText(body.clientId, 40)
  const clientSecret = sanitizeText(body.clientSecret, 200)
  const botToken = typeof body.botToken === 'string' ? body.botToken.trim() : undefined
  if (!clientId || !clientSecret) {
    return Response.json(
      { error: 'Le Client ID et le Client Secret sont requis.' },
      { status: 400 },
    )
  }
  if (!isSnowflake(clientId)) {
    return Response.json(
      { error: "Le Client ID doit etre l'identifiant Discord de l'application (17 a 20 chiffres)." },
      { status: 400 },
    )
  }
  if (clientSecret.length < 20) {
    return Response.json({ error: 'Le Client Secret semble incomplet.' }, { status: 400 })
  }

  const current = await getDiscordConfig()
  const alreadyConfigured = isDiscordConfigured(current)
  const user = await getSessionUser()

  const access = evaluateConfigWriteAccess({
    alreadyConfigured,
    isStaff: isStaffUser(user),
    providedToken:
      (typeof body.setupToken === 'string' ? body.setupToken.trim() : '') ||
      (req.headers.get('x-setup-token') || '').trim(),
    expectedToken: (process.env.SETUP_TOKEN || '').trim(),
    staffConfigured: Boolean((process.env.STAFF_DISCORD_IDS || '').trim()),
  })
  if (!access.ok) {
    return Response.json({ error: access.error }, { status: access.status })
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
        signal: AbortSignal.timeout(10_000),
      })
      if (!check.ok) {
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
        // Secrets chiffres en base (AES-256-GCM, cle derivee de APP_SECRET).
        discordClientSecret: sealSecret(clientSecret),
        discordBotToken: sealSecret(botToken || null),
      },
      update: {
        discordClientId: clientId,
        discordClientSecret: sealSecret(clientSecret),
        // champ envoye seulement si l'utilisateur a saisi quelque chose : sinon on conserve
        ...(botToken !== undefined ? { discordBotToken: sealSecret(botToken || null) } : {}),
      },
    })
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'Erreur inconnue'
    const hint = /no such table|does not exist/i.test(detail)
      ? "La base n'est pas initialisee : applique le schema (npm run db:sql | turso db shell <base>, ou colle turso-schema.sql dans la console web Turso)."
      : /no column named discordBotToken|no such column/i.test(detail)
        ? "La colonne du bot n'existe pas encore : applique la migration (console Turso) : ALTER TABLE AppConfig ADD COLUMN discordBotToken TEXT;"
        : 'Verifie TURSO_DATABASE_URL et TURSO_AUTH_TOKEN, puis l’etat de la base sur /api/health.'
    console.error('[config] echec enregistrement :', detail)
    return Response.json(
      { error: `Ecriture en base impossible : ${detail}. ${hint}` },
      { status: 500 },
    )
  }

  await recordAudit({
    action: 'config.discord.save',
    actorId: user?.id,
    actorName: user?.username,
    target: clientId,
    ip: meta.ip,
    userAgent: meta.userAgent,
    metadata: {
      botToken: botToken ? 'fourni' : 'conserve',
      // Trace le mode d'autorisation (bootstrap ouvert, jeton ou staff).
      authorization: access.via,
    },
  })

  return Response.json({ ok: true, discordConfigured: true })
}
