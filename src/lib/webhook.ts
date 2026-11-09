import { db } from '@/lib/db'
import { decryptSecret, encryptSecret, isValidWebhookUrl, maskWebhookUrl, sanitizeText } from '@/lib/security'

/**
 * Heartbeat Discord : le site se ping lui-meme (endpoint /api/health) puis
 * envoie un message a un webhook Discord. Par defaut toutes les 5 minutes.
 * L'URL du webhook est chiffree en base (AES-256-GCM) et jamais renvoyee en clair.
 */

export const DEFAULT_WEBHOOK_MESSAGE =
  '🟢 **{site}** est en ligne — statut {status}, latence {latency} ms. {guilds} serveur(s) suivi(s), {errors} erreur(s).'

export const WEBHOOK_INTERVAL_MIN = 1
export const WEBHOOK_INTERVAL_MAX = 1440
export const DEFAULT_WEBHOOK_INTERVAL = 5

/**
 * Marge de tolerance avant l'echeance (bornee au quart de l'intervalle).
 *
 * Sans elle, un cron externe appele « toutes les 5 min » arrive toujours un peu
 * avant l'echeance (12:00:04 -> 12:05:02 = 298 s < 300 s) : l'envoi etait
 * reporte au passage suivant, soit un ping Discord toutes les ~10 min.
 */
export const WEBHOOK_GRACE_MS = 60_000

/** Vrai si l'intervalle configure est ecoule (avec la marge de tolerance). */
export function isWebhookDue(
  lastSentAt: Date | null,
  intervalMinutes: number,
  now: number = Date.now(),
): boolean {
  if (!lastSentAt) return true
  const minutes = Math.min(
    WEBHOOK_INTERVAL_MAX,
    Math.max(1, Math.round(Number(intervalMinutes) || DEFAULT_WEBHOOK_INTERVAL)),
  )
  const intervalMs = minutes * 60_000
  const graceMs = Math.min(WEBHOOK_GRACE_MS, Math.floor(intervalMs / 4))
  return now - lastSentAt.getTime() >= intervalMs - graceMs
}

export type SiteSettingsRow = {
  id: string
  siteName: string | null
  webhookUrl: string | null
  webhookEnabled: boolean
  webhookIntervalMinutes: number
  webhookMention: string | null
  webhookMessage: string | null
  webhookIncludeStats: boolean
  webhookLastSentAt: Date | null
  webhookLastStatus: string | null
  webhookLastLatencyMs: number | null
  webhookLastHttpStatus: number | null
  webhookLastError: string | null
  webhookSuccessCount: number
  webhookFailureCount: number
  updatedAt: Date
}

export type SiteSettingsFull = SiteSettingsRow & { webhookUrlDecrypted: string | null }

export type WebhookDeliveryItem = {
  id: string
  status: string
  httpStatus: number | null
  latencyMs: number | null
  siteStatus: string | null
  siteLatencyMs: number | null
  error: string | null
  trigger: string | null
  createdAt: string
}

export type WebhookPublicConfig = {
  configured: boolean
  enabled: boolean
  intervalMinutes: number
  mention: string | null
  message: string | null
  includeStats: boolean
  siteName: string | null
  maskedUrl: string
  status: string
  lastSentAt: string | null
  lastLatencyMs: number | null
  lastHttpStatus: number | null
  lastError: string | null
  successCount: number
  failureCount: number
  deliveries: WebhookDeliveryItem[]
  siteUrl: string
}

const DEFAULTS: Omit<SiteSettingsRow, 'id' | 'updatedAt'> = {
  siteName: null,
  webhookUrl: null,
  webhookEnabled: false,
  webhookIntervalMinutes: DEFAULT_WEBHOOK_INTERVAL,
  webhookMention: null,
  webhookMessage: null,
  webhookIncludeStats: true,
  webhookLastSentAt: null,
  webhookLastStatus: 'never',
  webhookLastLatencyMs: null,
  webhookLastHttpStatus: null,
  webhookLastError: null,
  webhookSuccessCount: 0,
  webhookFailureCount: 0,
}

