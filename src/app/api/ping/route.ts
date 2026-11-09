import { APP_VERSION } from '@/lib/config'
import { getClientIp, rateLimit, rateLimitHeaders } from '@/lib/security'

// GET /api/ping -> reponse ultra legere pour les moniteurs de disponibilite.
// (Le heartbeat interne, lui, utilise /api/health qui verifie aussi la base.)
export async function GET(req: Request) {
  const ip = getClientIp(req)
  const limit = rateLimit(`ping:${ip}`, 120, 60_000)
  if (!limit.allowed) {
    return Response.json(
      { ok: false, error: 'rate_limited' },
      { status: 429, headers: rateLimitHeaders(limit) },
    )
  }
  return Response.json(
    { ok: true, time: new Date().toISOString(), version: APP_VERSION },
    { headers: { 'Cache-Control': 'no-store', ...rateLimitHeaders(limit) } },
  )
}
