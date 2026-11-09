/**
 * Client leger pour l'API Discord (v10).
 * Toutes les fonctions renvoient des donnees typees minimisees a ce dont la plateforme a besoin.
 */

// Base de l'API Discord (remplacable par un serveur de test via DISCORD_API_BASE)
export const DISCORD_API = process.env.DISCORD_API_BASE || 'https://discord.com/api/v10'

// Scopes OAuth valides chez Discord : identify (profil) + guilds (liste des serveurs).
// ATTENTION : Discord refuse les tokens UTILISATEUR sur les endpoints de serveur
// (GET /guilds/{id}/channels etc.) : le listing des salons et la creation d'invitations
// passent donc par un BOT ajoute au serveur (header "Authorization: Bot <token>"),
// pas par le token utilisateur. Le scope guilds sert uniquement a lister les serveurs.
export const DISCORD_SCOPES = ['identify', 'guilds'].join(' ')

// Bits de permissions Discord
export const PERM_ADMINISTRATOR = BigInt(0x8)
export const PERM_MANAGE_GUILD = BigInt(0x20)
export const PERM_CREATE_INSTANT_INVITE = BigInt(0x1)

export type DiscordTokens = {
  access_token: string
  refresh_token: string
  expires_in: number
  scope?: string
}

export type DiscordUser = {
  id: string
  username: string
  global_name?: string | null
  avatar?: string | null
  email?: string | null
}

export type DiscordGuild = {
  id: string
  name: string
  icon: string | null
  owner?: boolean
  permissions?: string
}

export type DiscordChannel = {
  id: string
  name: string
  type: number
  position?: number
}

export type DiscordInvite = {
  code: string
  uses: number
  max_uses: number
  max_age: number
  inviter?: { id: string } | null
  channel?: { id: string; name: string } | null
}

export type InviteMeta = {
  code?: string
  uses?: number
  max_age?: number
  approximate_member_count?: number
  approximate_presence_count?: number
  expires_at?: string | null
}

/** Erreur cote Discord, avec le statut HTTP pour distinguer "bot absent" (403/404) d'un token invalide (401). */
export class DiscordApiError extends Error {
  status: number
  retryAfter?: number
  constructor(status: number, message: string, retryAfter?: number) {
    super(message)
    this.status = status
    this.retryAfter = retryAfter
  }
}

/** Attend un nombre de millisecondes (sans bloquer le process). */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Vrai si l'echec vient du fait que le bot n'est pas (ou plus) membre du serveur. */
export function isBotNotInGuild(e: unknown): boolean {
  return e instanceof DiscordApiError && (e.status === 403 || e.status === 404)
}

/**
 * Vrai si Discord affirme que l'invitation n'existe plus (404 "Unknown Invite").
 * C'est le SEUL cas ou il faut en regenerer une : une erreur reseau, un 429 ou un 5xx
 * ne prouvent rien sur l'etat de l'invitation.
 */
export function isUnknownInviteError(e: unknown): boolean {
  return e instanceof DiscordApiError && e.status === 404
}

/**
 * Vrai si l'echec est probablement temporaire (reseau/timeout = status 0, 429 apres
 * les retentatives, 5xx). Ces erreurs ne doivent jamais declencher de regeneration :
 * un incident Discord ne doit pas recreer toutes les invitations de la plateforme.
 */
export function isTransientDiscordError(e: unknown): boolean {
  if (!(e instanceof DiscordApiError)) return true
  return e.status === 0 || e.status === 429 || e.status >= 500
}

export function hasPermission(permissions: string | undefined, flag: bigint): boolean {
  if (!permissions) return false
  try {
    return (BigInt(permissions) & flag) === flag
  } catch {
    return false
  }
}

export function canCreateInvites(guild: DiscordGuild): boolean {
  return (
    hasPermission(guild.permissions, PERM_ADMINISTRATOR) ||
    hasPermission(guild.permissions, PERM_MANAGE_GUILD) ||
    hasPermission(guild.permissions, PERM_CREATE_INSTANT_INVITE)
  )
}

export function isAdministrator(guild: DiscordGuild): boolean {
  return hasPermission(guild.permissions, PERM_ADMINISTRATOR)
}

export function guildIconUrl(guildId: string, icon: string | null | undefined, size = 128): string | null {
  if (!icon) return null
  const ext = icon.startsWith('a_') ? 'gif' : 'png'
  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.${ext}?size=${size}`
}

export function userAvatarUrl(userId: string, avatar: string | null | undefined, size = 128): string | null {
  if (!avatar) return null
  const ext = avatar.startsWith('a_') ? 'gif' : 'png'
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${ext}?size=${size}`
}

export function buildAuthorizeUrl(
  clientId: string,
  redirectUri: string,
  state: string,
  opts?: { authorizeBase?: string; transformPort?: string },
): string {
  const url = new URL(
    opts?.authorizeBase || process.env.DISCORD_AUTHORIZE_URL || 'https://discord.com/oauth2/authorize',
  )
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', DISCORD_SCOPES)
  url.searchParams.set('state', state)
  url.searchParams.set('prompt', 'consent')
  // Mode demo : le mock Discord est joignable uniquement via la passerelle (XTransformPort)
  if (opts?.transformPort) url.searchParams.set('XTransformPort', opts.transformPort)
  return url.toString()
}

