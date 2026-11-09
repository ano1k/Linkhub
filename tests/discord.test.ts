import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.DISCORD_API_BASE = 'https://discord.test/api/v10'

import {
  DiscordApiError,
  isTransientDiscordError,
  isUnknownInviteError,
  fetchInviteMeta,
} from '@/lib/discord'

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('classification des erreurs Discord', () => {
  it('distingue une invitation inconnue (404) d’une panne', () => {
    expect(isUnknownInviteError(new DiscordApiError(404, 'Unknown Invite'))).toBe(true)
    expect(isUnknownInviteError(new DiscordApiError(500, 'boom'))).toBe(false)
    expect(isUnknownInviteError(new Error('autre'))).toBe(false)
  })

  it('identifie les erreurs temporaires', () => {
    expect(isTransientDiscordError(new DiscordApiError(0, 'réseau'))).toBe(true)
    expect(isTransientDiscordError(new DiscordApiError(429, 'rate limit'))).toBe(true)
    expect(isTransientDiscordError(new DiscordApiError(503, 'maintenance'))).toBe(true)
    expect(isTransientDiscordError(new DiscordApiError(404, 'Unknown Invite'))).toBe(false)
    expect(isTransientDiscordError(new DiscordApiError(401, 'unauthorized'))).toBe(false)
    // Une erreur non-Discord (DNS, timeout, bug) est traitée comme temporaire.
    expect(isTransientDiscordError(new Error('timeout'))).toBe(true)
  })
})

describe('fetchInviteMeta', () => {
  it('récupère les compteurs et les utilisations', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { code: 'abc', uses: 4, approximate_member_count: 120, approximate_presence_count: 9 }),
    )
    const meta = await fetchInviteMeta('abc')
    expect(meta.uses).toBe(4)
    expect(meta.approximate_member_count).toBe(120)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/invites/abc?with_counts=true')
  })

  it('réessaie une fois après une erreur 5xx', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(500, { message: 'boom' }))
      .mockResolvedValueOnce(jsonResponse(200, { code: 'abc', uses: 1 }))
    const meta = await fetchInviteMeta('abc')
    expect(meta.uses).toBe(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('réessaie après un 429 en respectant retry_after', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(429, { message: 'rate limited', retry_after: 0.25 }))
      .mockResolvedValueOnce(jsonResponse(200, { code: 'abc', uses: 2 }))
    const started = Date.now()
    const meta = await fetchInviteMeta('abc')
    expect(meta.uses).toBe(2)
    expect(Date.now() - started).toBeGreaterThanOrEqual(200)
  })

  it('ne réessaie pas un 404 et propage le statut', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { message: 'Unknown Invite', code: 10006 }))
    await expect(fetchInviteMeta('disparue')).rejects.toMatchObject({ status: 404 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('convertit une panne réseau en DiscordApiError (statut 0) après une tentative', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))
    const error = await fetchInviteMeta('abc').catch((e) => e)
    expect(error).toBeInstanceOf(DiscordApiError)
    expect(error.status).toBe(0)
    expect(isTransientDiscordError(error)).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
