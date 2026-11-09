import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Tests du vérificateur : le comportement critique est qu'un incident Discord
 * (réseau, 429, 5xx) ne doit JAMAIS produire une nouvelle invitation, alors
 * qu'une invitation réellement inconnue (404) ou expirée doit être réparée.
 */

process.env.DISCORD_API_BASE = 'https://discord.test/api/v10'

const mocks = vi.hoisted(() => ({
  guildUpdate: vi.fn(async (_args: any) => ({})),
  inviteUpsert: vi.fn(async (_args: any) => ({})),
  createInviteSmart: vi.fn(async () => ({ code: 'newcode', uses: 0, max_age: 0, max_uses: 0 })),
  getDiscordConfig: vi.fn(async () => ({ clientId: 'client', clientSecret: 'secret', botToken: 'bot-token' })),
  startWebhookHeartbeat: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    guild: { update: mocks.guildUpdate, findMany: vi.fn(async () => []) },
    invite: { upsert: mocks.inviteUpsert },
  },
}))
vi.mock('@/lib/config', () => ({ getDiscordConfig: mocks.getDiscordConfig }))
vi.mock('@/lib/invite-service', () => ({ createInviteSmart: mocks.createInviteSmart }))
vi.mock('@/lib/webhook', () => ({ startWebhookHeartbeat: mocks.startWebhookHeartbeat }))

import { pickTextChannels, refreshGuild } from '@/lib/refresher'

type MetaMode = 'ok' | 'expired' | '404' | '500' | '429'

let mode: MetaMode = 'ok'
let metaCalls: string[] = []
let fetchMock: ReturnType<typeof vi.fn>

const invitedGuild = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'g1',
    discordId: '900000000000000001',
    name: 'Serveur test',
    icon: null,
    channelId: 'chan-1',
    channelName: 'general',
    ownerId: 'u1',
    memberCount: 10,
    onlineCount: 2,
    lastCheckAt: null,
    lastCheckStatus: null,
    lastCheckMsg: null,
    lastCheckLatencyMs: null,
    failureCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    owner: { id: 'u1' },
    invite: { code: 'oldcode', uses: 3 },
    ...overrides,
  }) as any

const sent = () => mocks.guildUpdate.mock.calls.map((c) => (c[0] as any).data)

