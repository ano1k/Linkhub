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
import { buildBotInviteUrl, getDiscordConfig, isMockMode } from '@/lib/config'
import { mapWithConcurrency } from '@/lib/async'
import { emptyClickSummary, summarizeClicks } from '@/lib/clicks'
import { checkBotPresence } from '@/lib/bot-presence'
import {
  checkSameOrigin,
  getRequestMeta,
  isSnowflake,
  rateLimit,
  rateLimitHeaders,
  recordAudit,
  sanitizeText,
} from '@/lib/security'
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
    lastCheckLatencyMs: row.lastCheckLatencyMs,
    failureCount: row.failureCount,
  }
}

// GET /api/dashboard/guilds -> serveurs eligibles (admin / droits d'invitation)
// On ne montre QUE les serveurs où le bot de la plateforme est présent.
// Les serveurs éligibles sans bot sont listés à part avec un bouton d'ajout.
export async function GET(req: Request) {
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Non connecte.' }, { status: 401 })

  const limit = rateLimit(`guilds:${user.id}`, 60, 60_000)
  if (!limit.allowed) {
    return Response.json(
      { error: 'Trop de requetes. Reessaie dans un instant.' },
      { status: 429, headers: rateLimitHeaders(limit) },
    )
  }

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
  const sharedIds = new Set(rows.map((r) => r.discordId))

  const { clientId, botToken } = await getDiscordConfig()
  const botConfigured = Boolean(botToken) || isMockMode()

  if (!botConfigured) {
    return Response.json(
      {
        guilds: [],
        available: [],
        missingBot: [],
        botConfigured: false,
        botError: 'bot_not_configured',
      },
      { headers: { 'Cache-Control': 'no-store', ...rateLimitHeaders(limit) } },
    )
  }

  const effectiveBotToken = botToken || 'demo-bot-token'

  // Presence du bot. Deux garde-fous pour ne pas marteler Discord a chaque
  // ouverture du tableau de bord (il est rechargé toutes les 60 s) :
  //  1. si le verificateur a confirme recemment qu'un serveur partage fonctionne,
  //     le bot y est forcement present : inutile d'interroger Discord ;
  //  2. les verifications restantes sont limitees a 4 requetes simultanees.
  const presence = new Map<string, boolean>()
  const toCheck = new Set<string>()
  const FRESH_CHECK_MS = 15 * 60_000
  for (const row of rows) {
    const checkedAt = row.lastCheckAt ? row.lastCheckAt.getTime() : 0
    const fresh = checkedAt > 0 && Date.now() - checkedAt < FRESH_CHECK_MS
    if (fresh && (row.lastCheckStatus === 'ok' || row.lastCheckStatus === 'refreshed')) {
      presence.set(row.discordId, true)
    } else {
      toCheck.add(row.discordId)
    }
  }
  for (const g of eligible) {
    if (!presence.has(g.id)) toCheck.add(g.id)
  }

  let botError: string | null = null
  const checks = await mapWithConcurrency([...toCheck], 4, async (id) => ({
    id,
    check: await checkBotPresence(effectiveBotToken, id),
  }))
  for (const { id, check } of checks) {
    presence.set(id, check.present)
    if (check.error) botError = check.error
  }

  // Clics des 30 derniers jours (une seule requete pour tous les serveurs).
  const clicks = await summarizeClicks(rows.map((row) => row.discordId))

  const guilds = rows
    .filter((row) => presence.get(row.discordId))
    .map((row) => ({
      ...serializeShared(row, dById.get(row.discordId) ?? null),
      clicks: clicks.get(row.discordId) ?? emptyClickSummary(),
    }))

  const available = eligible
    .filter((g) => !sharedIds.has(g.id) && presence.get(g.id))
    .map((g) => ({
      discordId: g.id,
      name: g.name,
      iconUrl: guildIconUrl(g.id, g.icon),
      isAdmin: isAdministrator(g),
      accessible: true,
      shared: false,
    }))

  const missingIds = new Set<string>()
  for (const g of eligible) {
    if (!presence.get(g.id)) missingIds.add(g.id)
  }
  for (const row of rows) {
    if (!presence.get(row.discordId)) missingIds.add(row.discordId)
  }
  const missingBot = [...missingIds].map((id) => {
    const d = dById.get(id)
    const row = rows.find((r) => r.discordId === id)
    return {
      discordId: id,
      name: d?.name ?? row?.name ?? 'Serveur Discord',
      iconUrl: guildIconUrl(id, d?.icon ?? row?.icon ?? null),
      isAdmin: d ? isAdministrator(d) : false,
      shared: Boolean(row),
      inviteUrl: buildBotInviteUrl(clientId, id),
    }
  })

  return Response.json(
    { guilds, available, missingBot, botConfigured, botError },
    { headers: { 'Cache-Control': 'no-store', ...rateLimitHeaders(limit) } },
  )
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
  const originError = checkSameOrigin(req)
  if (originError) return Response.json({ error: originError }, { status: 403 })

  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Non connecte.' }, { status: 401 })

  const meta = getRequestMeta(req)
  const limit = rateLimit(`guild-share:${user.id}`, 10, 60_000)
  if (!limit.allowed) {
    return Response.json(
      { error: 'Trop de partages en une minute. Reessaie dans un instant.' },
      { status: 429, headers: rateLimitHeaders(limit) },
    )
  }

  let body: { discordId?: string; channelId?: string; channelName?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Corps de requete invalide.' }, { status: 400 })
  }
  const discordId = (body.discordId || '').trim()
  const channelId = (body.channelId || '').trim()
  const channelName = sanitizeText(body.channelName, 100)
  if (!discordId || !channelId) {
    return Response.json({ error: 'discordId et channelId sont requis.' }, { status: 400 })
  }
  if (!isSnowflake(discordId) || !isSnowflake(channelId)) {
    return Response.json({ error: 'Identifiants Discord invalides.' }, { status: 400 })
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

  await recordAudit({
    action: 'guild.share',
    actorId: user.id,
    actorName: user.username,
    target: discordId,
    ip: meta.ip,
    userAgent: meta.userAgent,
    metadata: { channelId, channelName },
  })

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
