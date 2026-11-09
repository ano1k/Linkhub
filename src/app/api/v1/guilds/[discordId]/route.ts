import { createHash } from 'crypto'
import { db } from '@/lib/db'
import { authenticateApiKey, apiJson, apiError, CORS_HEADERS, buildDirectGoUrl } from '@/lib/apiKeys'
import { guildIconUrl } from '@/lib/discord'
import { buildBaseUrl } from '@/lib/config'
import { isSnowflake, rateLimitHeaders } from '@/lib/security'

type Params = { params: Promise<{ discordId: string }> }

// GET /api/v1/guilds/[discordId] -> un serveur precise
export async function GET(req: Request, { params }: Params) {
  const auth = await authenticateApiKey(req)
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

  const baseUrl = buildBaseUrl(req)
  const guild = {
    id: row.discordId,
    name: row.name,
    icon: guildIconUrl(row.discordId, row.icon),
    invite_url: `https://discord.gg/${row.invite.code}`,
    invite_url_direct: buildDirectGoUrl(baseUrl, row.discordId, auth.apiKey),
    members: row.memberCount,
    online: row.onlineCount,
    uses: row.invite.uses,
    last_check: row.lastCheckAt,
    last_check_latency_ms: row.lastCheckLatencyMs,
    last_check_status: row.lastCheckStatus,
  }

  const etag = `"${createHash('sha256')
    .update(JSON.stringify(guild))
    .digest('hex')}"`
  if (req.headers.get('if-none-match') === etag) {
    return new Response(null, {
      status: 304,
      headers: { ETag: etag, 'Cache-Control': 'no-store', ...CORS_HEADERS, ...rateLimitHeaders(auth.rateLimit) },
    })
  }

  return apiJson({ ok: true, guild }, 200, {
    ETag: etag,
    'Cache-Control': 'no-store',
    ...rateLimitHeaders(auth.rateLimit),
  })
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
