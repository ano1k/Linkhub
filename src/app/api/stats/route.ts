import { db } from '@/lib/db'
import { getClientIp, rateLimit, rateLimitHeaders } from '@/lib/security'
import { getWebhookPublicConfig } from '@/lib/webhook'

const STATS_TTL_MS = 30_000
let statsCache: { at: number; payload: Record<string, unknown> } | null = null

// GET /api/stats -> chiffres publics agreges (aucune donnee personnelle)
export async function GET(req: Request) {
  const ip = getClientIp(req)
  const limit = rateLimit(`stats:${ip}`, 60, 60_000)
  if (!limit.allowed) {
    return Response.json(
      { ok: false, error: 'rate_limited' },
      { status: 429, headers: rateLimitHeaders(limit) },
    )
  }

  // Chiffres publics : ils bougent au rythme du verificateur (5 min). Un cache
  // memoire de 30 s evite de scanner la table a chaque appel d'un bot ou d'un widget.
  const cached = statsCache && Date.now() - statsCache.at < STATS_TTL_MS ? statsCache.payload : null
  if (cached) {
    return Response.json(cached, { headers: { 'Cache-Control': 'no-store', ...rateLimitHeaders(limit) } })
  }

  const rows = await db.guild
    .findMany({ select: { discordId: true, memberCount: true, onlineCount: true, lastCheckStatus: true } })
    .catch(() => [])
  const seen = new Set<string>()
  let members = 0
  let online = 0
  let errors = 0
  for (const row of rows) {
    if (seen.has(row.discordId)) continue
    seen.add(row.discordId)
    members += row.memberCount ?? 0
    online += row.onlineCount ?? 0
    if (row.lastCheckStatus === 'error') errors += 1
  }
  const webhook = await getWebhookPublicConfig().catch(() => null)

  const payload = {
    ok: true,
    guilds: seen.size,
    members,
    online,
    errors,
    checks: rows.length,
    webhook: webhook
      ? { enabled: webhook.enabled, status: webhook.status, intervalMinutes: webhook.intervalMinutes }
      : null,
    time: new Date().toISOString(),
  }
  statsCache = { at: Date.now(), payload }

  return Response.json(payload, {
    headers: { 'Cache-Control': 'no-store', ...rateLimitHeaders(limit) },
  })
}