beforeEach(() => {
  mode = 'ok'
  metaCalls = []
  vi.clearAllMocks()
  fetchMock = vi.fn(async (input: any) => {
    const url = String(input)
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

    if (url.includes('/channels')) {
      return json(200, [{ id: 'chan-1', name: 'general', type: 0, position: 0 }])
    }
    const code = url.split('/invites/')[1]?.split('?')[0] ?? ''
    metaCalls.push(code)
    if (mode === '404') return json(404, { message: 'Unknown Invite', code: 10006 })
    if (mode === '500') return json(500, { message: 'boom' })
    if (mode === '429') return json(429, { message: 'rate limited', retry_after: 0.25 })
    return json(200, {
      code,
      uses: 5,
      approximate_member_count: 42,
      approximate_presence_count: 7,
      expires_at: mode === 'expired' ? new Date(Date.now() - 60_000).toISOString() : null,
    })
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('invitation valide', () => {
  it('ne consomme qu’un seul appel Discord et met à jour les compteurs', async () => {
    const result = await refreshGuild(invitedGuild())
    expect(result.status).toBe('ok')
    expect(metaCalls).toEqual(['oldcode'])
    expect(mocks.createInviteSmart).not.toHaveBeenCalled()
    expect(sent()[0]).toMatchObject({
      lastCheckStatus: 'ok',
      memberCount: 42,
      onlineCount: 7,
      failureCount: 0,
    })
  })
})

describe('invitation réellement disparue (404)', () => {
  it('en crée une nouvelle et met à jour la base', async () => {
    mode = '404'
    const result = await refreshGuild(invitedGuild())
    expect(result.status).toBe('refreshed')
    expect(mocks.createInviteSmart).toHaveBeenCalledTimes(1)
    expect(metaCalls).toEqual(['oldcode', 'newcode'])
    expect(mocks.inviteUpsert.mock.calls[0][0]).toMatchObject({
      update: { code: 'newcode' },
    })
    expect(sent()[0]).toMatchObject({ lastCheckStatus: 'refreshed', failureCount: 0 })
  })
})

describe('incident Discord (ne doit jamais régénérer)', () => {
  it('conserve l’invitation sur une erreur 5xx', async () => {
    mode = '500'
    const result = await refreshGuild(invitedGuild())
    expect(result.status).toBe('error')
    expect(mocks.createInviteSmart).not.toHaveBeenCalled()
    expect(mocks.inviteUpsert).not.toHaveBeenCalled()
    expect(metaCalls).toHaveLength(2) // 1 essai + 1 retentative réseau
    expect(sent()[0]).toMatchObject({
      lastCheckStatus: 'error',
      failureCount: { increment: 1 },
    })
    expect(result.message).toMatch(/erreur temporaire/)
    expect(result.message).toMatch(/conservee/)
  })

  it('conserve l’invitation sur un rate limit (429)', async () => {
    mode = '429'
    const result = await refreshGuild(invitedGuild())
    expect(result.status).toBe('error')
    expect(mocks.createInviteSmart).not.toHaveBeenCalled()
    expect(mocks.inviteUpsert).not.toHaveBeenCalled()
  })

  it('conserve l’invitation si Discord est injoignable', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))
    const result = await refreshGuild(invitedGuild())
    expect(result.status).toBe('error')
    expect(mocks.createInviteSmart).not.toHaveBeenCalled()
    expect(result.message).toMatch(/Discord injoignable/)
  })
})

describe('invitation expirée', () => {
  it('en génère une nouvelle', async () => {
    mode = 'expired'
    const result = await refreshGuild(invitedGuild())
    expect(result.status).toBe('refreshed')
    expect(mocks.createInviteSmart).toHaveBeenCalledTimes(1)
    expect(mocks.inviteUpsert).toHaveBeenCalledTimes(1)
  })
})

describe('réparation', () => {
  it('crée l’invitation quand aucune n’existe encore', async () => {
    const result = await refreshGuild(invitedGuild({ invite: null }))
    expect(mocks.createInviteSmart).toHaveBeenCalledWith('900000000000000001', 'chan-1')
    expect(metaCalls).toEqual(['newcode'])
    expect(mocks.inviteUpsert).toHaveBeenCalledTimes(1)
    expect(result.status).toBe('ok')
  })

  it('retrouve un salon texte via le bot quand aucun n’est configuré', async () => {
    mode = '404'
    await refreshGuild(invitedGuild({ channelId: null, channelName: null }))
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/guilds/900000000000000001/channels'))).toBe(true)
    expect(mocks.createInviteSmart).toHaveBeenCalledWith('900000000000000001', 'chan-1')
    expect(sent()[0]).toMatchObject({ channelId: 'chan-1', channelName: 'general' })
  })

  it('renvoie une erreur explicite quand aucun salon n’est disponible', async () => {
    fetchMock.mockImplementation(async (input: any) => {
      if (String(input).includes('/channels')) return new Response('[]', { status: 200 })
      return new Response(JSON.stringify({ message: 'Unknown Invite' }), { status: 404 })
    })
    const result = await refreshGuild(invitedGuild({ invite: null, channelId: null }))
    expect(result.status).toBe('error')
    expect(result.message).toMatch(/Aucun salon/)
    expect(mocks.createInviteSmart).not.toHaveBeenCalled()
  })
})

describe('pickTextChannels', () => {
  it('ne garde que les salons texte/annonces, triés par position', () => {
    const channels = [
      { id: '3', name: 'vocal', type: 2, position: 1 },
      { id: '2', name: 'annonces', type: 5, position: 3 },
      { id: '1', name: 'general', type: 0, position: 2 },
    ] as any
    expect(pickTextChannels(channels)).toEqual([
      { id: '1', name: 'general' },
      { id: '2', name: 'annonces' },
    ])
  })
})
