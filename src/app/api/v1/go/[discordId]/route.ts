import { db } from '@/lib/db'
import { authenticateApiKey, apiError, CORS_HEADERS } from '@/lib/apiKeys'

type Params = { params: Promise<{ discordId: string }> }

// GET /api/v1/go/[discordId] -> redirige directement vers le Discord (ideal pour un bouton <a>)
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

  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://discord.gg/${row.invite.code}`,
      'Cache-Control': 'no-store',
      ...CORS_HEADERS,
    },
  })
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
