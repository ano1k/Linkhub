import { db } from '@/lib/db'
import type { Guild, User } from '@/generated/prisma/client'
import {
  DiscordApiError,
  fetchGuildChannelsAsBot,
  fetchInviteMeta,
  isTransientDiscordError,
  isUnknownInviteError,
  refreshAccessToken,
  type DiscordChannel,
  type InviteMeta,
} from '@/lib/discord'
import { getDiscordConfig } from '@/lib/config'
import { createInviteSmart } from '@/lib/invite-service'
import { openSecret, sealSecret } from '@/lib/secrets'
import { startWebhookHeartbeat } from '@/lib/webhook'
import { REFRESH_LOCK, acquireJobLock, releaseJobLock } from '@/lib/job-lock'

/**
 * Moteur de rafraichissement : toutes les 5 minutes, chaque serveur partage est verifie.
 * - l'invitation stockee existe toujours et n'est pas expiree ?
 * - si elle a disparu (supprimee manuellement, salon supprime...) => on en recree une automatiquement
 * - si aucun salon n'est configure, on tente de detecter le premier salon texte via le bot
 * - les compteurs (membres, en ligne, utilisations) sont mis a jour
 * - les erreurs sont isolees par serveur et comptabilisees
 */

const REFRESH_INTERVAL_MS = Number(process.env.REFRESH_INTERVAL_MS) || 5 * 60 * 1000
const CONCURRENCY = 5
/** Taille des lots : la memoire reste plate meme avec des milliers de serveurs. */
const BATCH_SIZE = 100

export type RefresherMetrics = {
  startedAt: string
  lastTickAt: string | null
  lastTickDurationMs: number | null
  lastTickStatus: 'idle' | 'ok' | 'error'
  processed: number
  refreshed: number
  errors: number
  totalChecks: number
}

const metrics: RefresherMetrics = {
  startedAt: new Date().toISOString(),
  lastTickAt: null,
  lastTickDurationMs: null,
  lastTickStatus: 'idle',
  processed: 0,
  refreshed: 0,
  errors: 0,
  totalChecks: 0,
}

export function getRefresherMetrics(): RefresherMetrics {
  return { ...metrics }
}

/**
 * Etat du verificateur reconstruit depuis la base.
 * Les metriques memoire ne sont pas partagees entre le process d'instrumentation
 * et les route handlers Next.js : on s'appuie donc sur les colonnes de Guild.
 */
export async function getRefresherMetricsFromDb(): Promise<RefresherMetrics> {
  try {
    // Agregats en base : /api/health est appele par le heartbeat et les moniteurs,
    // inutile de charger toutes les lignes pour un maximum et deux compteurs.
    const [agg, errors, refreshed] = await Promise.all([
      db.guild.aggregate({
        _count: { _all: true },
        _max: { lastCheckAt: true, lastCheckLatencyMs: true },
      }),
      db.guild.count({ where: { lastCheckStatus: 'error' } }),
      db.guild.count({ where: { lastCheckStatus: 'refreshed' } }),
    ])
    const total = agg._count._all ?? 0
    if (total === 0) return { ...metrics }
    const lastTick = agg._max.lastCheckAt
    return {
      ...metrics,
      lastTickAt: lastTick ? lastTick.toISOString() : metrics.lastTickAt,
      lastTickDurationMs: agg._max.lastCheckLatencyMs ?? metrics.lastTickDurationMs,
      lastTickStatus: errors > 0 ? 'error' : 'ok',
      processed: total,
      refreshed,
      errors,
      totalChecks: total,
    }
  } catch {
    return { ...metrics }
  }
}

