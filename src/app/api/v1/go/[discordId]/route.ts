import { db } from '@/lib/db'
import { authenticateGoRequest, apiError, CORS_HEADERS } from '@/lib/apiKeys'
import { isSnowflake, rateLimitHeaders } from '@/lib/security'
import { recordClick } from '@/lib/clicks'

type Params = { params: Promise<{ discordId: string }> }

// GET /api/v1/go/[discordId] -> redirige directement vers le Discord (ideal pour un bouton <a>)
// Accepte ?ref=<jeton public> (recommande) ou ?key=<cle API> (compatibilite).
export async function GET(req: Request, { params }: Params) {
  const auth = await authenticateGoRequest(req)
  if (!auth.ok) return apiError(auth.status, auth.error, auth.message, auth.headers)

  const { discordId } = await params
  if (!isSnowflake(discordId)) {
    return apiError(400, 'invalid_discord_id', 'Identifiant de serveur invalide.', auth.headers)
  }

  const row = await db.guild.findFirst({
    where: { discordId, ownerId: auth.apiKey.userId },
    include: { invite: true },
  })

  if (!row || !row.invite) {
    return apiError(404, 'guild_not_found', 'Aucun serveur partage avec cet identifiant.', auth.headers)
  }

  // Statistiques : incrementation non bloquante, jamais d'erreur remontee.
  void recordClick(discordId)

  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://discord.gg/${row.invite.code}`,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex',
      ...CORS_HEADERS,
      ...rateLimitHeaders(auth.rateLimit),
    },
  })
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
