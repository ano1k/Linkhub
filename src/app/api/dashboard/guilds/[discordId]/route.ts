import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { ensureAccessToken } from '@/lib/refresher'
import { fetchInviteMeta } from '@/lib/discord'
import { createInviteSmart, inviteErrorResponse } from '@/lib/invite-service'
import {
  checkSameOrigin,
  getRequestMeta,
  isSnowflake,
  rateLimit,
  rateLimitHeaders,
  recordAudit,
  sanitizeText,
} from '@/lib/security'

type Params = { params: Promise<{ discordId: string }> }

// PATCH /api/dashboard/guilds/[discordId]
// body: { action: "setChannel" | "regenerate", channelId?, channelName? }
export async function PATCH(req: Request, { params }: Params) {
  try {
    return await patchGuild(req, { params })
  } catch (e) {
    // Jamais de corps vide : le client doit toujours recevoir un JSON exploitable
    const detail = e instanceof Error ? e.message : 'Erreur inconnue'
    console.error('[guilds:patch]', detail)
    return Response.json({ error: `Mise a jour impossible : ${detail}` }, { status: 500 })
  }
}

async function patchGuild(req: Request, { params }: Params) {
  const originError = checkSameOrigin(req)
  if (originError) return Response.json({ error: originError }, { status: 403 })

  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Non connecte.' }, { status: 401 })

  const { discordId } = await params
  if (!isSnowflake(discordId)) {
    return Response.json({ error: 'Identifiant de serveur invalide.' }, { status: 400 })
  }

  const meta = getRequestMeta(req)
  const limit = rateLimit(`guild-patch:${user.id}`, 20, 60_000)
  if (!limit.allowed) {
    return Response.json(
      { error: 'Trop de modifications. Reessaie dans une minute.' },
      { status: 429, headers: rateLimitHeaders(limit) },
    )
  }

  const row = await db.guild.findUnique({
    where: { discordId_ownerId: { discordId, ownerId: user.id } },
    include: { invite: true },
  })
  if (!row) return Response.json({ error: 'Serveur non trouve.' }, { status: 404 })

  let body: { action?: string; channelId?: string; channelName?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Corps de requete invalide.' }, { status: 400 })
  }

  const token = await ensureAccessToken(user).catch(() => null)
  if (!token) {
    return Response.json({ error: 'Session Discord expiree.', needsReauth: true }, { status: 401 })
  }

  let channelId = row.channelId
  let channelName = row.channelName

  if (body.action === 'setChannel') {
    channelId = (body.channelId || '').trim() || null
    channelName = sanitizeText(body.channelName, 100) || null
    if (!channelId) {
      return Response.json({ error: 'Choisis un salon texte.' }, { status: 400 })
    }
  }

  if (!channelId) {
    return Response.json(
      { error: 'Aucun salon configure pour ce serveur.' },
      { status: 400 },
    )
  }

  // Cree l'invitation permanente (via le bot du serveur ; erreur explicite si Discord refuse)
  let invite
  try {
    invite = await createInviteSmart(discordId, channelId)
  } catch (e) {
    const resp = inviteErrorResponse(e)
    if (resp) return resp
    throw e
  }

  await db.invite.upsert({
    where: { guildId: row.id },
    create: { guildId: row.id, code: invite.code, uses: invite.uses ?? 0 },
    update: { code: invite.code, uses: invite.uses ?? 0 },
  })

  const updated = await db.guild.update({
    where: { id: row.id },
    data: {
      channelId,
      channelName,
      lastCheckAt: new Date(),
      lastCheckStatus: 'refreshed',
      lastCheckMsg: 'Invitation regeneree.',
    },
    include: { invite: true },
  })

  try {
    const meta = await fetchInviteMeta(invite.code)
    await db.guild.update({
      where: { id: row.id },
      data: {
        memberCount: meta.approximate_member_count ?? null,
        onlineCount: meta.approximate_presence_count ?? null,
      },
    })
  } catch {
    // pas bloquant
  }

  await recordAudit({
    action: 'guild.update',
    actorId: user.id,
    actorName: user.username,
    target: discordId,
    ip: meta.ip,
    userAgent: meta.userAgent,
    metadata: { action: body.action, channelId, channelName },
  })

  return Response.json(
    {
      guild: {
        discordId: updated.discordId,
        name: updated.name,
        inviteUrl: `https://discord.gg/${updated.invite?.code}`,
        channelId: updated.channelId,
        channelName: updated.channelName,
        lastCheckStatus: updated.lastCheckStatus,
        lastCheckMsg: updated.lastCheckMsg,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

// DELETE /api/dashboard/guilds/[discordId] -> arrete le partage
export async function DELETE(req: Request, { params }: Params) {
  try {
    return await deleteGuild(req, { params })
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'Erreur inconnue'
    console.error('[guilds:delete]', detail)
    return Response.json({ error: `Suppression impossible : ${detail}` }, { status: 500 })
  }
}

async function deleteGuild(req: Request, { params }: Params) {
  const originError = checkSameOrigin(req)
  if (originError) return Response.json({ error: originError }, { status: 403 })

  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Non connecte.' }, { status: 401 })

  const { discordId } = await params
  if (!isSnowflake(discordId)) {
    return Response.json({ error: 'Identifiant de serveur invalide.' }, { status: 400 })
  }
  const row = await db.guild.findUnique({
    where: { discordId_ownerId: { discordId, ownerId: user.id } },
  })
  if (!row) return Response.json({ error: 'Serveur non trouve.' }, { status: 404 })

  await db.guild.delete({ where: { id: row.id } })
  const meta = getRequestMeta(req)
  await recordAudit({
    action: 'guild.remove',
    actorId: user.id,
    actorName: user.username,
    target: discordId,
    ip: meta.ip,
    userAgent: meta.userAgent,
  })
  return Response.json({ ok: true })
}
