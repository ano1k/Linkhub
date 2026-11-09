export type SessionUser = {
  id: string
  username: string
  globalName: string | null
  avatarUrl: string | null
  isStaff: boolean
}

export type WebhookSummary = {
  configured: boolean
  enabled: boolean
  intervalMinutes: number
  status: string
  lastSentAt: string | null
  lastLatencyMs: number | null
  successCount: number
  failureCount: number
}

export type AppConfigInfo = {
  discordConfigured: boolean
  mockMode: boolean
  clientId: string | null
  botConfigured: boolean
  addBotUrl: string | null
  redirectUri: string
  baseUrl: string
  version?: string
  /** `SETUP_TOKEN` est defini : la premiere configuration exige ce jeton. */
  setupTokenRequired?: boolean
  webhook?: WebhookSummary | null
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
  lastCheckLatencyMs?: number | null
  failureCount?: number
  clicks?: ClickSummary
}

/** Clics enregistres sur le lien partage (aucune donnee personnelle). */
export type ClickSummary = {
  today: number
  last7Days: number
  last30Days: number
  /** Clics par jour sur 7 jours, du plus ancien au plus récent. */
  series: number[]
}

export type AvailableGuild = {
  discordId: string
  name: string
  iconUrl: string | null
  isAdmin: boolean
  accessible: true
  shared: false
}

export type MissingBotGuild = {
  discordId: string
  name: string
  iconUrl: string | null
  isAdmin: boolean
  shared: boolean
  inviteUrl: string
}

export type DashboardGuildsResponse = {
  guilds: SharedGuild[]
  available: AvailableGuild[]
  missingBot: MissingBotGuild[]
  botConfigured: boolean
  botError?: string | null
}

export type ApiKeyItem = {
  id: string
  name: string
  keyPrefix: string
  publicId: string | null
  lastUsedAt: string | null
  lastIp?: string | null
  requestCount: number
  createdAt: string
}

export type CreatedApiKey = {
  id: string
  name: string
  key: string
  keyPrefix: string
  publicId: string
  directUrlTemplate: string
  createdAt: string
}

export type ChannelItem = {
  id: string
  name: string
}

export type WebhookDeliveryItem = {
  id: string
  status: string
  httpStatus: number | null
  latencyMs: number | null
  siteStatus: string | null
  siteLatencyMs: number | null
  error: string | null
  trigger: string | null
  createdAt: string
}

export type WebhookConfig = {
  configured: boolean
  enabled: boolean
  intervalMinutes: number
  mention: string | null
  message: string | null
  includeStats: boolean
  siteName: string | null
  maskedUrl: string
  status: string
  lastSentAt: string | null
  lastLatencyMs: number | null
  lastHttpStatus: number | null
  lastError: string | null
  successCount: number
  failureCount: number
  deliveries: WebhookDeliveryItem[]
  siteUrl: string
}

export type AuditEventItem = {
  id: string
  action: string
  actorName: string | null
  actorId: string | null
  target: string | null
  ip: string | null
  userAgent: string | null
  metadata: string | null
  createdAt: string
}

export type PublicStats = {
  ok: boolean
  guilds: number
  members: number
  online: number
  errors: number
  checks: number
  webhook: { enabled: boolean; status: string; intervalMinutes: number } | null
  time: string
}
