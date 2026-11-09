import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'crypto'
import { db } from '@/lib/db'

/* ------------------------------------------------------------------ */
/* Secrets & chiffrement                                               */
/* ------------------------------------------------------------------ */

/**
 * Secret applicatif. En production, APP_SECRET doit etre defini : il sert a
 * signer les sessions et a chiffrer les secrets stockes (webhook Discord).
 * Le fallback de developpement est volontairement signale dans les logs.
 */
export function getAppSecret(): string {
  const secret = process.env.APP_SECRET
  if (secret && secret.length >= 16) return secret
  if (process.env.NODE_ENV === 'production') {
    console.warn(
      '[security] APP_SECRET absent ou trop court : les sessions et secrets utilises une cle de developpement. Definis APP_SECRET en production.',
    )
  }
  return secret || 'linkhub-dev-secret-change-me-32chars'
}

function encryptionKey(): Buffer {
  return scryptSync(getAppSecret(), 'linkhub.site-settings.v1', 32)
}

/** Chiffre un secret (URL de webhook) avec AES-256-GCM. Format : v1.iv.tag.data */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1.${iv.toString('hex')}.${tag.toString('hex')}.${data.toString('hex')}`
}

/** Dechiffre un secret produit par encryptSecret. Renvoie null si invalide. */
export function decryptSecret(payload: string | null | undefined): string | null {
  if (!payload) return null
  const parts = payload.split('.')
  if (parts.length !== 4 || parts[0] !== 'v1') return null
  try {
    const iv = Buffer.from(parts[1], 'hex')
    const tag = Buffer.from(parts[2], 'hex')
    const data = Buffer.from(parts[3], 'hex')
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}

/** Masque un secret pour l'affichage (jamais de valeur complete dans l'UI). */
export function maskSecret(value: string | null | undefined): string {
  if (!value) return ''
  if (value.length <= 8) return '••••••••'
  return `${value.slice(0, 4)}${'•'.repeat(Math.min(24, Math.max(8, value.length - 8)))}${value.slice(-4)}`
}

/** Masque une URL de webhook Discord : on garde l'hote, on cache id + token. */
export function maskWebhookUrl(value: string | null | undefined): string {
  if (!value) return ''
  try {
    const url = new URL(value)
    if (url.pathname.startsWith('/api/webhooks/')) {
      return `${url.protocol}//${url.host}/api/webhooks/••••••••/••••••••`
    }
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return value
    return `${url.protocol}//${url.host}${url.pathname}`
  } catch {
    return '••••••••'
  }
}

/* ------------------------------------------------------------------ */
/* Cles d'API                                                          */
/* ------------------------------------------------------------------ */

/** Nouvelle cle d'API en clair (montree une seule fois a l'utilisateur). */
export function generateApiKey(): string {
  return `dlh_${randomBytes(24).toString('hex')}`
}

/** Empreinte SHA-256 : la cle en clair n'est jamais stockee en base. */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key.trim()).digest('hex')
}

/** Jeton public (non secret) utilise dans les boutons HTML /api/v1/go. */
export function generatePublicId(): string {
  return randomBytes(16).toString('hex')
}

/** Empreinte d'une URL de webhook, pour l'audit sans stocker le secret. */
export function fingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

/** Signature HMAC utilisee par les sessions. */
export function hmac(value: string): string {
  return createHmac('sha256', getAppSecret()).update(value).digest('hex')
}

/** Comparaison a temps constant de deux chaines. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/* ------------------------------------------------------------------ */
/* Requetes, rate limiting, validation                                 */
/* ------------------------------------------------------------------ */

export function getClientIp(req: Request): string {
  const headers = req.headers
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return (
    headers.get('x-real-ip') ||
    headers.get('x-vercel-forwarded-for') ||
    headers.get('cf-connecting-ip') ||
    'inconnu'
  )
}

export function getRequestMeta(req: Request): { ip: string; userAgent: string } {
  return {
    ip: getClientIp(req),
    userAgent: (req.headers.get('user-agent') || '').slice(0, 300),
  }
}

type RateBucket = { count: number; resetAt: number }
const rateBuckets = new Map<string, RateBucket>()

export type RateLimitResult = {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number
  retryAfterSeconds: number
}

