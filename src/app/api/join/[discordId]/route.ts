import { db } from '@/lib/db'
import { getClientIp, isSnowflake, rateLimit, rateLimitHeaders } from '@/lib/security'
import { recordClick } from '@/lib/clicks'

type Params = { params: Promise<{ discordId: string }> }

/**
 * GET /api/join/[discordId] -> redirection 302 publique vers l'invitation Discord actuelle.
 * Cible du bouton « Rejoindre » de la page de partage /s/[discordId] : aucune authentification,
 * lecture en base a chaque appel donc toujours l'invitation valide du dernier refresh.
 * Si aucune invitation n'est disponible (en cours de regeneration), on renvoie vers la page
 * publique qui affiche l'etat et se recharge automatiquement.
 */
export async function GET(req: Request, { params }: Params) {
  const { discordId } = await params
  if (!isSnowflake(discordId)) {
    return new Response(null, {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  }

  const ip = getClientIp(req)
  const limit = rateLimit(`join:${ip}`, 120, 60_000)
  if (!limit.allowed) {
    return Response.json(
      { ok: false, error: 'rate_limited', message: 'Trop de redirections. Reessaie dans un instant.' },
      { status: 429, headers: rateLimitHeaders(limit) },
    )
  }

  const row = await db.guild
    .findFirst({
      where: { discordId, invite: { isNot: null } },
      include: { invite: true },
      orderBy: { lastCheckAt: 'desc' },
    })
    .catch(() => null)

  if (row?.invite) {
    void recordClick(discordId)
    return new Response(null, {
      status: 302,
      headers: {
        Location: `https://discord.gg/${row.invite.code}`,
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Robots-Tag': 'noindex',
        ...rateLimitHeaders(limit),
      },
    })
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: `/s/${discordId}?indisponible=1`,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      ...rateLimitHeaders(limit),
    },
  })
}
