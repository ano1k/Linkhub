import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export type DiscordConfig = {
  clientId: string
  clientSecret: string
  botToken: string
}

/**
 * Redirection avec Location RELATIVE : le navigateur la resout sur l'origine courante
 * (https en preview), ce qui rend le flux immunise contre les proxys qui perdent le protocole.
 */
export function redirectRelative(location: string, status = 307): NextResponse {
  return new NextResponse(null, { status, headers: { Location: location } })
}

/**
 * Determine le protocole public vu par le navigateur.
 * Chaine typique : navigateur (https) -> passerelle externe (termine le TLS, parle http)
 * -> Caddy :81 (ecrase X-Forwarded-Proto avec "http") -> Next.js.
 * On ne peut donc pas se fier aveuglement a X-Forwarded-Proto :
 *  1. override explicite PUBLIC_BASE_URL
 *  2. liste "https,http" (le premier est le proto client d'origine)
 *  3. heuristique domaine de preview (*.space-z.ai) => https
 *  4. X-Forwarded-Proto simple / protocole de l'URL de la requete
 */
export function detectPublicProto(req: Request): 'https' | 'http' {
  const override = process.env.PUBLIC_BASE_URL
  if (override) {
    try {
      return new URL(override).protocol === 'https:' ? 'https' : 'http'
    } catch {
      // PUBLIC_BASE_URL invalide : on ignore
    }
  }

  const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').trim()
  const isPreviewHost = /(^|\.)space-z\.ai(:|$)/i.test(host)

  const xf = req.headers.get('x-forwarded-proto')
  if (xf) {
    const parts = xf
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
    if (parts.length > 1 && (parts[0] === 'https' || parts[0] === 'http')) {
      return parts[0] as 'https' | 'http'
    }
    if (parts[0] === 'https') return 'https'
    if (parts[0] === 'http' && isPreviewHost) return 'https'
  } else if (isPreviewHost) {
    return 'https'
  }

  try {
    return new URL(req.url).protocol === 'https:' ? 'https' : 'http'
  } catch {
    return 'http'
  }
}

/** Port du serveur Discord simule (mock) utilise en mode demo. */
export const MOCK_PORT = process.env.DISCORD_MOCK_PORT || '3030'

/**
 * Mode demo : DISCORD_API_BASE pointe vers le serveur Discord simule (mini-services/mock-discord).
 * Dans ce mode, aucune requete ne part vers le vrai Discord : la connexion, les serveurs,
 * les invitations et les refresh fonctionnent avec des donnees de test, sans identifiants reels.
 */
export function isMockMode(): boolean {
  return Boolean(process.env.DISCORD_API_BASE)
}

/**
 * Recupere les identifiants de l'application Discord (+ token du bot).
 * Priorite : configuration sauvegardee en base (via les Reglages du site) puis variables d'environnement.
 * En mode demo, des identifiants factures sont fournis automatiquement pour que la connexion fonctionne sans reglage.
 * Le token du bot est lu via une requete brute tolérante : si la colonne discordBotToken
 * n'existe pas encore (migration SQL non appliquee), le reste de la plateforme continue de fonctionner.
 */
export async function getDiscordConfig(): Promise<DiscordConfig> {
  let botToken = process.env.DISCORD_BOT_TOKEN || ''
  if (isMockMode()) {
    const row = await db.appConfig.findUnique({ where: { id: 'main' } }).catch(() => null)
    if (row?.discordClientId && row?.discordClientSecret) {
      return { clientId: row.discordClientId, clientSecret: row.discordClientSecret, botToken }
    }
    return { clientId: 'demo-client-id', clientSecret: 'demo-client-secret', botToken: '' }
  }
  let clientId = process.env.DISCORD_CLIENT_ID || ''
  let clientSecret = process.env.DISCORD_CLIENT_SECRET || ''
  try {
    const row = await db.appConfig.findUnique({ where: { id: 'main' } })
    if (row?.discordClientId) clientId = row.discordClientId
    if (row?.discordClientSecret) clientSecret = row.discordClientSecret
  } catch {
    // base non initialisee : on retombe sur les variables d'environnement
  }
  try {
    const rows = await db.$queryRawUnsafe<{ discordBotToken: string | null }[]>(
      'SELECT discordBotToken FROM AppConfig WHERE id = \'main\'',
    )
    if (Array.isArray(rows) && rows[0]?.discordBotToken) botToken = rows[0].discordBotToken
  } catch {
    // colonne discordBotToken absente (migration pas encore appliquee) : on ignore
  }
  return { clientId, clientSecret, botToken }
}

/**
 * URL pour ajouter le bot de l'application a un serveur Discord.
 * permissions = VIEW_CHANNEL (1024) + CREATE_INSTANT_INVITE (1) : le minimum requis
 * pour lister les salons et creer les invitations.
 */
export function buildBotInviteUrl(clientId: string, guildId?: string): string {
  if (!clientId) return ''
  const url = new URL('https://discord.com/oauth2/authorize')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('scope', 'bot')
  url.searchParams.set('permissions', '1025')
  if (guildId) {
    url.searchParams.set('guild_id', guildId)
    url.searchParams.set('disable_guild_select', 'true')
  }
  return url.toString()
}

export function isDiscordConfigured(config: DiscordConfig): boolean {
  return Boolean(config.clientId && config.clientSecret)
}

/** URL de redirection OAuth (absolue : exigee par Discord et verifiee a l'echange du code). */
export function buildRedirectUri(req: Request): string {
  if (process.env.PUBLIC_BASE_URL) {
    return `${process.env.PUBLIC_BASE_URL.replace(/\/$/, '')}/api/auth/discord/callback`
  }
  return `${detectPublicProto(req)}://${buildHost(req)}/api/auth/discord/callback`
}

/** Host public de la requete (derriere un ou plusieurs proxys). */
export function buildHost(req: Request): string {
  const url = new URL(req.url)
  return (
    req.headers.get('x-forwarded-host') ||
    req.headers.get('host') ||
    url.host
  )
}

/** URL publique de la plateforme (utilisee dans la documentation de l'API). */
export function buildBaseUrl(req: Request): string {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL.replace(/\/$/, '')
  }
  return `${detectPublicProto(req)}://${buildHost(req)}`
}
