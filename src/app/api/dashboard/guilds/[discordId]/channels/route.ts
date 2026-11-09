import { getSessionUser } from '@/lib/auth'
import { ensureAccessToken } from '@/lib/refresher'
import {
  fetchGuildChannels,
  fetchGuildChannelsAsBot,
  isBotNotInGuild,
} from '@/lib/discord'
import { buildBotInviteUrl, getDiscordConfig, isMockMode } from '@/lib/config'
import { isSnowflake, rateLimit, rateLimitHeaders } from '@/lib/security'

type Params = { params: Promise<{ discordId: string }> }

// GET /api/dashboard/guilds/[discordId]/channels -> salons texte du serveur
// Le listing des salons exige un BOT membre du serveur : Discord refuse les tokens
// utilisateur sur cet endpoint. Sans bot configure, le mode demo passe quand meme.
export async function GET(_req: Request, { params }: Params) {
  try {
    return await listChannels({ params })
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'Erreur inconnue'
    console.error('[guilds:channels]', detail)
    return Response.json({ error: `Liste des salons impossible : ${detail}` }, { status: 500 })
  }
}

async function listChannels({ params }: Params) {
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Non connecte.' }, { status: 401 })

  const { discordId } = await params
  if (!isSnowflake(discordId)) {
    return Response.json({ error: 'Identifiant de serveur invalide.' }, { status: 400 })
  }

  const limit = rateLimit(`channels:${user.id}`, 30, 60_000)
  if (!limit.allowed) {
    return Response.json(
      { error: 'Trop de requetes. Reessaie dans un instant.' },
      { status: 429, headers: rateLimitHeaders(limit) },
    )
  }

  const { clientId, botToken } = await getDiscordConfig()

  // 1. Bot configure : c'est lui qui liste les salons
  if (botToken) {
    try {
      const channels = await fetchGuildChannelsAsBot(botToken, discordId)
      return Response.json({ channels: pickTextChannels(channels) })
    } catch (e) {
      if (isBotNotInGuild(e)) {
        return Response.json(
          {
            error:
              "Le bot n'est pas encore sur ce serveur : clique sur le bouton ci-dessous pour l'ajouter (il n'enverra jamais de messages).",
            addBotUrl: buildBotInviteUrl(clientId, discordId),
          },
          { status: 403 },
        )
      }
      const detail = e instanceof Error ? e.message : 'erreur Discord'
      return Response.json(
        { error: `Impossible de lister les salons (${detail}).` },
        { status: 400 },
      )
    }
  }

  // 2. Pas de bot configure : mode demo on passe, en vrai Discord on explique quoi faire
  if (!isMockMode()) {
    return Response.json(
      {
        error:
          "Le bot Discord n'est pas configure : un staff doit ajouter le Bot Token dans les Reglages (onglet reserve au staff), puis le bot doit etre ajoute a ce serveur.",
        botRequired: true,
      },
      { status: 400 },
    )
  }

  // 3. Mode demo : fallback sur le token utilisateur (le Discord simule accepte tout)
  const token = await ensureAccessToken(user).catch(() => null)
  if (!token) {
    return Response.json({ error: 'Session Discord expiree.', needsReauth: true }, { status: 401 })
  }
  try {
    const channels = await fetchGuildChannels(token, discordId)
    return Response.json({ channels: pickTextChannels(channels) })
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'erreur Discord'
    return Response.json(
      { error: `Impossible de lister les salons (${detail}).` },
      { status: 400 },
    )
  }
}

function pickTextChannels(channels: { id: string; name: string; type: number; position?: number }[]) {
  return channels
    .filter((c) => c.type === 0 || c.type === 5) // texte + annonces
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((c) => ({ id: c.id, name: c.name }))
}
