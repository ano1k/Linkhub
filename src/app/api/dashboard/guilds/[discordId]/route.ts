import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { ensureAccessToken } from '@/lib/refresher'
import { createChannelInvite, fetchInviteMeta } from '@/lib/discord'

type Params = { params: Promise<{ discordId: string }> }

// PATCH /api/dashboard/guilds/[discordId]
// body: { action: "setChannel" | "regenerate", channelId?, channelName? }
export async function PATCH(req: Request, { params }: Params) {
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Non connecte.' }, { status: 401 })

  const { discordId } = await params
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
    channelName = (body.channelName || '').trim() || null
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

  const invite = await createChannelInvite(token, channelId).catch((e) =>
    Promise.reject(
      new Error(
        `Impossible de creer l'invitation (${e instanceof Error ? e.message : 'erreur Discord'}).`,
      ),
    ),
  )

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

  return Response.json({
    guild: {
      discordId: updated.discordId,
      name: updated.name,
      inviteUrl: `https://discord.gg/${updated.invite?.code}`,
      channelId: updated.channelId,
      channelName: updated.channelName,
      lastCheckStatus: updated.lastCheckStatus,
      lastCheckMsg: updated.lastCheckMsg,
    },
  })
}

// DELETE /api/dashboard/guilds/[discordId] -> arrete le partage
export async function DELETE(_req: Request, { params }: Params) {
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Non connecte.' }, { status: 401 })

  const { discordId } = await params
  const row = await db.guild.findUnique({
    where: { discordId_ownerId: { discordId, ownerId: user.id } },
  })
  if (!row) return Response.json({ error: 'Serveur non trouve.' }, { status: 404 })

  await db.guild.delete({ where: { id: row.id } })
  return Response.json({ ok: true })
}
