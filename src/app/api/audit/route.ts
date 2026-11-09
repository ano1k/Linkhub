import { db } from '@/lib/db'
import { getSessionUser, isStaffUser } from '@/lib/auth'
import { rateLimit, rateLimitHeaders } from '@/lib/security'

// GET /api/audit -> journal de securite (staff uniquement)
export async function GET(req: Request) {
  const user = await getSessionUser()
  if (!user || !isStaffUser(user)) {
    return Response.json({ error: 'Acces reserve au staff.' }, { status: 403 })
  }

  const limit = rateLimit(`audit:${user.id}`, 30, 60_000)
  if (!limit.allowed) {
    return Response.json(
      { error: 'Trop de requetes.' },
      { status: 429, headers: rateLimitHeaders(limit) },
    )
  }

  const url = new URL(req.url)
  const take = Math.min(100, Math.max(5, Number(url.searchParams.get('limit')) || 20))
  const events = await db.auditEvent
    .findMany({ orderBy: { createdAt: 'desc' }, take })
    .catch(() => [])

  return Response.json(
    {
      events: events.map((e) => ({
        id: e.id,
        action: e.action,
        actorName: e.actorName,
        actorId: e.actorId,
        target: e.target,
        ip: e.ip,
        userAgent: e.userAgent,
        metadata: e.metadata,
        createdAt: e.createdAt.toISOString(),
      })),
    },
    { headers: { 'Cache-Control': 'no-store', ...rateLimitHeaders(limit) } },
  )
}
