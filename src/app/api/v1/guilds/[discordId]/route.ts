import { db } from '@/lib/db'
import { authenticateApiKey, apiJson, apiError, CORS_HEADERS } from '@/lib/apiKeys'
import { guildIconUrl } from '@/lib/discord'
import { buildBaseUrl } from '@/lib/config'

type Params = { params: Promise<{ discordId: string }> }

// GET /api/v1/guilds/[discordId] -> un serveur precise
export async function GET(req: Request, { params }: Params) {
  const auth = await authenticateApiKey(req)
  if (!auth.ok) return apiError(auth.status, auth.error, auth.message)

  const { discordId } = await params
  const row = await db.guild.findFirst({
    where: { discordId, ownerId: auth.apiKey.userId },
    include: { invite: true },
  })

  if (!row || !row.invite) {
    return apiError(404, 'guild_not_found', 'Aucun serveur partage avec cet identifiant.')
  }

  const baseUrl = buildBaseUrl(req)
  return apiJson({
    ok: true,
    guild: {
      id: row.discordId,
      name: row.name,
      icon: guildIconUrl(row.discordId, row.icon),
      invite_url: `https://discord.gg/${row.invite.code}`,
      invite_url_direct: `${baseUrl}/api/v1/go/${row.discordId}?key=${auth.apiKey.key}`,
      members: row.memberCount,
      online: row.onlineCount,
      last_check: row.lastCheckAt,
    },
  })
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
