export type SessionUser = {
  id: string
  username: string
  globalName: string | null
  avatarUrl: string | null
  isStaff: boolean
}

export type AppConfigInfo = {
  discordConfigured: boolean
  mockMode: boolean
  clientId: string | null
  redirectUri: string
  baseUrl: string
}

export type SharedGuild = {
  discordId: string
  name: string
  iconUrl: string | null
  isAdmin: boolean | null
  accessible: boolean
  shared: true
  channelId: string | null
  channelName: string | null
  memberCount: number | null
  onlineCount: number | null
  inviteCode: string | null
  inviteUrl: string | null
  uses: number
  lastCheckAt: string | null
  lastCheckStatus: string | null
  lastCheckMsg: string | null
}

export type AvailableGuild = {
  discordId: string
  name: string
  iconUrl: string | null
  isAdmin: boolean
  accessible: true
  shared: false
}

export type DashboardGuildsResponse = {
  guilds: SharedGuild[]
  available: AvailableGuild[]
}

export type ApiKeyItem = {
  id: string
  key: string
  name: string
  lastUsedAt: string | null
  requestCount: number
  createdAt: string
}

export type ChannelItem = {
  id: string
  name: string
}
