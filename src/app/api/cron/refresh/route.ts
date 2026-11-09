import { runRefreshCycleLocked } from '@/lib/refresher'
import { sendWebhookPing } from '@/lib/webhook'
import { getClientIp, rateLimit, rateLimitHeaders, safeEqual } from '@/lib/security'

export const dynamic = 'force-dynamic'

/**
 * POST/GET /api/cron/refresh
 *
 * Point d'entree des taches planifiees : un cron externe (Vercel Cron, Render
 * Cron Job, cron-job.org, `curl` depuis un serveur) appelle cette route toutes
 * les 5 minutes. Elle verifie les invitations par lots et envoie le heartbeat
 * Discord si son intervalle est echu.
 *
 * Authentification : `CRON_SECRET` (variable d'environnement), fourni via
 *   - `Authorization: Bearer <secret>` (format attendu par Vercel Cron),
 *   - `X-Cron-Secret: <secret>`,
 *   - ou `?secret=<secret>` (pratique pour un cron simple).
 *
 * Le verrou distribue (`JobLock`) garantit qu'une seule instance execute le
 * cycle, meme si l'intervalle interne tourne aussi.
 */
async function handle(req: Request): Promise<Response> {
  const expected = (process.env.CRON_SECRET || '').trim()
  if (!expected) {
    return Response.json(
      {
        ok: false,
        error: 'cron_not_configured',
        message:
          "Definis la variable d'environnement CRON_SECRET pour activer ce point d'entree.",
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const ip = getClientIp(req)
  const limit = rateLimit(`cron:${ip}`, 12, 60_000)
  if (!limit.allowed) {
    return Response.json(
      { ok: false, error: 'rate_limited' },
      { status: 429, headers: { 'Cache-Control': 'no-store', ...rateLimitHeaders(limit) } },
    )
  }

  const provided = extractSecret(req)
  if (!provided || !safeEqual(provided, expected)) {
    return Response.json(
      { ok: false, error: 'unauthorized' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const result = await runRefreshCycleLocked('cron')
  // Le heartbeat Discord a son propre intervalle (`isWebhookDue`) : on le tente a
  // chaque appel, meme si une autre instance tient le verrou du cycle. Sinon, en
  // serverless (pas de boucle interne), le ping Discord sautait un appel sur deux
  // et n'arrivait donc pas toutes les 5 minutes.
  const heartbeat = await sendWebhookPing({ trigger: 'cron' }).catch(() => null)

  return Response.json(
    { ok: true, ran: result.ran, metrics: result.metrics, heartbeat },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

function extractSecret(req: Request): string {
  const authorization = req.headers.get('authorization') || ''
  if (authorization.toLowerCase().startsWith('bearer ')) return authorization.slice(7).trim()
  const header = req.headers.get('x-cron-secret')
  if (header) return header.trim()
  try {
    return (new URL(req.url).searchParams.get('secret') || '').trim()
  } catch {
    return ''
  }
}

export async function GET(req: Request): Promise<Response> {
  return handle(req)
}

export async function POST(req: Request): Promise<Response> {
  return handle(req)
}