/** Lit les reglages du site. Tolere l'absence de table (base non migree). */
export async function getSiteSettings(): Promise<SiteSettingsFull> {
  try {
    const row = await db.siteSettings.findUnique({ where: { id: 'main' } })
    if (!row) {
      return {
        id: 'main',
        ...DEFAULTS,
        updatedAt: new Date(),
        webhookUrlDecrypted: null,
      }
    }
    return { ...row, webhookUrlDecrypted: decryptSecret(row.webhookUrl) }
  } catch {
    return {
      id: 'main',
      ...DEFAULTS,
      updatedAt: new Date(),
      webhookUrlDecrypted: null,
    }
  }
}

/** Cree la ligne de reglages si elle n'existe pas encore. */
export async function ensureSiteSettings(): Promise<SiteSettingsRow> {
  const existing = await db.siteSettings.findUnique({ where: { id: 'main' } })
  if (existing) return existing
  return db.siteSettings.create({ data: { id: 'main', ...DEFAULTS } })
}

export function getSiteName(settings?: { siteName?: string | null }): string {
  return sanitizeText(settings?.siteName, 40) || process.env.SITE_NAME || 'LinkHub'
}

/** URL publique du site (pour l'affichage et le self-ping). */
export function getSiteUrl(): string {
  const base = process.env.PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL
  if (base) return base.replace(/\/$/, '')
  return ''
}

/** URL absolue de l'endpoint de sante, utilisee pour le ping interne. */
export function getSelfHealthUrl(): string {
  const base = getSiteUrl()
  if (base) return `${base}/api/health`
  const port = process.env.PORT || '3000'
  return `http://127.0.0.1:${port}/api/health`
}

export type PingResult = {
  ok: boolean
  skipped?: boolean
  reason?: string
  error?: string
  httpStatus?: number
  latencyMs?: number
  siteStatus?: string
  siteLatencyMs?: number
  sentAt?: string
}

type CheckResult = { ok: boolean; status: number; latencyMs: number; detail?: string }

/** Ping le site lui-meme (endpoint /api/health) avec un timeout court. */
export async function checkSiteHealth(): Promise<CheckResult> {
  const started = Date.now()
  try {
    const res = await fetch(getSelfHealthUrl(), {
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
      headers: { 'User-Agent': 'LinkHub-Heartbeat/1.0' },
    })
    const latencyMs = Date.now() - started
    let detail: string | undefined
    try {
      const body = (await res.json()) as { status?: string; database?: string; detail?: string }
      detail = body?.detail || body?.database
    } catch {
      // corps non JSON : le statut HTTP suffit
    }
    return { ok: res.ok, status: res.status, latencyMs, detail }
  } catch (e) {
    return {
      ok: false,
      status: 0,
      latencyMs: Date.now() - started,
      detail: e instanceof Error ? e.message : 'timeout',
    }
  }
}

function normalizeMention(raw: string | null | undefined): string | null {
  const value = sanitizeText(raw, 40)
  if (!value) return null
  if (value === '@everyone' || value === '@here') return value
  if (/^<@&\d{17,20}>$/.test(value)) return value
  if (/^\d{17,20}$/.test(value)) return `<@&${value}>`
  return null
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match)
}

function timeAgo(date: Date | null): string {
  if (!date) return 'jamais'
  const diff = Date.now() - date.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return "à l'instant"
  if (min === 1) return 'il y a 1 min'
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h === 1) return 'il y a 1 h'
  if (h < 24) return `il y a ${h} h`
  return `il y a ${Math.floor(h / 24)} j`
}