/**
 * Limiteur de debit en memoire (fenetre fixe). Suffisant pour une instance
 * unique ; pour un cluster multi-instances, brancher un store partage (Redis).
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  if (rateBuckets.size > 5000) {
    for (const [k, bucket] of rateBuckets) {
      if (bucket.resetAt <= now) rateBuckets.delete(k)
    }
  }
  let bucket = rateBuckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs }
    rateBuckets.set(key, bucket)
  }
  bucket.count += 1
  const allowed = bucket.count <= limit
  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  }
}

/** En-tetes HTTP standard pour exposer l'etat du rate limit. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.floor(result.resetAt / 1000)),
    ...(result.allowed ? {} : { 'Retry-After': String(result.retryAfterSeconds) }),
  }
}

/**
 * Protection CSRF : les requetes mutantes doivent venir de la meme origine.
 * Les requetes sans en-tete Origin/Referer (curl, server-to-server) sont
 * autorisees ; les navigateurs envoient toujours Origin sur les requetes
 * cross-site, ce qui bloque les formulaires malveillants.
 */
export function checkSameOrigin(req: Request): string | null {
  const source = req.headers.get('origin') || req.headers.get('referer')
  if (!source) return null
  try {
    const sourceUrl = new URL(source)
    const host =
      req.headers.get('x-forwarded-host') ||
      req.headers.get('host') ||
      new URL(req.url).host
    if (sourceUrl.host !== host) {
      return `Origine de la requete refusee (${sourceUrl.host}). Recharge la page puis reessaie.`
    }
    return null
  } catch {
    return null
  }
}

export function isSnowflake(value: unknown): value is string {
  return typeof value === 'string' && /^\d{17,20}$/.test(value)
}

/** Nettoie un texte libre : trim, sans caracteres de controle, longueur max. */
export function sanitizeText(value: unknown, max = 200): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, max)
}

/**
 * URL de webhook Discord autorisee : uniquement discord.com / discordapp.com.
 * En mode demo, un sink local est autorise pour tester le heartbeat.
 */
export function isValidWebhookUrl(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') {
      const localSink =
        process.env.DISCORD_API_BASE &&
        (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
        url.pathname.startsWith('/mock/webhook')
      if (!localSink) return false
    }
    if (url.protocol === 'https:') {
      const host = url.hostname.toLowerCase()
      if (host !== 'discord.com' && host !== 'discordapp.com' && host !== 'discord.com:443') {
        return false
      }
      return /^\/api\/webhooks\/\d{17,20}\/[\w-]{20,}$/.test(url.pathname)
    }
    return true
  } catch {
    return false
  }
}

/** Validation souple d'un token de bot Discord (3 segments, ~70-120 caracteres). */
export function isValidBotToken(value: string): boolean {
  if (!value || value.length < 50 || value.length > 200) return false
  if (/\s/.test(value)) return false
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)
}

/* ------------------------------------------------------------------ */
/* Audit                                                               */
/* ------------------------------------------------------------------ */

export type AuditAction =
  | 'auth.login'
  | 'auth.logout'
  | 'auth.logout.all'
  | 'config.discord.save'
  | 'config.bot.save'
  | 'config.webhook.save'
  | 'config.webhook.test'
  | 'config.webhook.delete'
  | 'apikey.create'
  | 'apikey.delete'
  | 'guild.share'
  | 'guild.update'
  | 'guild.remove'
  | 'security.blocked'

/** Journalise un evenement de securite. Ne doit jamais faire echouer la requete. */
export async function recordAudit(input: {
  action: AuditAction | string
  actorId?: string | null
  actorName?: string | null
  target?: string | null
  ip?: string | null
  userAgent?: string | null
  metadata?: Record<string, unknown> | null
}): Promise<void> {
  try {
    await db.auditEvent.create({
      data: {
        action: input.action,
        actorId: input.actorId || null,
        actorName: input.actorName || null,
        target: input.target || null,
        ip: input.ip || null,
        userAgent: input.userAgent || null,
        metadata: input.metadata ? JSON.stringify(input.metadata).slice(0, 2000) : null,
      },
    })
    // Garde un journal borne (500 derniers evenements). La purge est probabiliste
    // (1 evenement sur 50) : la faire a chaque ecriture ajoutait trois requetes
    // (count + findMany + deleteMany) a chaque log d'audit.
    if (Math.random() < 0.02) {
      const count = await db.auditEvent.count().catch(() => 0)
      if (count > 500) {
        const stale = await db.auditEvent
          .findMany({ orderBy: { createdAt: 'asc' }, take: count - 500, select: { id: true } })
          .catch(() => [])
        if (stale.length) {
          await db.auditEvent
            .deleteMany({ where: { id: { in: stale.map((s) => s.id) } } })
            .catch(() => {})
        }
      }
    }
  } catch {
    // table absente ou base indisponible : on ne bloque jamais le flux
  }
}
