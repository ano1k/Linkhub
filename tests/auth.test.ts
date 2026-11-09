import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(async (_args?: any): Promise<any> => null),
  update: vi.fn(async (_args?: any): Promise<any> => ({ sessionVersion: 1 })),
  cookies: [] as Array<{ name: string; value: string }>,
}))

vi.mock('@/lib/db', () => ({
  db: { user: { findUnique: mocks.findUnique, update: mocks.update } },
}))
vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: (_name?: string) => mocks.cookies }),
}))

import {
  createSessionValue,
  getSessionUser,
  parseSessionValue,
  revokeAllSessions,
} from '@/lib/auth'

process.env.APP_SECRET = 'cle-de-test-suffisamment-longue-123456'

const COOKIE = 'dlh_session_v2'
const DAY = 24 * 60 * 60 * 1000

beforeEach(() => {
  vi.clearAllMocks()
  mocks.cookies = []
  mocks.findUnique.mockResolvedValue(null)
  vi.useRealTimers()
})

const withCookie = (value: string) => {
  mocks.cookies = [{ name: COOKIE, value }]
}

describe('sessions signées (v3)', () => {
  it('relit une session qu’elle a créée', () => {
    expect(parseSessionValue(createSessionValue('123456789012345678'))).toEqual({
      userId: '123456789012345678',
      version: 0,
    })
  })

  it('embarque la version de session', () => {
    expect(parseSessionValue(createSessionValue('42', 7))).toEqual({ userId: '42', version: 7 })
  })

  it('produit une valeur différente à chaque connexion (nonce)', () => {
    expect(createSessionValue('123')).not.toBe(createSessionValue('123'))
  })

  it('refuse une signature falsifiée', () => {
    const [userId, expires, version, nonce, sig] = createSessionValue('42').split('.')
    const forged = [userId, expires, version, nonce, sig.replace(/^./, (c) => (c === 'a' ? 'b' : 'a'))].join('.')
    expect(parseSessionValue(forged)).toBeNull()
    expect(parseSessionValue(`${Number(expires) + DAY}.${version}.${nonce}.${sig}`)).toBeNull()
  })

  it('refuse une version modifiée sans resignature', () => {
    const [userId, expires, version, nonce, sig] = createSessionValue('42', 1).split('.')
    expect(parseSessionValue([userId, expires, '2', nonce, sig].join('.'))).toBeNull()
  })

  it('refuse un identifiant modifié sans resignature', () => {
    const [, expires, version, nonce, sig] = createSessionValue('42').split('.')
    expect(parseSessionValue(['99', expires, version, nonce, sig].join('.'))).toBeNull()
  })

  it('refuse une session expirée', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const value = createSessionValue('42')
    vi.setSystemTime(new Date('2026-01-30T00:00:00Z'))
    expect(parseSessionValue(value)?.userId).toBe('42')
    vi.setSystemTime(new Date('2026-02-15T00:00:00Z'))
    expect(parseSessionValue(value)).toBeNull()
    vi.useRealTimers()
  })

  it('accepte les anciens formats, lus comme version 0', () => {
    const legacyV1 = `${'777'}.${createHmac('sha256', process.env.APP_SECRET as string).update('777').digest('hex')}`
    expect(parseSessionValue(legacyV1)).toEqual({ userId: '777', version: 0 })

    const expires = Date.now() + DAY
    const nonce = 'abcdef'
    const sig = createHmac('sha256', process.env.APP_SECRET as string)
      .update(`777.${expires}.${nonce}`)
      .digest('hex')
    expect(parseSessionValue(`777.${expires}.${nonce}.${sig}`)).toEqual({ userId: '777', version: 0 })
    expect(parseSessionValue(`777.${expires}.${nonce}.${sig.replace(/^./, 'z')}`)).toBeNull()
  })

  it('refuse les valeurs vides ou mal formées', () => {
    expect(parseSessionValue('')).toBeNull()
    expect(parseSessionValue(null)).toBeNull()
    expect(parseSessionValue('a.b.c')).toBeNull()
    expect(parseSessionValue('a.b.c.d.e.f')).toBeNull()
    expect(parseSessionValue('42.pas-un-nombre.0.nonce.signature')).toBeNull()
    expect(parseSessionValue('42.123.abc.nonce.signature')).toBeNull()
  })
})

describe('révocation', () => {
  it('accepte la session si la version correspond', async () => {
    withCookie(createSessionValue('42', 2))
    mocks.findUnique.mockResolvedValue({ id: '42', sessionVersion: 2, username: 'test' })
    expect(await getSessionUser()).toMatchObject({ id: '42' })
  })

  it('refuse une session dont la version a été incrémentée', async () => {
    withCookie(createSessionValue('42', 2))
    mocks.findUnique.mockResolvedValue({ id: '42', sessionVersion: 3, username: 'test' })
    expect(await getSessionUser()).toBeNull()
  })

  it('refuse une session si l’utilisateur a disparu', async () => {
    withCookie(createSessionValue('42', 0))
    mocks.findUnique.mockResolvedValue(null)
    expect(await getSessionUser()).toBeNull()
  })

  it('ignore les cookies invalides', async () => {
    mocks.cookies = [
      { name: COOKIE, value: 'n’importe quoi' },
      { name: COOKIE, value: createSessionValue('42', 0) },
    ]
    mocks.findUnique.mockResolvedValue({ id: '42', sessionVersion: 0 })
    expect(await getSessionUser()).toMatchObject({ id: '42' })
  })

  it('incrémente la version pour déconnecter partout', async () => {
    mocks.update.mockResolvedValue({ sessionVersion: 5 })
    expect(await revokeAllSessions('42')).toBe(5)
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: '42' },
        data: { sessionVersion: { increment: 1 } },
      }),
    )
  })
})
