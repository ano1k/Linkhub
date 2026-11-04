import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { ensureAccessToken } from '@/lib/refresher'
import {
  canCreateInvites,
  fetchInviteMeta,
  fetchUserGuilds,
  guildIconUrl,
  isAdministrator,
  type DiscordGuild,
} from '@/lib/discord'
import { getDiscordConfig, isMockMode } from '@/lib/config'
import { createInviteSmart, inviteErrorResponse } from '@/lib/invite-service'

function serializeShared(
  row: Awaited<ReturnType<typeof db.guild.findFirst>> & { invite: { code: string; uses: number } | null },
  dGuild: DiscordGuild | null,
) {
  return {
    discordId: row.discordId,
    name: dGuild?.name ?? row.name,
    iconUrl: guildIconUrl(row.discordId, dGuild?.icon ?? row.icon),
    isAdmin: dGuild ? isAdministrator(dGuild) : null,
    accessible: !!dGuild,
    shared: true,
    channelId: row.channelId,
    channelName: row.channelName,
    memberCount: row.memberCount,
    onlineCount: row.onlineCount,
    inviteCode: row.invite?.code ?? null,
    inviteUrl: row.invite ? `https://discord.gg/${row.invite.code}` : null,
    uses: row.invite?.uses ?? 0,
    lastCheckAt: row.lastCheckAt,
    lastCheckStatus: row.lastCheckStatus,
    lastCheckMsg: row.lastCheckMsg,
  }
}

// GET /api/dashboard/guilds -> serveurs eligibles (admin / droits d'invitation) + etat de partage
export async function GET() {
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Non connecte.' }, { status: 401 })

  let token: string | null = null
  try {
    token = await ensureAccessToken(user)
  } catch {
    token = null
  }
  if (!token) {
    return Response.json(
      { error: 'Session Discord expiree.', needsReauth: true },
      { status: 401 },
    )
  }

  const dGuilds = await fetchUserGuilds(token)
  const eligible = dGuilds.filter(canCreateInvites)
  const rows = await db.guild.findMany({
    where: { ownerId: user.id },
    include: { invite: true },
  })
  const dById = new Map(eligible.map((g) => [g.id, g]))

  const guilds = rows.map((row) => serializeShared(row, dById.get(row.discordId) ?? null))

  const sharedIds = new Set(rows.map((r) => r.discordId))
  const available = eligible
    .filter((g) => !sharedIds.has(g.id))
    .map((g) => ({
      discordId: g.id,
      name: g.name,
      iconUrl: guildIconUrl(g.id, g.icon),
      isAdmin: isAdministrator(g),
      accessible: true,
      shared: false,
    }))

  // Le bot est requis pour lister les salons et creer les invitations (Discord
  // refuse les tokens utilisateur sur ces endpoints).
  const { botToken } = await getDiscordConfig()
  const botConfigured = Boolean(botToken) || isMockMode()

  return Response.json({ guilds, available, botConfigured })
}

// POST /api/dashboard/guilds -> partage un serveur { discordId, channelId, channelName }
export async function POST(req: Request) {
  try {
    return await shareGuild(req)
  } catch (e) {
    // Jamais de corps vide : le client doit toujours recevoir un JSON exploitable
    const detail = e instanceof Error ? e.message : 'Erreur inconnue'
    console.error('[guilds:share]', detail)
    return Response.json({ error: `Partage impossible : ${detail}` }, { status: 500 })
  }
}

async function shareGuild(req: Request) {
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Non connecte.' }, { status: 401 })

  let body: { discordId?: string; channelId?: string; channelName?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Corps de requete invalide.' }, { status: 400 })
  }
  const discordId = (body.discordId || '').trim()
  const channelId = (body.channelId || '').trim()
  const channelName = (body.channelName || '').trim()
  if (!discordId || !channelId) {
    return Response.json({ error: 'discordId et channelId sont requis.' }, { status: 400 })
  }

  let token: string | null = null
  try {
    token = await ensureAccessToken(user)
  } catch {
    token = null
  }
  if (!token) {
    return Response.json({ error: 'Session Discord expiree.', needsReauth: true }, { status: 401 })
  }

  const dGuilds = await fetchUserGuilds(token)
  const dGuild = dGuilds.find((g) => g.id === discordId)
  if (!dGuild || !canCreateInvites(dGuild)) {
    return Response.json(
      { error: "Tu n'as pas les droits necessaires sur ce serveur." },
      { status: 403 },
    )
  }

  // Cree l'invitation permanente sur le salon choisi : via le BOT du serveur
  // (Discord refuse la creation d'invitation avec un token utilisateur).
  let invite
  try {
    invite = await createInviteSmart(discordId, channelId)
  } catch (e) {
    const resp = inviteErrorResponse(e)
    if (resp) return resp
    throw e
  }

  const row = await db.guild.upsert({
    where: { discordId_ownerId: { discordId, ownerId: user.id } },
    create: {
      discordId,
      name: dGuild.name,
      icon: dGuild.icon,
      channelId,
      channelName,
      ownerId: user.id,
      lastCheckAt: new Date(),
      lastCheckStatus: 'ok',
      lastCheckMsg: 'Serveur partage, invitation creee.',
    },
    update: {
      name: dGuild.name,
      icon: dGuild.icon,
      channelId,
      channelName,
      lastCheckAt: new Date(),
      lastCheckStatus: 'ok',
      lastCheckMsg: 'Serveur partage, invitation creee.',
    },
    include: { invite: true },
  })

  await db.invite.upsert({
    where: { guildId: row.id },
    create: { guildId: row.id, code: invite.code, uses: invite.uses ?? 0 },
    update: { code: invite.code, uses: invite.uses ?? 0 },
  })

  // Compteurs publics
  let memberCount: number | null = null
  let onlineCount: number | null = null
  try {
    const meta = await fetchInviteMeta(invite.code)
    memberCount = meta.approximate_member_count ?? null
    onlineCount = meta.approximate_presence_count ?? null
    await db.guild.update({ where: { id: row.id }, data: { memberCount, onlineCount } })
  } catch {
    // pas bloquant
  }

  return Response.json({
    guild: {
      discordId: row.discordId,
      name: row.name,
      iconUrl: guildIconUrl(row.discordId, row.icon),
      isAdmin: isAdministrator(dGuild),
      accessible: true,
      shared: true,
      channelId: row.channelId,
      channelName: row.channelName,
      memberCount,
      onlineCount,
      inviteCode: invite.code,
      inviteUrl: `https://discord.gg/${invite.code}`,
      uses: 0,
      lastCheckAt: new Date(),
      lastCheckStatus: 'ok',
      lastCheckMsg: 'Serveur partage, invitation creee.',
    },
  })
}
