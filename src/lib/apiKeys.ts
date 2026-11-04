import { db } from '@/lib/db'
import type { ApiKey } from '@prisma/client'

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

export type ApiKeyAuth =
  | { ok: true; apiKey: ApiKey }
  | { ok: false; status: number; error: string; message: string }

// Limitateur de debit en memoire : 120 requetes / minute / cle
const RATE_LIMIT = 120
const RATE_WINDOW_MS = 60_000
const buckets = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  bucket.count += 1
  return bucket.count <= RATE_LIMIT
}

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
  const apiKey = await db.apiKey.findUnique({ where: { key } })
  if (!apiKey) {
    return {
      ok: false,
      status: 401,
      error: 'invalid_api_key',
      message: "Cette cle d'API est invalide ou a ete supprimee.",
    }
  }
  if (!checkRateLimit(apiKey.id)) {
    return {
      ok: false,
      status: 429,
      error: 'rate_limited',
      message: 'Limite de 120 requetes par minute atteinte. Reessaie dans un instant.',
    }
  }
  // Mise a jour des statistiques (non bloquante)
  db.apiKey
    .update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date(), requestCount: { increment: 1 } },
    })
    .catch(() => {})
  return { ok: true, apiKey }
}

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'X-API-Key, Content-Type',
  'Access-Control-Max-Age': '86400',
}

export function apiJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

export function apiError(status: number, error: string, message: string): Response {
  return apiJson({ ok: false, error, message }, status)
}
