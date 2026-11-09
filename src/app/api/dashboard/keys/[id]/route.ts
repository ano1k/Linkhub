import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import {
  checkSameOrigin,
  getRequestMeta,
  rateLimit,
  rateLimitHeaders,
  recordAudit,
} from '@/lib/security'

type Params = { params: Promise<{ id: string }> }

// DELETE /api/dashboard/keys/[id] -> supprime une cle (revocation immediate)
export async function DELETE(req: Request, { params }: Params) {
  const originError = checkSameOrigin(req)
  if (originError) return Response.json({ error: originError }, { status: 403 })

  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Non connecte.' }, { status: 401 })

  const limit = rateLimit(`keys-delete:${user.id}`, 20, 60_000)
  if (!limit.allowed) {
    return Response.json(
      { error: 'Trop de suppressions. Reessaie dans une minute.' },
      { status: 429, headers: rateLimitHeaders(limit) },
    )
  }

  const { id } = await params
  const key = await db.apiKey.findUnique({ where: { id } })
  if (!key || key.userId !== user.id) {
    return Response.json({ error: 'Cle non trouvee.' }, { status: 404 })
  }
  await db.apiKey.delete({ where: { id } })

  const meta = getRequestMeta(req)
  await recordAudit({
    action: 'apikey.delete',
    actorId: user.id,
    actorName: user.username,
    target: id,
    ip: meta.ip,
    userAgent: meta.userAgent,
    metadata: { name: key.name, keyPrefix: key.keyPrefix },
  })

  return Response.json({ ok: true })
}
