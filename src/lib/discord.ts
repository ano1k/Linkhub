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
export const PERM_ADMINISTRATOR = 0x8n
export const PERM_MANAGE_GUILD = 0x20n
export const PERM_CREATE_INSTANT_INVITE = 0x1n

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
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Vrai si l'echec vient du fait que le bot n'est pas (ou plus) membre du serveur. */
export function isBotNotInGuild(e: unknown): boolean {
  return e instanceof DiscordApiError && (e.status === 403 || e.status === 404)
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

async function discordFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${DISCORD_API}${path}`, { ...init, cache: 'no-store' })
  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json()
      detail = body?.error || body?.message || ''
    } catch {
      // pas de corps JSON
    }
    throw new DiscordApiError(res.status, `Discord API ${res.status} ${detail}`.trim())
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
