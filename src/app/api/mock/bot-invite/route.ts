import { MOCK_PORT, isMockMode, redirectRaw } from '@/lib/config'
import { getClientIp, isSnowflake, rateLimit, rateLimitHeaders } from '@/lib/security'
import { clearBotPresenceCache } from '@/lib/bot-presence'

// GET /api/mock/bot-invite?guild_id=... -> ajoute le bot au serveur simule (mode demo)
// puis ramene l'utilisateur sur la page Serveurs. En production, cette route est inerte.
export async function GET(req: Request) {
  if (!isMockMode()) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const ip = getClientIp(req)
  const limit = rateLimit(`mock-bot:${ip}`, 20, 60_000)
  if (!limit.allowed) {
    return Response.json(
      { error: 'Trop de tentatives. Reessaie dans une minute.' },
      { status: 429, headers: rateLimitHeaders(limit) },
    )
  }

  const url = new URL(req.url)
  const guildId = url.searchParams.get('guild_id')
  if (guildId && !isSnowflake(guildId)) {
    return Response.json({ error: 'Identifiant de serveur invalide.' }, { status: 400 })
  }

  try {
    const res = await fetch(`http://localhost:${MOCK_PORT}/mock/bot-invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guild_id: guildId }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) throw new Error(`mock ${res.status}`)
  } catch {
    return Response.json(
      { error: 'Le Discord simulé est injoignable. Vérifie que le serveur de démo tourne sur le port 3030.' },
      { status: 500 },
    )
  }

  if (guildId) clearBotPresenceCache(guildId)

  // Location relative : le navigateur la résout sur l'origin courant (preview).
  return redirectRaw('/dashboard/serveurs?bot_added=1')
}
