import { db } from '@/lib/db'
import type { Guild, User } from '@prisma/client'
import { fetchInviteMeta, refreshAccessToken } from '@/lib/discord'
import { getDiscordConfig } from '@/lib/config'
import { createInviteSmart } from '@/lib/invite-service'

/**
 * Moteur de rafraichissement : toutes les 5 minutes, chaque serveur partage est verifie.
 * - l'invitation stockee existe toujours et n'est pas expiree ?
 * - si elle a disparu (supprimee manuellement, salon supprime...) => on en recree une automatiquement
 * - les compteurs (membres, en ligne, utilisations) sont mis a jour
 */

// Intervalle de verification : 5 minutes par defaut (configurable pour les tests)
const REFRESH_INTERVAL_MS = Number(process.env.REFRESH_INTERVAL_MS) || 5 * 60 * 1000

/** Renvoie un access token valide, en le rafraichissant si necessaire (refresh token rotatif). */
export async function ensureAccessToken(user: User): Promise<string | null> {
  const stillValid =
    user.accessToken &&
    user.tokenExpiresAt &&
    user.tokenExpiresAt.getTime() > Date.now() + 60_000
  if (stillValid) return user.accessToken ?? null
  if (!user.refreshToken) return null

  const { clientId, clientSecret } = await getDiscordConfig()
  if (!clientId || !clientSecret) return null

  const tokens = await refreshAccessToken(clientId, clientSecret, user.refreshToken)
  await db.user.update({
    where: { id: user.id },
    data: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || user.refreshToken,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
  })
  return tokens.access_token
}

type GuildWithRelations = Guild & { owner: User; invite: { code: string; uses: number } | null }

/** Verifie / repare l'invitation d'un serveur partage. */
export async function refreshGuild(guild: GuildWithRelations): Promise<void> {
  const now = new Date()

  const markError = async (msg: string) => {
    await db.guild.update({
      where: { id: guild.id },
      data: { lastCheckAt: now, lastCheckStatus: 'error', lastCheckMsg: msg.slice(0, 300) },
    })
  }

  // 1. Verifie l'invitation actuelle via l'endpoint PUBLIC de Discord (aucune auth requise) :
  //    indépendant de la validite des tokens des utilisateurs.
  let code = guild.invite?.code ?? null
  let uses = guild.invite?.uses ?? 0
  let status: 'ok' | 'refreshed' = 'ok'
  let message = 'Invitation valide.'

  if (code) {
    try {
      const meta = await fetchInviteMeta(code)
      uses = meta.uses ?? uses
    } catch {
      // L'invitation a disparu (supprimee manuellement, salon supprime...) => recreation
      code = null
      status = 'refreshed'
      message = 'Ancienne invitation introuvable : une nouvelle a ete generee automatiquement.'
    }
  }

  // 2. Recree l'invitation si besoin (via le bot du serveur)
  if (!code) {
    if (!guild.channelId) {
      await markError('Aucun salon configure : choisis un salon texte dans le tableau de bord.')
      return
    }
    try {
      const fresh = await createInviteSmart(guild.discordId, guild.channelId)
      code = fresh.code
      uses = 0
    } catch (e) {
      await markError(e instanceof Error ? e.message : 'Erreur Discord inconnue')
      return
    }
  }

  // 3. Compteurs publics (membres / en ligne)
  let memberCount = guild.memberCount
  let onlineCount = guild.onlineCount
  if (code) {
    try {
      const meta = await fetchInviteMeta(code)
      memberCount = meta.approximate_member_count ?? memberCount
      onlineCount = meta.approximate_presence_count ?? onlineCount
    } catch {
      // meta indisponible : on garde les anciennes valeurs
    }
  }

  // 4. Persiste tout
  await db.guild.update({
    where: { id: guild.id },
    data: {
      lastCheckAt: now,
      lastCheckStatus: status,
      lastCheckMsg: message,
      memberCount,
      onlineCount,
    },
  })
  if (code) {
    await db.invite.upsert({
      where: { guildId: guild.id },
      create: { guildId: guild.id, code, uses, maxAge: 0, maxUses: 0 },
      update: { code, uses },
    })
  }
}

let tickRunning = false

async function tick(): Promise<void> {
  if (tickRunning) return
  tickRunning = true
  try {
    const guilds = await db.guild.findMany({
      include: { owner: true, invite: true },
    })
    for (const guild of guilds) {
      try {
        await refreshGuild(guild)
      } catch {
        // une erreur sur un serveur n'arrete pas les autres
      }
    }
  } catch {
    // base indisponible : nouvelle tentative au prochain cycle
  } finally {
    tickRunning = false
  }
}

/** Demarre la boucle de rafraichissement (une seule fois par processus). */
export function startRefresher(): void {
  const g = globalThis as unknown as { __dlhRefresherStarted?: boolean }
  if (g.__dlhRefresherStarted) return
  g.__dlhRefresherStarted = true
  const delayMs = 20_000 // laisse le serveur finir de demarrer
  const timer = setTimeout(tick, delayMs)
  if (typeof timer.unref === 'function') timer.unref()
  const interval = setInterval(tick, REFRESH_INTERVAL_MS)
  if (typeof interval.unref === 'function') interval.unref()
  console.log('[refresher] suivi des invitations demarre : verification toutes les 5 minutes')
}