async function discordFetch<T>(path: string, init?: RequestInit, attempt = 0): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${DISCORD_API}${path}`, {
      ...init,
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    })
  } catch (e) {
    if (attempt < 1) {
      await sleep(400)
      return discordFetch<T>(path, init, attempt + 1)
    }
    throw new DiscordApiError(0, e instanceof Error ? e.message : 'Discord injoignable')
  }

  if (res.status === 429 && attempt < 1) {
    let retryAfter = 1
    try {
      const body = (await res.json()) as { retry_after?: number }
      retryAfter = Math.min(5, Math.max(0.25, Number(body?.retry_after) || 1))
    } catch {
      // pas de corps JSON
    }
    await sleep(retryAfter * 1000)
    return discordFetch<T>(path, init, attempt + 1)
  }

  if (res.status >= 500 && attempt < 1) {
    await sleep(400)
    return discordFetch<T>(path, init, attempt + 1)
  }

  if (!res.ok) {
    let detail = ''
    let retryAfter: number | undefined
    try {
      const body = (await res.json()) as { error?: string; message?: string; retry_after?: number }
      detail = body?.error || body?.message || ''
      retryAfter = body?.retry_after
    } catch {
      // pas de corps JSON
    }
    throw new DiscordApiError(
      res.status,
      `Discord API ${res.status} ${detail}`.trim(),
      retryAfter,
    )
  }
  return (await res.json()) as T
}

/** Echange le code d'autorisation contre des tokens. */
export function exchangeCode(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
): Promise<DiscordTokens> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  })
  return discordFetch<DiscordTokens>('/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
}

/** Rafraichit un access token expire. Attention : le refresh token est rotatif, il faut le re-stocker. */
export function refreshAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<DiscordTokens> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })
  return discordFetch<DiscordTokens>('/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
}

export function fetchMe(accessToken: string): Promise<DiscordUser> {
  return discordFetch<DiscordUser>('/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

export function fetchUserGuilds(accessToken: string): Promise<DiscordGuild[]> {
  return discordFetch<DiscordGuild[]>('/users/@me/guilds', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

export function fetchGuildChannels(accessToken: string, guildId: string): Promise<DiscordChannel[]> {
  return discordFetch<DiscordChannel[]>(`/guilds/${guildId}/channels`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

/** Cree une invitation permanente (max_age = 0 => n'expire jamais). */
export function createChannelInvite(
  accessToken: string,
  channelId: string,
  maxAge = 0,
  maxUses = 0,
): Promise<DiscordInvite> {
  return discordFetch<DiscordInvite>(`/channels/${channelId}/invites`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ max_age: maxAge, max_uses: maxUses, unique: true }),
  })
}

export function listChannelInvites(accessToken: string, channelId: string): Promise<DiscordInvite[]> {
  return discordFetch<DiscordInvite[]>(`/channels/${channelId}/invites`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

export function listGuildInvites(accessToken: string, guildId: string): Promise<DiscordInvite[]> {
  return discordFetch<DiscordInvite[]>(`/guilds/${guildId}/invites`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

/** Informations publiques d'une invitation (compteurs approximatifs de membres). */
export function fetchInviteMeta(code: string): Promise<InviteMeta> {
  return discordFetch<InviteMeta>(`/invites/${code}?with_counts=true`)
}

/* ---------------------- Endpoints via le BOT de la plateforme ---------------------- */
/* Lister les salons et creer des invitations exige un bot membre du serveur :
 * Discord renvoie 401/403 a tout token utilisateur sur ces endpoints. */

/** Verifie que le bot est membre du serveur (403 si absent, 200 sinon). */
export function fetchGuildAsBot(botToken: string, guildId: string): Promise<{ id: string; name: string }> {
  return botFetch<{ id: string; name: string }>(`/guilds/${guildId}`, botToken)
}

/** Liste les salons du serveur avec le bot. */
export function fetchGuildChannelsAsBot(botToken: string, guildId: string): Promise<DiscordChannel[]> {
  return botFetch<DiscordChannel[]>(`/guilds/${guildId}/channels`, botToken)
}

/** Cree une invitation permanente avec le bot (max_age = 0 => n'expire jamais). */
export function createChannelInviteAsBot(
  botToken: string,
  channelId: string,
  maxAge = 0,
  maxUses = 0,
): Promise<DiscordInvite> {
  return botFetch<DiscordInvite>(`/channels/${channelId}/invites`, botToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ max_age: maxAge, max_uses: maxUses, unique: true }),
  })
}

/** Requete avec le token du bot (header "Authorization: Bot"). */
async function botFetch<T>(path: string, botToken: string, init?: RequestInit): Promise<T> {
  return discordFetch<T>(path, {
    ...init,
    headers: { ...(init?.headers || {}), Authorization: `Bot ${botToken}` },
  })
}
