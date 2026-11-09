import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ db: { auditEvent: { create: vi.fn(), count: vi.fn(async () => 0) } } }))

import { isSealed, openSecret, sealSecret } from '@/lib/secrets'

process.env.APP_SECRET = 'cle-de-test-suffisamment-longue-123456'

describe('chiffrement des secrets en base', () => {
  it('fait un aller-retour fidèle', () => {
    const token = 'MTIzNDU2Nzg5.GaBcDe.Un-token-discord-très-long-1234567890'
    const sealed = sealSecret(token)
    expect(sealed).not.toBe(token)
    expect(openSecret(sealed)).toBe(token)
  })

  it('produit une valeur différente à chaque chiffrement', () => {
    expect(sealSecret('même valeur')).not.toBe(sealSecret('même valeur'))
  })

  it('accepte les valeurs historiques en clair (migration progressive)', () => {
    expect(openSecret('un-secret-en-clair')).toBe('un-secret-en-clair')
    expect(isSealed('un-secret-en-clair')).toBe(false)
  })

  it('ne re-chiffre pas une valeur déjà chiffrée', () => {
    const sealed = sealSecret('abc')
    expect(sealSecret(sealed)).toBe(sealed)
    expect(isSealed(sealed)).toBe(true)
  })

  it('gère les valeurs absentes', () => {
    expect(sealSecret(null)).toBeNull()
    expect(sealSecret('')).toBeNull()
    expect(openSecret(null)).toBeNull()
    expect(openSecret(undefined)).toBeNull()
    expect(isSealed(null)).toBe(false)
  })

  it('renvoie null pour un chiffré corrompu (au lieu de planter)', () => {
    expect(openSecret('v1.aa.bb.cc')).toBeNull()
    expect(openSecret('v1.pas.du.tout')).toBeNull()
  })
})