/** Renvoie un access token valide, en le rafraichissant si necessaire (refresh token rotatif). */
export async function ensureAccessToken(user: User): Promise<string | null> {
  // Les tokens sont stockes chiffres : on les dechiffre a la lecture (les valeurs
  // en clair d'avant le chiffrement restent acceptees et sont re-chiffrees au refresh).
  const accessToken = openSecret(user.accessToken)
  const stillValid =
    accessToken && user.tokenExpiresAt && user.tokenExpiresAt.getTime() > Date.now() + 60_000
  if (stillValid) return accessToken
  if (!user.refreshToken) return null

  const refreshToken = openSecret(user.refreshToken)
  if (!refreshToken) return null

  const { clientId, clientSecret } = await getDiscordConfig()
  if (!clientId || !clientSecret) return null

  const tokens = await refreshAccessToken(clientId, clientSecret, refreshToken)
  await db.user.update({
    where: { id: user.id },
    data: {
      accessToken: sealSecret(tokens.access_token),
      refreshToken: sealSecret(tokens.refresh_token || refreshToken),
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
  })
  return tokens.access_token
}

type GuildWithRelations = Guild & {
  owner: User
  invite: { code: string; uses: number } | null
}

/** Filtre les salons texte / annonces et les trie par position. */
export function pickTextChannels(
  channels: DiscordChannel[],
): Array<{ id: string; name: string }> {
  return channels
    .filter((c) => c.type === 0 || c.type === 5)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((c) => ({ id: c.id, name: c.name }))
}

export type RefreshResult = {
  status: 'ok' | 'refreshed' | 'error'
  message: string
  latencyMs: number
}

/** Verifie / repare l'invitation d'un serveur partage. */
export async function refreshGuild(guild: GuildWithRelations): Promise<RefreshResult> {
  const started = Date.now()
  const now = new Date()

  const markError = async (msg: string): Promise<RefreshResult> => {
    const latencyMs = Date.now() - started
    await db.guild
      .update({
        where: { id: guild.id },
        data: {
          lastCheckAt: now,
          lastCheckStatus: 'error',
          lastCheckMsg: msg.slice(0, 300),
          lastCheckLatencyMs: latencyMs,
          failureCount: { increment: 1 },
        },
      })
      .catch(() => {})
    return { status: 'error', message: msg, latencyMs }
  }

  // 1. Verifie l'invitation actuelle via l'endpoint PUBLIC de Discord (aucune auth requise).
  let code = guild.invite?.code ?? null
  let uses = guild.invite?.uses ?? 0
  // Metadonnees deja recuperees : elles servent aussi a l'etape 3 pour les compteurs,
  // ce qui evite un second appel Discord par serveur et par cycle.
  let meta: InviteMeta | null = null
  let status: 'ok' | 'refreshed' = 'ok'
  let message = 'Invitation valide.'

  if (code) {
    try {
      meta = await fetchInviteMeta(code)
    } catch (e) {
      if (!isUnknownInviteError(e)) {
        // Erreur temporaire (reseau, timeout, 429, 5xx) ou refus inattendu : on ne sait
        // PAS si l'invitation existe encore, donc on la conserve et on reessaie au
        // prochain cycle. Regenerer ici recreerait toutes les invitations a chaque
        // incident Discord sans rien reparer.
        const detail =
          e instanceof DiscordApiError && e.status > 0 ? `Discord ${e.status}` : 'Discord injoignable'
        const cause = isTransientDiscordError(e) ? 'erreur temporaire' : 'reponse inattendue'
        return await markError(
          `Verification impossible (${cause}, ${detail}) : l'invitation existante est conservee, nouvelle tentative au prochain cycle.`,
        )
      }
      code = null
      status = 'refreshed'
      message = 'Ancienne invitation introuvable : une nouvelle a ete generee automatiquement.'
    }
    if (meta) {
      uses = meta.uses ?? uses
      if (meta.expires_at && new Date(meta.expires_at).getTime() <= Date.now()) {
        code = null
        meta = null
        status = 'refreshed'
        message = 'Invitation expiree : une nouvelle a ete generee automatiquement.'
      }
    }
  }

  // 2. Recree l'invitation si besoin (via le bot du serveur).
  let channelId = guild.channelId
  let channelName = guild.channelName
  if (!code) {
    if (!channelId) {
      // Auto-reparation : on cherche un salon texte via le bot.
      const { botToken } = await getDiscordConfig()
      if (botToken) {
        try {
          const channels = await fetchGuildChannelsAsBot(botToken, guild.discordId)
          const first = pickTextChannels(channels)[0]
          if (first) {
            channelId = first.id
            channelName = first.name
          }
        } catch {
          // on garde l'erreur explicite ci-dessous
        }
      }
    }
    if (!channelId) {
      return await markError(
        'Aucun salon configure : choisis un salon texte dans le tableau de bord.',
      )
    }
    try {
      const fresh = await createInviteSmart(guild.discordId, channelId)
      code = fresh.code
      uses = 0
      meta = null // metadonnees de l'ancienne invitation obsoletes
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur Discord inconnue'
      return await markError(msg)
    }
  }

  // 3. Compteurs publics (membres / en ligne) + utilisations.
  // Si l'etape 1 a deja recupere les metadonnees de la MEME invitation, on les reutilise
  // (un seul appel Discord par serveur et par cycle). Un appel n'est refait que si
  // l'invitation vient d'etre regeneree.
  let memberCount = guild.memberCount
  let onlineCount = guild.onlineCount
  if (code && !meta) {
    try {
      meta = await fetchInviteMeta(code)
    } catch {
      // meta indisponible : on garde les anciennes valeurs
    }
  }
  if (meta) {
    uses = meta.uses ?? uses
    memberCount = meta.approximate_member_count ?? memberCount
    onlineCount = meta.approximate_presence_count ?? onlineCount
  }

  // 4. Persiste tout.
  const latencyMs = Date.now() - started
  await db.guild.update({
    where: { id: guild.id },
    data: {
      channelId,
      channelName,
      lastCheckAt: now,
      lastCheckStatus: status,
      lastCheckMsg: message,
      lastCheckLatencyMs: latencyMs,
      memberCount,
      onlineCount,
      failureCount: 0,
    },
  })
  if (code) {
    await db.invite.upsert({
      where: { guildId: guild.id },
      create: { guildId: guild.id, code, uses, maxAge: 0, maxUses: 0 },
      update: { code, uses },
    })
  }

  return { status, message, latencyMs }
}

let tickRunning = false

/** Un cycle complet de verification, par lots et avec concurrence limitee. */
export async function runRefreshCycle(): Promise<RefresherMetrics> {
  if (tickRunning) return { ...metrics }
  tickRunning = true
  const started = Date.now()
  try {
    let processed = 0
    let refreshed = 0
    let errors = 0
    let cursor: string | undefined

    for (;;) {
      const batch = await db.guild.findMany({
        take: BATCH_SIZE,
        orderBy: { id: 'asc' },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: { owner: true, invite: true },
      })
      if (batch.length === 0) break

      cursor = batch[batch.length - 1].id
      processed += batch.length

      const queue = [...batch]
      const workers = Array.from(
        { length: Math.min(CONCURRENCY, Math.max(1, queue.length)) },
        async () => {
          for (;;) {
            const guild = queue.shift()
            if (!guild) return
            try {
              const result = await refreshGuild(guild)
              if (result.status === 'refreshed') refreshed += 1
              if (result.status === 'error') errors += 1
            } catch {
              errors += 1
            }
          }
        },
      )
      await Promise.all(workers)

      if (batch.length < BATCH_SIZE) break
    }

    metrics.processed = processed
    metrics.refreshed = refreshed
    metrics.errors = errors
    metrics.totalChecks += processed
    metrics.lastTickStatus = errors > 0 ? 'error' : 'ok'
  } catch {
    metrics.lastTickStatus = 'error'
  } finally {
    metrics.lastTickDurationMs = Date.now() - started
    metrics.lastTickAt = new Date().toISOString()
    tickRunning = false
  }
  return { ...metrics }
}

/**
 * Cycle de rafraichissement protege par le verrou distribue.
 * Renvoie `ran: false` si une autre instance (ou le cron) travaille deja.
 */
export async function runRefreshCycleLocked(
  owner = 'internal',
): Promise<{ ran: boolean; metrics: RefresherMetrics }> {
  const acquired = await acquireJobLock(REFRESH_LOCK, REFRESH_INTERVAL_MS, owner)
  if (!acquired) {
    return { ran: false, metrics: await getRefresherMetricsFromDb().catch(() => ({ ...metrics })) }
  }
  try {
    return { ran: true, metrics: await runRefreshCycle() }
  } finally {
    await releaseJobLock(REFRESH_LOCK)
  }
}

/**
 * Environnements ou un process peut etre gele entre deux requetes (serverless) :
 * un setInterval n'y survit pas de facon fiable, le cron externe prend le relais.
 */
export function isServerlessRuntime(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.NETLIFY ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.K_SERVICE ||
      process.env.FUNCTION_TARGET,
  )
}

/** Demarre la boucle de rafraichissement + le heartbeat Discord (une seule fois par process). */
export function startRefresher(): void {
  if (isServerlessRuntime()) {
    console.log(
      '[refresher] runtime serverless : boucle interne desactivee, configure un cron sur /api/cron/refresh',
    )
    return
  }

  const g = globalThis as unknown as { __dlhRefresherStarted?: boolean }
  if (g.__dlhRefresherStarted) return
  g.__dlhRefresherStarted = true

  const delayMs = 20_000 // laisse le serveur finir de demarrer
  const timer = setTimeout(() => {
    void runRefreshCycleLocked('internal')
  }, delayMs)
  if (typeof timer.unref === 'function') timer.unref()

  const interval = setInterval(() => {
    void runRefreshCycleLocked('internal')
  }, REFRESH_INTERVAL_MS)
  if (typeof interval.unref === 'function') interval.unref()

  // Heartbeat Discord (ping du site + notification), reglable depuis les Reglages.
  startWebhookHeartbeat()

  console.log(
    `[refresher] suivi des invitations demarre : verification toutes les ${Math.round(
      REFRESH_INTERVAL_MS / 60000,
    )} min`,
  )
}
