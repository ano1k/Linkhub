import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ db: { auditEvent: { create: vi.fn() } } }))

import { evaluateConfigWriteAccess } from '@/lib/setup'

process.env.APP_SECRET = 'cle-de-test-suffisamment-longue-123456'

const base = {
  alreadyConfigured: false,
  isStaff: false,
  providedToken: '',
  expectedToken: '',
  staffConfigured: false,
}

describe('accès à la configuration Discord', () => {
  it('configuration existante : staff uniquement', () => {
    expect(evaluateConfigWriteAccess({ ...base, alreadyConfigured: true, isStaff: true })).toEqual({
      ok: true,
      via: 'staff',
    })
    const refused = evaluateConfigWriteAccess({ ...base, alreadyConfigured: true, isStaff: false })
    expect(refused.ok).toBe(false)
    if (!refused.ok) expect(refused.status).toBe(403)
  })

  it('bootstrap avec SETUP_TOKEN : le jeton doit correspondre', () => {
    const env = { ...base, expectedToken: 'jeton-secret' }

    const missing = evaluateConfigWriteAccess(env)
    expect(missing.ok).toBe(false)
    if (!missing.ok) expect(missing.error).toMatch(/SETUP_TOKEN/)

    const wrong = evaluateConfigWriteAccess({ ...env, providedToken: 'mauvais' })
    expect(wrong.ok).toBe(false)

    expect(evaluateConfigWriteAccess({ ...env, providedToken: 'jeton-secret' })).toEqual({
      ok: true,
      via: 'token',
    })
  })

  it('bootstrap sans jeton mais avec STAFF_DISCORD_IDS : session staff exigée', () => {
    const env = { ...base, staffConfigured: true }
    expect(evaluateConfigWriteAccess(env).ok).toBe(false)
    expect(evaluateConfigWriteAccess({ ...env, isStaff: true })).toEqual({ ok: true, via: 'staff' })
  })

  it('développement local (ni staff ni jeton) : bootstrap ouvert', () => {
    expect(evaluateConfigWriteAccess(base)).toEqual({ ok: true, via: 'open' })
  })
})
