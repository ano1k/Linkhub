import { db } from '@/lib/db'
import { getSessionUser, isStaffUser } from '@/lib/auth'
import { isMockMode } from '@/lib/config'
import { sealSecret } from '@/lib/secrets'
import {
  checkSameOrigin,
  getRequestMeta,
  isValidBotToken,
  rateLimit,
  rateLimitHeaders,
  recordAudit,
} from '@/lib/security'

// POST /api/config/bot -> enregistre le Bot Token (reserve au staff)
// Route dediee : on peut enregistrer le bot sans retaper le Client Secret.
export async function POST(req: Request) {
  const originError = checkSameOrigin(req)
  if (originError) return Response.json({ error: originError }, { status: 403 })

  const user = await getSessionUser()
  if (!user || !isStaffUser(user)) {
    return Response.json({ error: 'Les reglages sont reserves au staff.' }, { status: 403 })
  }

  const meta = getRequestMeta(req)
  const limit = rateLimit(`bot:${user.id}`, 8, 60_000)
  if (!limit.allowed) {
    return Response.json(
      { error: 'Trop de tentatives. Reessaie dans une minute.' },
      { status: 429, headers: rateLimitHeaders(limit) },
    )
  }

  let body: { botToken?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Corps de requete invalide.' }, { status: 400 })
  }

  const botToken = (body.botToken || '').trim()
  if (!botToken) {
    return Response.json({ error: 'Le Bot Token est requis.' }, { status: 400 })
  }
  if (!isMockMode() && !isValidBotToken(botToken)) {
    return Response.json(
      {
        error:
          "Ce Bot Token ne ressemble pas a un token Discord valide (3 segments separe par des points). Copie-le depuis Portail developpeur > Application > Bot > Reset Token.",
      },
      { status: 400 },
    )
  }

  try {
    await db.appConfig.upsert({
      where: { id: 'main' },
      // Token chiffre en base (AES-256-GCM).
      create: { id: 'main', discordBotToken: sealSecret(botToken) },
      update: { discordBotToken: sealSecret(botToken) },
    })
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'Erreur inconnue'
    const hint = /no column named discordBotToken|no such column/i.test(detail)
      ? "La colonne du bot n'existe pas encore : applique la migration (console Turso) : ALTER TABLE AppConfig ADD COLUMN discordBotToken TEXT;"
      : 'Verifie TURSO_DATABASE_URL et TURSO_AUTH_TOKEN, puis l’etat de la base sur /api/health.'
    console.error('[config:bot] echec enregistrement :', detail)
    return Response.json(
      { error: `Ecriture en base impossible : ${detail}. ${hint}` },
      { status: 500 },
    )
  }

  await recordAudit({
    action: 'config.bot.save',
    actorId: user.id,
    actorName: user.username,
    target: 'bot',
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  return Response.json({ ok: true, botConfigured: true })
}
