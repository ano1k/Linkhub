import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(async (_args?: any): Promise<any> => null),
  create: vi.fn(async (_args?: any): Promise<any> => ({})),
  updateMany: vi.fn(async (_args?: any): Promise<any> => ({ count: 1 })),
}))

vi.mock('@/lib/db', () => ({
  db: {
    jobLock: {
      findUnique: mocks.findUnique,
      create: mocks.create,
      updateMany: mocks.updateMany,
    },
  },
}))

import { acquireJobLock, releaseJobLock } from '@/lib/job-lock'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.findUnique.mockResolvedValue(null)
  mocks.create.mockResolvedValue({})
  mocks.updateMany.mockResolvedValue({ count: 1 })
})

describe('verrou de tâche', () => {
  it('crée la ligne puis prend le verrou', async () => {
    expect(await acquireJobLock('refresh', 60_000, 'test')).toBe(true)
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'refresh', lockedUntil: { lt: expect.any(Date) } },
        data: expect.objectContaining({ owner: 'test' }),
      }),
    )
  })

  it('ne prend pas un verrou déjà détenu', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'refresh', lockedUntil: new Date(Date.now() + 60_000) })
    mocks.updateMany.mockResolvedValue({ count: 0 })
    expect(await acquireJobLock('refresh')).toBe(false)
  })

  it('reprend le verrou expiré', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'refresh', lockedUntil: new Date(Date.now() - 1_000) })
    expect(await acquireJobLock('refresh')).toBe(true)
  })

  it('laisse passer si la base est indisponible (dégradation sûre)', async () => {
    mocks.findUnique.mockRejectedValue(new Error('base absente'))
    mocks.create.mockRejectedValue(new Error('base absente'))
    mocks.updateMany.mockRejectedValue(new Error('base absente'))
    expect(await acquireJobLock('refresh')).toBe(true)
  })

  it('libère le verrou en le datant dans le passé', async () => {
    await releaseJobLock('refresh')
    const arg = mocks.updateMany.mock.calls[0][0] as any
    expect(arg.where).toEqual({ id: 'refresh' })
    expect((arg.data.lockedUntil as Date).getTime()).toBe(0)
  })
})