/** Construit le payload Discord (embed riche + mention optionnelle). */
export async function buildWebhookPayload(opts: {
  trigger: string
  site: CheckResult
  settings: SiteSettingsFull
  siteUrl?: string
}): Promise<{ body: Record<string, unknown>; guilds: number; errors: number }> {
  const { trigger, site, settings } = opts
  const siteName = getSiteName(settings)
  const siteUrl = opts.siteUrl || getSiteUrl() || 'http://localhost:3000'

  const [guildCount, errorCount, lastCheckRows] = await Promise.all([
    db.guild.count().catch(() => 0),
    db.guild.count({ where: { lastCheckStatus: 'error' } }).catch(() => 0),
    db.guild
      .findMany({ select: { lastCheckAt: true }, orderBy: { lastCheckAt: 'desc' }, take: 1 })
      .catch(() => []),
  ])
  const lastCheck = lastCheckRows[0]?.lastCheckAt ?? null

  const statusLabel = site.ok ? 'opérationnel' : 'indisponible'
  const vars: Record<string, string> = {
    site: siteName,
    status: statusLabel,
    latency: String(site.latencyMs),
    time: new Date().toISOString(),
    guilds: String(guildCount),
    errors: String(errorCount),
    url: siteUrl,
  }

  const template = sanitizeText(settings.webhookMessage, 500) || DEFAULT_WEBHOOK_MESSAGE
  const message = renderTemplate(template, vars)
  const mention = normalizeMention(settings.webhookMention)
  const content = [mention, message].filter(Boolean).join(' ').slice(0, 1900)

  const fields: Array<{ name: string; value: string; inline: boolean }> = [
    { name: 'Statut', value: site.ok ? '🟢 En ligne' : '🔴 Hors ligne', inline: true },
    { name: 'Latence', value: `${site.latencyMs} ms`, inline: true },
    { name: 'Déclencheur', value: trigger, inline: true },
  ]
  if (settings.webhookIncludeStats) {
    fields.push(
      { name: 'Serveurs suivis', value: String(guildCount), inline: true },
      { name: 'Erreurs', value: String(errorCount), inline: true },
      { name: 'Vérification', value: timeAgo(lastCheck), inline: true },
    )
  }

  return {
    guilds: guildCount,
    errors: errorCount,
    body: {
      username: siteName,
      content,
      embeds: [
        {
          title: site.ok ? `${siteName} est en ligne` : `${siteName} ne répond pas`,
          description: `Heartbeat automatique du site.\n${siteUrl}`,
          color: site.ok ? 0x22c55e : 0xef4444,
          fields,
          footer: { text: 'LinkHub · heartbeat' },
          timestamp: new Date().toISOString(),
        },
      ],
    },
  }
}

/** Pause non bloquante. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Lit le corps d'erreur de Discord UNE SEULE FOIS.
 * (Un `res.json()` appele deux fois leve une erreur et fait perdre le retry_after.)
 */
async function readDiscordError(res: Response): Promise<{ detail: string; retryAfter?: number }> {
  try {
    const payload = (await res.json()) as { message?: string; code?: number; retry_after?: number }
    return {
      detail: payload?.message || (payload?.code ? `code ${payload.code}` : ''),
      retryAfter: typeof payload?.retry_after === 'number' ? payload.retry_after : undefined,
    }
  } catch {
    return { detail: '' }
  }
}

