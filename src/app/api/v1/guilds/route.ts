import { createHash } from 'crypto'
import { db } from '@/lib/db'
import { authenticateApiKey, apiJson, apiError, CORS_HEADERS, buildDirectGoUrl } from '@/lib/apiKeys'
import { rateLimitHeaders } from '@/lib/security'
import { guildIconUrl } from '@/lib/discord'
import { buildBaseUrl } from '@/lib/config'
import { paginateByCursor, parsePageQuery } from '@/lib/pagination'

/**
 * Identifiant de correlation : on honore celui fourni par le client, sinon on en
 * genere un seul par requete (il doit etre identique dans l'en-tete et dans le JSON).
 */
function requestId(req: Request): string {
  return req.headers.get('x-request-id') || crypto.randomUUID()
}

type ApiGuild = {
  id: string
  name: string
  icon: string | null
  invite_url: string
  invite_url_direct: string
  members: number | null
  online: number | null
  uses: number
  last_check: Date | null
  last_check_latency_ms: number | null
  last_check_status: string | null
}

// GET /api/v1/guilds -> liste des serveurs partages par le proprietaire de la cle
export async function GET(req: Request) {
  const auth = await authenticateApiKey(req)
  if (!auth.ok) return apiError(auth.status, auth.error, auth.message, auth.headers)

  // Calcule une seule fois : la meme valeur sert dans l'en-tete et dans le corps.
  const rid = requestId(req)

  const rows = await db.guild.findMany({
    where: { ownerId: auth.apiKey.userId },
    include: { invite: true },
    orderBy: { createdAt: 'asc' },
  })

  const baseUrl = buildBaseUrl(req)
  const guilds: ApiGuild[] = rows
    .filter((r) => r.invite)
    .map((r) => ({
      id: r.discordId,
      name: r.name,
      icon: guildIconUrl(r.discordId, r.icon),
      invite_url: `https://discord.gg/${r.invite!.code}`,
      invite_url_direct: buildDirectGoUrl(baseUrl, r.discordId, auth.apiKey),
      members: r.memberCount,
      online: r.onlineCount,
      uses: r.invite!.uses,
      last_check: r.lastCheckAt,
      last_check_latency_ms: r.lastCheckLatencyMs,
      last_check_status: r.lastCheckStatus,
    }))

  // Pagination par curseur : par defaut 50 serveurs, 200 au maximum.
  const pageQuery = parsePageQuery(req.url)
  const page = paginateByCursor(guilds, pageQuery, (guild) => guild.id)

  // L'ETag porte sur la page servie : deux pages differentes ont deux ETags.
  const etag = `"${createHash('sha256')
    .update(
      JSON.stringify({
        page: page.items.map((g) => [g.id, g.invite_url, g.members, g.online, g.last_check]),
        next: page.nextCursor,
      }),
    )
    .digest('hex')}"`

  // L'ETag permet au client de revalider lui-meme (304 sans corps). On garde
  // volontairement `no-store` : une reponse mise en cache pourrait servir une
  // invitation qui vient d'etre regeneree, alors que la promesse du service est
  // justement un lien toujours valide.
  if (req.headers.get('if-none-match') === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        'Cache-Control': 'no-store',
        'X-Request-Id': rid,
        ...CORS_HEADERS,
        ...rateLimitHeaders(auth.rateLimit),
      },
    })
  }

  return apiJson(
    {
      ok: true,
      count: page.items.length,
      total: guilds.length,
      guilds: page.items,
      meta: {
        request_id: rid,
        limit: pageQuery.limit,
        has_more: page.hasMore,
        next_cursor: page.nextCursor,
        rate_limit: auth.rateLimit.limit,
        rate_remaining: auth.rateLimit.remaining,
        rate_reset: Math.floor(auth.rateLimit.resetAt / 1000),
      },
    },
    200,
    {
      ETag: etag,
      'Cache-Control': 'no-store',
      'X-Request-Id': rid,
      ...rateLimitHeaders(auth.rateLimit),
    },
  )
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
