import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    siteSettings: { findUnique: vi.fn(async () => null), create: vi.fn(), update: vi.fn() },
    webhookDelivery: { create: vi.fn(), count: vi.fn(async () => 0), findMany: vi.fn(async () => []), deleteMany: vi.fn() },
    guild: { count: vi.fn(async () => 0), findMany: vi.fn(async () => []) },
  },
}))

import { DEFAULT_WEBHOOK_INTERVAL, isWebhookDue, postToDiscord } from '@/lib/webhook'

const URL_WEBHOOK = 'https://discord.com/api/webhooks/123456789012345678/token-de-test-abcdefghij'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('postToDiscord', () => {
  it('envoie le message avec ?wait=true', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { id: '1' }))
    const result = await postToDiscord(URL_WEBHOOK, { content: 'coucou' })

    expect(result.ok).toBe(true)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe(`${URL_WEBHOOK}?wait=true`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ content: 'coucou' })
  })

  it('respecte le retry_after de Discord sur un 429', async () => {
    fetchMock
      .mockResolvedValueOnce(json(429, { message: 'You are being rate limited.', retry_after: 2 }))
      .mockResolvedValueOnce(json(200, { id: '2' }))

    const promise = postToDiscord(URL_WEBHOOK, { content: 'test' })

    // L'ancien code relisait res.json() (deja consommé) : il attendait toujours 1 s.
    await vi.advanceTimersByTimeAsync(1_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1_100)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const result = await promise
    expect(result.ok).toBe(true)
    expect(result.latencyMs).toBeGreaterThanOrEqual(2_000)
  })

  it('borne l’attente entre 1 s et 5 s', async () => {
    fetchMock
      .mockResolvedValueOnce(json(429, { retry_after: 0.1 }))
      .mockResolvedValueOnce(json(200, { id: '3' }))
    const promise = postToDiscord(URL_WEBHOOK, { content: 'test' })

    await vi.advanceTimersByTimeAsync(900)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await promise
    expect((await promise).ok).toBe(true)
  })

  it('echoue proprement si Discord rejette le message', async () => {
    fetchMock.mockResolvedValueOnce(json(400, { message: 'Invalid Webhook Token', code: 50027 }))
    const result = await postToDiscord(URL_WEBHOOK, { content: 'test' })

    expect(result.ok).toBe(false)
    expect(result.httpStatus).toBe(400)
    expect(result.error).toContain('Invalid Webhook Token')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('signale une panne reseau sans lever', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))
    const result = await postToDiscord(URL_WEBHOOK, { content: 'test' })

    expect(result.ok).toBe(false)
    expect(result.httpStatus).toBe(0)
    expect(result.error).toMatch(/fetch failed/)
  })
})

describe('cadence du heartbeat', () => {
  const now = Date.parse('2026-11-07T12:00:00Z')
  const ago = (seconds: number) => new Date(now - seconds * 1000)

  it('envoie tout de suite si rien n’a jamais été envoyé', () => {
    expect(isWebhookDue(null, 5, now)).toBe(true)
  })

  it('respecte l’intervalle quand il est largement écoulé', () => {
    expect(isWebhookDue(ago(10 * 60), 5, now)).toBe(true)
  })

  it('ne renvoie pas avant l’échéance', () => {
    expect(isWebhookDue(ago(60), 5, now)).toBe(false)
    expect(isWebhookDue(ago(3 * 60), 5, now)).toBe(false)
  })

  it('tolère quelques secondes d’avance (cron 5 min légèrement décalé)', () => {
    // 4 min 58 s écoulées : sans marge, un cron toutes les 5 min sautait un tour
    // sur deux et le ping Discord n'arrivait que toutes les ~10 minutes.
    expect(isWebhookDue(ago(4 * 60 + 58), 5, now)).toBe(true)
    // 3 min 50 s : toujours trop tôt (marge = 60 s pour 5 min).
    expect(isWebhookDue(ago(3 * 60 + 50), 5, now)).toBe(false)
  })

  it('borne la marge au quart de l’intervalle', () => {
    // intervalle 1 min -> marge 15 s : à 50 s on renvoie, à 30 s non.
    expect(isWebhookDue(ago(50), 1, now)).toBe(true)
    expect(isWebhookDue(ago(30), 1, now)).toBe(false)
    // intervalle 60 min -> marge plafonnée à 60 s.
    expect(isWebhookDue(ago(59 * 60 + 10), 60, now)).toBe(true)
    expect(isWebhookDue(ago(59 * 60 - 10), 60, now)).toBe(false)
  })

  it('retombe sur l’intervalle par défaut si la valeur est absurde', () => {
    expect(DEFAULT_WEBHOOK_INTERVAL).toBe(5)
    expect(isWebhookDue(ago(10 * 60), Number.NaN, now)).toBe(true)
    expect(isWebhookDue(ago(60), Number.NaN, now)).toBe(false)
    expect(isWebhookDue(ago(10 * 60), 0, now)).toBe(true)
  })
})
