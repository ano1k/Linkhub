import { db } from '@/lib/db'
import { badgeState, renderBadgeSvg } from '@/lib/badge'
import { daysAgoKey } from '@/lib/clicks'
import { getClientIp, isSnowflake, rateLimit, rateLimitHeaders } from '@/lib/security'

type Params = { params: Promise<{ discordId: string }> }

/**
 * Cache volontairement court et public : un badge est une image destinee a etre
 * integree sur un site tiers, elle doit pouvoir etre mise en cache par un CDN.
 * next.config.ts repasse ce chemin en `public` (apres la regle generale `/api`).
 */
const CACHE = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600'

function svgResponse(svg: string, extra: Record<string, string> = {}): Response {
  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': CACHE,
      'X-Robots-Tag': 'noindex',
      // L'image est concue pour etre integree sur n'importe quel site.
      'Access-Control-Allow-Origin': '*',
      ...extra,
    },
  })
}

/**
 * GET /api/badge/{discordId}.svg
 *
 * Renvoie un badge SVG indiquant si l'invitation du serveur est verifiee, ainsi
 * que le nombre de clics des 7 derniers jours. Aucune authentification : le
 * badge ne revele que des informations deja publiques sur `/s/{discordId}`.
 * Un identifiant inconnu ou invalide renvoie un badge « non verifie » (jamais
 * une erreur) pour ne pas casser une page tierce.
 */
export async function GET(req: Request, { params }: Params) {
  const raw = (await params).discordId ?? ''
  const id = raw.replace(/\.svg$/i, '')

  const rl = rateLimit(`badge:${getClientIp(req)}`, 120, 60_000)
  const rateHeaders = rateLimitHeaders(rl)
  if (!rl.allowed) {
    return svgResponse(renderBadgeSvg('unknown'), {
      ...rateHeaders,
      'Cache-Control': 'no-store',
    })
  }

  if (!isSnowflake(id)) {
    return svgResponse(renderBadgeSvg('unknown'), rateHeaders)
  }

  const row = await db.guild
    .findFirst({
      where: { discordId: id, invite: { isNot: null } },
      select: { lastCheckAt: true, lastCheckStatus: true },
      orderBy: { lastCheckAt: 'desc' },
    })
    .catch(() => null)

  if (!row) {
    return svgResponse(renderBadgeSvg('unknown'), rateHeaders)
  }

  const state = badgeState({ lastCheckStatus: row.lastCheckStatus, lastCheckAt: row.lastCheckAt })

  const clicks = await db.clickStat
    .findMany({
      where: { discordId: id, day: { gte: daysAgoKey(6) } },
      select: { count: true },
    })
    .catch(() => [] as Array<{ count: number }>)

  const total = clicks.reduce((sum, c) => sum + c.count, 0)

  return svgResponse(renderBadgeSvg(state, { count: total }), rateHeaders)
}
