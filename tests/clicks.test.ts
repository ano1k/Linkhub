import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(async (_args?: any): Promise<any> => ({})),
  findMany: vi.fn(async (_args?: any): Promise<any[]> => []),
}))

vi.mock('@/lib/db', () => ({
  db: {
    clickStat: {
      upsert: mocks.upsert,
      findMany: mocks.findMany,
    },
  },
}))

import { dayKey, daysAgoKey, emptyClickSummary, recordClick, summarizeClicks } from '@/lib/clicks'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.upsert.mockResolvedValue({})
  mocks.findMany.mockResolvedValue([])
})

describe('compteur de clics', () => {
  it('calcule les clés de jour en UTC', () => {
    expect(dayKey(new Date('2026-11-07T23:59:59Z'))).toBe('2026-11-07')
    expect(dayKey(new Date('2026-11-08T00:00:01Z'))).toBe('2026-11-08')
  })

  it('recule de N jours', () => {
    const from = new Date('2026-11-07T12:00:00Z')
    expect(daysAgoKey(0, from)).toBe('2026-11-07')
    expect(daysAgoKey(6, from)).toBe('2026-11-01')
    expect(daysAgoKey(29, from)).toBe('2026-10-09')
  })

  it('ignore un identifiant invalide sans toucher la base', async () => {
    await recordClick('pas-un-id')
    expect(mocks.upsert).not.toHaveBeenCalled()
  })

  it('incrémente le compteur du jour via upsert', async () => {
    await recordClick('123456789012345678')
    expect(mocks.upsert).toHaveBeenCalledWith({
      where: { discordId_day: { discordId: '123456789012345678', day: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) } },
      create: expect.objectContaining({ discordId: '123456789012345678', count: 1 }),
      update: { count: { increment: 1 } },
    })
  })

  it('ne lève jamais si la base échoue', async () => {
    mocks.upsert.mockRejectedValueOnce(new Error('table absente'))
    await expect(recordClick('123456789012345678')).resolves.toBeUndefined()
  })

  it('agrège aujourd’hui, 7 jours et 30 jours', async () => {
    const now = new Date('2026-11-07T10:00:00Z')
    mocks.findMany.mockResolvedValue([
      { discordId: '111111111111111111', day: '2026-11-07', count: 5 }, // aujourd'hui
      { discordId: '111111111111111111', day: '2026-11-03', count: 3 }, // 7 jours
      { discordId: '111111111111111111', day: '2026-10-15', count: 2 }, // 30 jours seulement
      { discordId: '222222222222222222', day: '2026-11-07', count: 1 },
    ])

    const result = await summarizeClicks(['111111111111111111', '222222222222222222', '333333333333333333'], now)

    expect(result.get('111111111111111111')).toEqual({
      today: 5,
      last7Days: 8,
      last30Days: 10,
      // Série du plus ancien (1er nov.) au plus récent (aujourd'hui).
      series: [0, 0, 3, 0, 0, 0, 5],
    })
    expect(result.get('222222222222222222')).toEqual({ today: 1, last7Days: 1, last30Days: 1, series: [0, 0, 0, 0, 0, 0, 1] })
    // Aucun clic : entrée à zéro (le tableau de bord n'a jamais de `undefined`).
    expect(result.get('333333333333333333')).toEqual({
      today: 0,
      last7Days: 0,
      last30Days: 0,
      series: [0, 0, 0, 0, 0, 0, 0],
    })
  })

  it('borne la requête à 30 jours', async () => {
    const now = new Date('2026-11-07T10:00:00Z')
    await summarizeClicks(['111111111111111111'], now)
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { discordId: { in: ['111111111111111111'] }, day: { gte: '2026-10-09' } },
      }),
    )
  })

  it('ne fait aucune requête sans identifiant', async () => {
    const result = await summarizeClicks([])
    expect(result.size).toBe(0)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  it('déduplique les identifiants', async () => {
    const result = await summarizeClicks(['111111111111111111', '111111111111111111'])
    expect(result.size).toBe(1)
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ discordId: { in: ['111111111111111111'] } }) }),
    )
  })

  it('retombe sur des zéros si la base échoue', async () => {
    mocks.findMany.mockRejectedValueOnce(new Error('base indisponible'))
    const result = await summarizeClicks(['111111111111111111'])
    expect(result.get('111111111111111111')).toEqual({
      today: 0,
      last7Days: 0,
      last30Days: 0,
      series: [0, 0, 0, 0, 0, 0, 0],
    })
  })

  it('expose un résumé vide immuable', () => {
    const a = emptyClickSummary()
    a.today = 42
    a.series[0] = 9
    // Chaque appel renvoie un tableau distinct (aucun état partagé entre cartes).
    expect(emptyClickSummary()).toEqual({ today: 0, last7Days: 0, last30Days: 0, series: [0, 0, 0, 0, 0, 0, 0] })
  })
})
