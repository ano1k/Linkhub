import { db } from '@/lib/db'
import { authenticateApiKey, apiJson, apiError, CORS_HEADERS } from '@/lib/apiKeys'
import { guildIconUrl } from '@/lib/discord'
import { buildBaseUrl } from '@/lib/config'

// GET /api/v1/guilds -> liste des serveurs partages par le proprietaire de la cle
export async function GET(req: Request) {
  const auth = await authenticateApiKey(req)
  if (!auth.ok) return apiError(auth.status, auth.error, auth.message)

  const rows = await db.guild.findMany({
    where: { ownerId: auth.apiKey.userId },
    include: { invite: true },
    orderBy: { createdAt: 'asc' },
  })

  const baseUrl = buildBaseUrl(req)
  const guilds = rows
    .filter((r) => r.invite)
    .map((r) => ({
      id: r.discordId,
      name: r.name,
      icon: guildIconUrl(r.discordId, r.icon),
      invite_url: `https://discord.gg/${r.invite!.code}`,
      invite_url_direct: `${baseUrl}/api/v1/go/${r.discordId}?key=${auth.apiKey.key}`,
      members: r.memberCount,
      online: r.onlineCount,
      last_check: r.lastCheckAt,
    }))

  return apiJson({
    ok: true,
    count: guilds.length,
    guilds,
  })
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
