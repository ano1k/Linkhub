import { db } from '@/lib/db'
import type { ApiKey } from '@/generated/prisma/client'
import {
  generatePublicId,
  getClientIp,
  hashApiKey,
  rateLimit,
  rateLimitHeaders,
  type RateLimitResult,
} from '@/lib/security'

/** Verifie la cle d'API d'une requete (header X-API-Key prioritaire, sinon ?key=). */
export function extractApiKey(req: Request): string | null {
  const header = req.headers.get('x-api-key')
  if (header) return header.trim()
  try {
    const q = new URL(req.url).searchParams.get('key')
    return q ? q.trim() : null
  } catch {
    return null
  }
}

/** Jeton public des boutons HTML (?ref=...), non secret. */
export function extractPublicId(req: Request): string | null {
  try {
    const params = new URL(req.url).searchParams
    const ref = params.get('ref') || params.get('public_id')
    return ref ? ref.trim() : null
  } catch {
    return null
  }
}

export type ApiKeyAuth =
  | { ok: true; apiKey: ApiKey; rateLimit: RateLimitResult; headers: Record<string, string> }
  | {
      ok: false
      status: number
      error: string
      message: string
      headers?: Record<string, string>
    }

// Limites de debit en memoire.
const RATE_LIMIT = 120
const RATE_WINDOW_MS = 60_000
const IP_RATE_LIMIT = 300

/**
 * Authentifie une cle d'API.
 * - nouvelle generation : recherche par empreinte SHA-256 (la cle en clair n'est pas stockee)
 * - ancienne generation : recherche par la cle en clair (compatibilite ascendante)
 */
export async function authenticateApiKey(req: Request): Promise<ApiKeyAuth> {
  const key = extractApiKey(req)
  if (!key) {
    return {
      ok: false,
      status: 401,
      error: 'missing_api_key',
      message: "Fournis ta cle d'API via le header X-API-Key ou le parametre ?key=.",
    }
  }

  let apiKey = await db.apiKey
    .findUnique({ where: { keyHash: hashApiKey(key) } })
    .catch(() => null)
  if (!apiKey) {
    apiKey = await db.apiKey.findFirst({ where: { key } }).catch(() => null)
    // Migration douce des anciennes clés : on génère un jeton public pour les
    // boutons HTML afin de ne plus jamais exposer la clé en clair dans une URL.
    if (apiKey && !apiKey.keyHash) {
      const publicId = generatePublicId()
      const keyPrefix = apiKey.keyPrefix || `dlh_${apiKey.key.slice(4, 12)}`
      const updated = await db.apiKey
        .update({ where: { id: apiKey.id }, data: { publicId, keyPrefix } })
        .catch(() => null)
      if (updated) apiKey = updated
    }
  }

  if (!apiKey) {
    return {
      ok: false,
      status: 401,
      error: 'invalid_api_key',
      message: "Cette cle d'API est invalide ou a ete supprimee.",
    }
  }

  const ip = getClientIp(req)
  const ipLimit = rateLimit(`ip:${ip}`, IP_RATE_LIMIT, RATE_WINDOW_MS)
  if (!ipLimit.allowed) {
    return {
      ok: false,
      status: 429,
      error: 'rate_limited',
      message: 'Trop de requetes depuis cette adresse IP. Reessaie dans un instant.',
      headers: rateLimitHeaders(ipLimit),
    }
  }

  const limit = rateLimit(`key:${apiKey.id}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!limit.allowed) {
    return {
      ok: false,
      status: 429,
      error: 'rate_limited',
      message: 'Limite de 120 requetes par minute atteinte. Reessaie dans un instant.',
      headers: rateLimitHeaders(limit),
    }
  }

  // Statistiques non bloquantes.
  db.apiKey
    .update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date(), lastIp: ip, requestCount: { increment: 1 } },
    })
    .catch(() => {})

  return { ok: true, apiKey, rateLimit: limit, headers: {} }
}

/**
 * Authentifie une requete de redirection publique (/api/v1/go).
 * Accepte le jeton public (non secret) pour les boutons HTML, ou une cle d'API
 * pour les anciennes integrations. La cle complete n'est jamais necessaire.
 */
export async function authenticateGoRequest(
  req: Request,
): Promise<
  | { ok: true; apiKey: ApiKey; via: 'public' | 'key'; rateLimit: RateLimitResult; headers: Record<string, string> }
  | { ok: false; status: number; error: string; message: string; headers?: Record<string, string> }
> {
  const publicId = extractPublicId(req)
  if (publicId) {
    const apiKey = await db.apiKey
      .findUnique({ where: { publicId } })
      .catch(() => null)
    if (!apiKey) {
      return {
        ok: false,
        status: 401,
        error: 'invalid_public_ref',
        message: 'Ce jeton de redirection est invalide ou a ete revoque.',
      }
    }
    const limit = rateLimit(`ref:${apiKey.id}`, 120, RATE_WINDOW_MS)
    if (!limit.allowed) {
      return {
        ok: false,
        status: 429,
        error: 'rate_limited',
        message: 'Trop de redirections. Reessaie dans un instant.',
        headers: rateLimitHeaders(limit),
      }
    }
    db.apiKey
      .update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date(), requestCount: { increment: 1 } },
      })
      .catch(() => {})
    return { ok: true, apiKey, via: 'public', rateLimit: limit, headers: {} }
  }

  const auth = await authenticateApiKey(req)
  if (!auth.ok) return auth
  return { ...auth, via: 'key', headers: {} }
}

/** Libelle public d'une cle : jamais la cle complete. */
export function publicKeyLabel(apiKey: ApiKey): string {
  if (apiKey.keyPrefix) return apiKey.keyPrefix
  const legacy = apiKey.key
  if (legacy.length > 12) return `${legacy.slice(0, 8)}••••${legacy.slice(-4)}`
  return 'dlh_••••••••'
}

/** Construit l'URL de redirection publique (bouton HTML) avec le jeton public. */
export function buildDirectGoUrl(
  baseUrl: string,
  discordId: string,
  apiKey: Pick<ApiKey, 'publicId' | 'key'>,
): string {
  if (apiKey.publicId) return `${baseUrl}/api/v1/go/${discordId}?ref=${apiKey.publicId}`
  return `${baseUrl}/api/v1/go/${discordId}?key=${apiKey.key}`
}

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'X-API-Key, Content-Type',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin',
}

export function apiJson(
  data: unknown,
  status = 200,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS, ...extraHeaders },
  })
}

export function apiError(
  status: number,
  error: string,
  message: string,
  extraHeaders?: Record<string, string>,
): Response {
  return apiJson({ ok: false, error, message }, status, extraHeaders)
}
