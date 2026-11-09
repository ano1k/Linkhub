import { clearSessionCookie, revokeAllSessions } from '@/lib/auth'
import { redirectRaw } from '@/lib/config'
import { getSessionUser } from '@/lib/auth'
import { getRequestMeta, recordAudit } from '@/lib/security'

// POST /api/auth/logout -> deconnexion (utilise par le tableau de bord)
// Body optionnel `{ "all": true }` : revoque aussi toutes les autres sessions.
export async function POST(req: Request) {
  const user = await getSessionUser()
  const body = (await req.json().catch(() => null)) as { all?: boolean } | null
  const revokeAll = body?.all === true

  const res = redirectRaw('/')
  clearSessionCookie(res, req)
  if (user) {
    const meta = getRequestMeta(req)
    let newVersion: number | null = null
    if (revokeAll) {
      newVersion = await revokeAllSessions(user.id).catch(() => null)
    }
    await recordAudit({
      action: revokeAll ? 'auth.logout.all' : 'auth.logout',
      actorId: user.id,
      actorName: user.username,
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: newVersion === null ? null : { sessionVersion: newVersion },
    })
  }
  return res
}

// GET /api/auth/logout -> deconnexion directe par lien
export async function GET(req: Request) {
  const user = await getSessionUser()
  const res = redirectRaw('/')
  clearSessionCookie(res, req)
  if (user) {
    const meta = getRequestMeta(req)
    await recordAudit({
      action: 'auth.logout',
      actorId: user.id,
      actorName: user.username,
      ip: meta.ip,
      userAgent: meta.userAgent,
    })
  }
  return res
}
