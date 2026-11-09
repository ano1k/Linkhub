import { DiscordApiError, fetchGuildAsBot, isBotNotInGuild } from '@/lib/discord'

/**
 * Verifie la presence du bot de la plateforme sur un serveur Discord.
 * Un cache de 60 s evite de rappeler Discord pour chaque serveur a chaque
// rafraichissement du tableau de bord. Le cache est place sur globalThis pour
// etre partage entre les bundles de routes Next.js.
 */
type Presence = { present: boolean; at: number }
type PresenceError = 'invalid_token' | 'check_failed'

const globalForPresence = globalThis as unknown as {
  __linkhubBotPresence?: Map<string, Presence>
}

const cache: Map<string, Presence> = globalForPresence.__linkhubBotPresence ?? new Map()
globalForPresence.__linkhubBotPresence = cache

// Aligne sur le cycle du verificateur d'invitations (5 min) : la presence du bot
// ne change pas plus vite, et chaque entree expiree coute un appel Discord.
const TTL_MS = 5 * 60_000

export async function checkBotPresence(
  botToken: string,
  guildId: string,
): Promise<{ present: boolean; error?: PresenceError }> {
  const cached = cache.get(guildId)
  if (cached && Date.now() - cached.at < TTL_MS) {
    return { present: cached.present }
  }

  try {
    await fetchGuildAsBot(botToken, guildId)
    cache.set(guildId, { present: true, at: Date.now() })
    return { present: true }
  } catch (e) {
    if (isBotNotInGuild(e)) {
      cache.set(guildId, { present: false, at: Date.now() })
      return { present: false }
    }
    if (e instanceof DiscordApiError && e.status === 401) {
      return { present: false, error: 'invalid_token' }
    }
    return { present: false, error: 'check_failed' }
  }
}

/** Invalide le cache (ajout/retrait du bot, changement de token). */
export function clearBotPresenceCache(guildId?: string): void {
  if (guildId) cache.delete(guildId)
  else cache.clear()
}