/** Envoie un message au webhook Discord (?wait=true) et applique un retry sur 429. */
export async function postToDiscord(
  url: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; httpStatus: number; latencyMs: number; error?: string }> {
  const started = Date.now()
  const send = () =>
    fetch(`${url}?wait=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    })

  try {
    let res = await send()
    if (res.ok) return { ok: true, httpStatus: res.status, latencyMs: Date.now() - started }

    const first = await readDiscordError(res)
    if (res.status === 429) {
      // Discord indique le delai a respecter (secondes) : on le suit, borne a 5 s.
      const waitSeconds = Math.min(5, Math.max(1, first.retryAfter ?? 1))
      await sleep(waitSeconds * 1000)
      res = await send()
      const latencyMs = Date.now() - started
      if (res.ok) return { ok: true, httpStatus: res.status, latencyMs }
      const second = await readDiscordError(res)
      return {
        ok: false,
        httpStatus: res.status,
        latencyMs,
        error: `Discord ${res.status} (rate limit) ${second.detail || first.detail}`.trim(),
      }
    }

    return {
      ok: false,
      httpStatus: res.status,
      latencyMs: Date.now() - started,
      error: `Discord ${res.status}${first.detail ? ` : ${first.detail}` : ''}`,
    }
  } catch (e) {
    return {
      ok: false,
      httpStatus: 0,
      latencyMs: Date.now() - started,
      error: e instanceof Error ? e.message : 'envoi impossible',
    }
  }
}

let sending = false

/**
 * Envoie un heartbeat Discord.
 * - force=false : respecte enabled + intervalle (utilise par la boucle).
 * - force=true : envoi immediat (test / bouton "pinger maintenant").
 */
export async function sendWebhookPing(opts?: {
  force?: boolean
  trigger?: string
  siteUrl?: string
}): Promise<PingResult> {
  if (sending) return { ok: false, skipped: true, reason: 'busy' }
  sending = true
  try {
    const settings = await getSiteSettings()
    const url = settings.webhookUrlDecrypted
    const trigger = opts?.trigger || (opts?.force ? 'manual' : 'heartbeat')

    if (!url) {
      return { ok: false, skipped: true, reason: 'not_configured' }
    }
    if (!settings.webhookEnabled && !opts?.force) {
      return { ok: false, skipped: true, reason: 'disabled' }
    }
    if (!opts?.force && !isWebhookDue(settings.webhookLastSentAt, settings.webhookIntervalMinutes)) {
      return { ok: false, skipped: true, reason: 'not_due' }
    }

    const site = await checkSiteHealth()
    const { body } = await buildWebhookPayload({ trigger, site, settings, siteUrl: opts?.siteUrl })
    const sent = await postToDiscord(url, body)

    const now = new Date()
    try {
      await db.siteSettings.update({
        where: { id: 'main' },
        data: {
          webhookLastSentAt: now,
          webhookLastStatus: sent.ok ? 'ok' : 'error',
          webhookLastLatencyMs: sent.latencyMs,
          webhookLastHttpStatus: sent.httpStatus || null,
          webhookLastError: sent.error ? sent.error.slice(0, 500) : null,
          ...(sent.ok
            ? { webhookSuccessCount: { increment: 1 } }
            : { webhookFailureCount: { increment: 1 } }),
        },
      })
      await db.webhookDelivery.create({
        data: {
          status: sent.ok ? 'ok' : 'error',
          httpStatus: sent.httpStatus || null,
          latencyMs: sent.latencyMs,
          siteStatus: site.ok ? 'ok' : 'error',
          siteLatencyMs: site.latencyMs,
          error: sent.error ? sent.error.slice(0, 500) : null,
          trigger,
        },
      })
      // Garde les 50 derniers envois.
      const count = await db.webhookDelivery.count().catch(() => 0)
      if (count > 50) {
        const stale = await db.webhookDelivery
          .findMany({ orderBy: { createdAt: 'asc' }, take: count - 50, select: { id: true } })
          .catch(() => [])
        if (stale.length) {
          await db.webhookDelivery
            .deleteMany({ where: { id: { in: stale.map((s) => s.id) } } })
            .catch(() => {})
        }
      }
    } catch {
      // la mise a jour du statut ne doit pas masquer le resultat de l'envoi
    }

    return {
      ok: sent.ok,
      httpStatus: sent.httpStatus,
      latencyMs: sent.latencyMs,
      siteStatus: site.ok ? 'ok' : 'error',
      siteLatencyMs: site.latencyMs,
      error: sent.error,
      sentAt: now.toISOString(),
    }
  } finally {
    sending = false
  }
}

/** Config publique (staff) : jamais d'URL en clair. */
export async function getWebhookPublicConfig(): Promise<WebhookPublicConfig> {
  const settings = await getSiteSettings()
  let deliveries: WebhookDeliveryItem[] = []
  try {
    const rows = await db.webhookDelivery.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    deliveries = rows.map((r) => ({
      id: r.id,
      status: r.status,
      httpStatus: r.httpStatus,
      latencyMs: r.latencyMs,
      siteStatus: r.siteStatus,
      siteLatencyMs: r.siteLatencyMs,
      error: r.error,
      trigger: r.trigger,
      createdAt: r.createdAt.toISOString(),
    }))
  } catch {
    deliveries = []
  }
  return {
    configured: Boolean(settings.webhookUrlDecrypted),
    enabled: settings.webhookEnabled,
    intervalMinutes: settings.webhookIntervalMinutes,
    mention: settings.webhookMention,
    message: settings.webhookMessage,
    includeStats: settings.webhookIncludeStats,
    siteName: settings.siteName,
    maskedUrl: maskWebhookUrl(settings.webhookUrlDecrypted),
    status: settings.webhookLastStatus || 'never',
    lastSentAt: settings.webhookLastSentAt ? settings.webhookLastSentAt.toISOString() : null,
    lastLatencyMs: settings.webhookLastLatencyMs,
    lastHttpStatus: settings.webhookLastHttpStatus,
    lastError: settings.webhookLastError,
    successCount: settings.webhookSuccessCount,
    failureCount: settings.webhookFailureCount,
    deliveries,
    siteUrl: getSiteUrl(),
  }
}

export type SaveWebhookInput = {
  webhookUrl?: string
  enabled?: boolean
  intervalMinutes?: number
  mention?: string
  message?: string
  includeStats?: boolean
  siteName?: string
}

/** Enregistre les reglages du heartbeat (validation + chiffrement). */
export async function saveWebhookConfig(input: SaveWebhookInput): Promise<WebhookPublicConfig> {
  await ensureSiteSettings()
  const current = await getSiteSettings()

  let nextUrl = current.webhookUrlDecrypted
  if (typeof input.webhookUrl === 'string') {
    const trimmed = input.webhookUrl.trim()
    if (!trimmed) {
      nextUrl = null
    } else {
      if (!isValidWebhookUrl(trimmed)) {
        throw new Error(
          "URL de webhook invalide. Utilise l'URL complète fournie par Discord (https://discord.com/api/webhooks/...).",
        )
      }
      nextUrl = trimmed
    }
  }

  const enabled = typeof input.enabled === 'boolean' ? input.enabled : current.webhookEnabled
  if (enabled && !nextUrl) {
    throw new Error("Ajoute l'URL du webhook Discord avant d'activer la surveillance.")
  }

  const interval = Math.min(
    WEBHOOK_INTERVAL_MAX,
    Math.max(WEBHOOK_INTERVAL_MIN, Math.round(Number(input.intervalMinutes ?? current.webhookIntervalMinutes) || 5)),
  )

  const mention =
    input.mention === undefined ? current.webhookMention : normalizeMention(input.mention)
  const message =
    input.message === undefined
      ? current.webhookMessage
      : sanitizeText(input.message, 500) || null
  const includeStats =
    typeof input.includeStats === 'boolean' ? input.includeStats : current.webhookIncludeStats
  const siteName =
    input.siteName === undefined ? current.siteName : sanitizeText(input.siteName, 40) || null

  await db.siteSettings.update({
    where: { id: 'main' },
    data: {
      siteName,
      webhookUrl: nextUrl ? encryptSecret(nextUrl) : null,
      webhookEnabled: enabled,
      webhookIntervalMinutes: interval,
      webhookMention: mention,
      webhookMessage: message,
      webhookIncludeStats: includeStats,
      // si l'URL a change, on repart d'un statut "jamais" pour ne pas afficher
      // un ancien succes qui ne concerne plus la nouvelle destination.
      ...(nextUrl !== current.webhookUrlDecrypted
        ? {
            webhookLastStatus: 'never',
            webhookLastSentAt: null,
            webhookLastLatencyMs: null,
            webhookLastHttpStatus: null,
            webhookLastError: null,
          }
        : {}),
    },
  })

  return getWebhookPublicConfig()
}

/** Desactive et efface la configuration du webhook. */
export async function clearWebhookConfig(): Promise<WebhookPublicConfig> {
  await ensureSiteSettings()
  await db.siteSettings.update({
    where: { id: 'main' },
    data: {
      webhookUrl: null,
      webhookEnabled: false,
      webhookLastStatus: 'disabled',
      webhookLastError: null,
    },
  })
  return getWebhookPublicConfig()
}

/* ------------------------------------------------------------------ */
/* Boucle de heartbeat                                                 */
/* ------------------------------------------------------------------ */

let heartbeatStarted = false

/**
 * Demarre la boucle de heartbeat. Toutes les 30 s, on verifie si l'intervalle
 * configure (5 min par defaut) est ecoule ; si oui, on ping le site et on
 * envoie le message Discord. Aucune erreur ne remonte (le site doit rester fiable).
 */
export function startWebhookHeartbeat(): void {
  if (heartbeatStarted) return
  heartbeatStarted = true
  const g = globalThis as unknown as { __dlhWebhookHeartbeat?: boolean }
  if (g.__dlhWebhookHeartbeat) return
  g.__dlhWebhookHeartbeat = true

  const run = async () => {
    try {
      await sendWebhookPing()
    } catch {
      // silencieux : le statut est deja journalise en base
    }
  }

  const initial = setTimeout(run, 15_000)
  if (typeof initial.unref === 'function') initial.unref()
  const interval = setInterval(run, 30_000)
  if (typeof interval.unref === 'function') interval.unref()
  console.log('[webhook] heartbeat demarre : verification toutes les 30 s, envoi selon l’intervalle configure')
}
