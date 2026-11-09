import { db } from '@/lib/db'
import { isMockMode, APP_VERSION } from '@/lib/config'
import { getClientIp, rateLimit, rateLimitHeaders } from '@/lib/security'
import { getRefresherMetricsFromDb } from '@/lib/refresher'
import { getWebhookPublicConfig } from '@/lib/webhook'

// GET /api/health -> diagnostic d'une instance (public, ne revele rien de sensible).
// Verifie que la base repond et que le schema est applique.
export async function GET(req: Request) {
  const ip = getClientIp(req)
  const limit = rateLimit(`health:${ip}`, 60, 60_000)
  if (!limit.allowed) {
    return Response.json(
      { status: 'error', error: 'rate_limited', time: new Date().toISOString() },
      { status: 429, headers: rateLimitHeaders(limit) },
    )
  }
  const started = Date.now()
  try {
    await db.appConfig.findUnique({ where: { id: '__health__' } })
    const webhook = await getWebhookPublicConfig().catch(() => null)
    return Response.json(
      {
        status: 'ok',
        database: 'ok',
        mockMode: isMockMode(),
        version: APP_VERSION,
        latencyMs: Date.now() - started,
        time: new Date().toISOString(),
        refresher: await getRefresherMetricsFromDb(),
        webhook: webhook
          ? {
              enabled: webhook.enabled,
              configured: webhook.configured,
              status: webhook.status,
              lastSentAt: webhook.lastSentAt,
              lastLatencyMs: webhook.lastLatencyMs,
              successCount: webhook.successCount,
              failureCount: webhook.failureCount,
            }
          : null,
      },
      { headers: { 'Cache-Control': 'no-store', ...rateLimitHeaders(limit) } },
    )
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'Erreur inconnue'
    const hint = /no such table|does not exist/i.test(detail)
      ? "Le schema n'est pas applique : npm run db:sql | turso db shell <base>, ou colle turso-schema.sql dans la console web Turso."
      : 'Verifie TURSO_DATABASE_URL et TURSO_AUTH_TOKEN.'
    console.error('[health] base indisponible :', detail)
    return Response.json(
      {
        status: 'error',
        database: 'error',
        detail,
        hint,
        version: APP_VERSION,
        time: new Date().toISOString(),
      },
      { status: 500, headers: { 'Cache-Control': 'no-store', ...rateLimitHeaders(limit) } },
    )
  }
}
