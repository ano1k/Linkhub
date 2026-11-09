import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  runRefreshCycleLocked: vi.fn(async (_owner?: string) => ({ ran: true, metrics: { processed: 3 } })),
  sendWebhookPing: vi.fn(async () => ({ ok: true })),
}))

vi.mock('@/lib/db', () => ({ db: { auditEvent: { create: vi.fn() } } }))
vi.mock('@/lib/refresher', () => ({ runRefreshCycleLocked: mocks.runRefreshCycleLocked }))
vi.mock('@/lib/webhook', () => ({ sendWebhookPing: mocks.sendWebhookPing }))

import { GET, POST } from '@/app/api/cron/refresh/route'

const URL_CRON = 'https://linkhub.test/api/cron/refresh'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.runRefreshCycleLocked.mockResolvedValue({ ran: true, metrics: { processed: 3 } } as any)
  delete process.env.CRON_SECRET
})

const call = (init?: RequestInit, url = URL_CRON) => POST(new Request(url, { method: 'POST', ...init }))

describe('cron de rafraîchissement', () => {
  it('est désactivé tant que CRON_SECRET n’est pas défini', async () => {
    const res = await call()
    expect(res.status).toBe(503)
    expect((await res.json()).error).toBe('cron_not_configured')
    expect(mocks.runRefreshCycleLocked).not.toHaveBeenCalled()
  })

  it('refuse une requête sans jeton', async () => {
    process.env.CRON_SECRET = 'secret-de-test'
    const res = await call()
    expect(res.status).toBe(401)
    expect(mocks.runRefreshCycleLocked).not.toHaveBeenCalled()
  })

  it('refuse un jeton incorrect', async () => {
    process.env.CRON_SECRET = 'secret-de-test'
    const res = await call({ headers: { authorization: 'Bearer mauvais-jeton' } })
    expect(res.status).toBe(401)
    expect(mocks.runRefreshCycleLocked).not.toHaveBeenCalled()
  })

  it('accepte Authorization: Bearer (format Vercel Cron)', async () => {
    process.env.CRON_SECRET = 'secret-de-test'
    const res = await call({ headers: { authorization: 'Bearer secret-de-test' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ ok: true, ran: true })
    expect(mocks.runRefreshCycleLocked).toHaveBeenCalledWith('cron')
    expect(mocks.sendWebhookPing).toHaveBeenCalledTimes(1)
    expect(mocks.sendWebhookPing).toHaveBeenCalledWith({ trigger: 'cron' })
  })

  it('accepte X-Cron-Secret et ?secret=', async () => {
    process.env.CRON_SECRET = 'secret-de-test'
    const byHeader = await GET(new Request(URL_CRON, { headers: { 'x-cron-secret': 'secret-de-test' } }))
    expect(byHeader.status).toBe(200)
    expect((await byHeader.json()).ok).toBe(true)
  })

  it('envoie quand même le heartbeat si une autre instance tient le verrou', async () => {
    // En serverless il n'y a pas de boucle interne : si le heartbeat était
    // conditionné au cycle, un ping Discord sur deux serait perdu.
    process.env.CRON_SECRET = 'secret-de-test'
    mocks.runRefreshCycleLocked.mockResolvedValue({ ran: false, metrics: { processed: 0 } } as any)
    const res = await call({ headers: { authorization: 'Bearer secret-de-test' } })
    expect((await res.json()).ran).toBe(false)
    expect(mocks.sendWebhookPing).toHaveBeenCalledWith({ trigger: 'cron' })
  })

  it('reste OK si l’envoi du heartbeat échoue', async () => {
    process.env.CRON_SECRET = 'secret-de-test'
    mocks.sendWebhookPing.mockRejectedValueOnce(new Error('Discord HS'))
    const res = await call({ headers: { authorization: 'Bearer secret-de-test' } })
    expect(res.status).toBe(200)
    expect((await res.json()).heartbeat).toBeNull()
  })
})
