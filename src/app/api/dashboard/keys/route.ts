import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { buildBaseUrl } from '@/lib/config'
import {
  checkSameOrigin,
  generateApiKey,
  generatePublicId,
  getRequestMeta,
  hashApiKey,
  rateLimit,
  rateLimitHeaders,
  recordAudit,
  sanitizeText,
} from '@/lib/security'
import { publicKeyLabel } from '@/lib/apiKeys'

// GET /api/dashboard/keys -> liste des cles de l'utilisateur (jamais la cle en clair)
export async function GET(req: Request) {
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Non connecte.' }, { status: 401 })

  const limit = rateLimit(`keys:${user.id}`, 60, 60_000)
  if (!limit.allowed) {
    return Response.json(
      { error: 'Trop de requetes. Reessaie dans un instant.' },
      { status: 429, headers: rateLimitHeaders(limit) },
    )
  }

  const keys = await db.apiKey.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })
  return Response.json(
    {
      keys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        keyPrefix: publicKeyLabel(k),
        publicId: k.publicId,
        lastUsedAt: k.lastUsedAt,
        lastIp: k.lastIp,
        requestCount: k.requestCount,
        createdAt: k.createdAt,
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

// POST /api/dashboard/keys -> cree une nouvelle cle { name }
// La cle en clair est renvoyee UNE SEULE FOIS ; seule son empreinte SHA-256 est stockee.
export async function POST(req: Request) {
  const originError = checkSameOrigin(req)
  if (originError) return Response.json({ error: originError }, { status: 403 })

  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Non connecte.' }, { status: 401 })

  const meta = getRequestMeta(req)
  const limit = rateLimit(`keys-create:${user.id}`, 10, 60_000)
  if (!limit.allowed) {
    return Response.json(
      { error: 'Trop de creations. Reessaie dans une minute.' },
      { status: 429, headers: rateLimitHeaders(limit) },
    )
  }

  let body: { name?: string }
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const name = sanitizeText(body.name, 60) || 'Ma cle'
  if (name.length > 60) {
    return Response.json({ error: 'Nom trop long (60 caracteres max).' }, { status: 400 })
  }

  const existing = await db.apiKey.count({ where: { userId: user.id } })
  if (existing >= 25) {
    return Response.json(
      { error: "Limite de 25 cles atteinte : supprime une cle avant d'en creer une nouvelle." },
      { status: 400 },
    )
  }

  const plaintext = generateApiKey()
  const keyHash = hashApiKey(plaintext)
  const publicId = generatePublicId()
  const keyPrefix = `dlh_${plaintext.slice(4, 12)}`
  const baseUrl = buildBaseUrl(req)

  const created = await db.apiKey.create({
    data: {
      key: keyPrefix,
      keyHash,
      keyPrefix,
      publicId,
      name,
      userId: user.id,
    },
  })

  await recordAudit({
    action: 'apikey.create',
    actorId: user.id,
    actorName: user.username,
    target: created.id,
    ip: meta.ip,
    userAgent: meta.userAgent,
    metadata: { name, keyPrefix },
  })

  return Response.json(
    {
      key: {
        id: created.id,
        name: created.name,
        // ⚠️ seule occurrence de la cle en clair
        key: plaintext,
        keyPrefix,
        publicId,
        directUrlTemplate: `${baseUrl}/api/v1/go/{discordId}?ref=${publicId}`,
        createdAt: created.createdAt,
      },
    },
    { status: 201, headers: { 'Cache-Control': 'no-store' } },
  )
}
