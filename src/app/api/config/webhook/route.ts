import { getSessionUser, isStaffUser } from '@/lib/auth'
import {
  checkSameOrigin,
  getRequestMeta,
  rateLimit,
  rateLimitHeaders,
  recordAudit,
} from '@/lib/security'
import {
  clearWebhookConfig,
  getWebhookPublicConfig,
  saveWebhookConfig,
  type SaveWebhookInput,
} from '@/lib/webhook'

// GET /api/config/webhook -> statut + reglages du heartbeat (staff uniquement)
export async function GET() {
  const user = await getSessionUser()
  if (!user || !isStaffUser(user)) {
    return Response.json({ error: 'Acces reserve au staff.' }, { status: 403 })
  }
  const config = await getWebhookPublicConfig()
  return Response.json(config, { headers: { 'Cache-Control': 'no-store' } })
}

// POST /api/config/webhook -> enregistre les reglages du heartbeat (staff)
export async function POST(req: Request) {
  const originError = checkSameOrigin(req)
  if (originError) return Response.json({ error: originError }, { status: 403 })

  const user = await getSessionUser()
  if (!user || !isStaffUser(user)) {
    return Response.json({ error: 'Acces reserve au staff.' }, { status: 403 })
  }

  const meta = getRequestMeta(req)
  const limit = rateLimit(`webhook:${user.id}`, 20, 60_000)
  if (!limit.allowed) {
    return Response.json(
      { error: 'Trop de modifications. Reessaie dans une minute.' },
      { status: 429, headers: rateLimitHeaders(limit) },
    )
  }

  let body: SaveWebhookInput
  try {
    body = (await req.json()) as SaveWebhookInput
  } catch {
    return Response.json({ error: 'Corps de requete invalide.' }, { status: 400 })
  }

  try {
    const config = await saveWebhookConfig(body)
    await recordAudit({
      action: 'config.webhook.save',
      actorId: user.id,
      actorName: user.username,
      target: 'webhook',
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: {
        enabled: config.enabled,
        intervalMinutes: config.intervalMinutes,
        configured: config.configured,
      },
    })
    return Response.json(config)
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Enregistrement impossible.' },
      { status: 400 },
    )
  }
}

// DELETE /api/config/webhook -> desactive et efface le webhook (staff)
export async function DELETE(req: Request) {
  const originError = checkSameOrigin(req)
  if (originError) return Response.json({ error: originError }, { status: 403 })

  const user = await getSessionUser()
  if (!user || !isStaffUser(user)) {
    return Response.json({ error: 'Acces reserve au staff.' }, { status: 403 })
  }

  const meta = getRequestMeta(req)
  const config = await clearWebhookConfig()
  await recordAudit({
    action: 'config.webhook.delete',
    actorId: user.id,
    actorName: user.username,
    target: 'webhook',
    ip: meta.ip,
    userAgent: meta.userAgent,
  })
  return Response.json(config)
}
