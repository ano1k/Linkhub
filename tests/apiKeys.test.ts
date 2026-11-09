import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: { apiKey: { findUnique: vi.fn(async () => null), findFirst: vi.fn(async () => null), update: vi.fn() } },
}))

import { buildDirectGoUrl, extractApiKey, extractPublicId, publicKeyLabel } from '@/lib/apiKeys'

const req = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers })

describe('extraction de la clé d’API', () => {
  it('privilégie le header X-API-Key', () => {
    expect(extractApiKey(req('https://h.test/api/v1/guilds?key=dlh_query', { 'x-api-key': ' dlh_header ' }))).toBe(
      'dlh_header',
    )
  })

  it('accepte encore ?key= pour les intégrations historiques', () => {
    expect(extractApiKey(req('https://h.test/api/v1/guilds?key=dlh_query'))).toBe('dlh_query')
  })

  it('renvoie null sans clé', () => {
    expect(extractApiKey(req('https://h.test/api/v1/guilds'))).toBeNull()
  })
})

describe('jeton public des boutons', () => {
  it('lit ?ref= ou ?public_id=', () => {
    expect(extractPublicId(req('https://h.test/api/v1/go/1?ref=abc'))).toBe('abc')
    expect(extractPublicId(req('https://h.test/api/v1/go/1?public_id=def'))).toBe('def')
    expect(extractPublicId(req('https://h.test/api/v1/go/1'))).toBeNull()
  })
})

describe('URL de redirection publique', () => {
  it('utilise le jeton public et jamais la clé secrète', () => {
    const url = buildDirectGoUrl('https://site.test', '123456789012345678', {
      publicId: 'pub123',
      key: 'dlh_secret_a_ne_pas_fuir',
    })
    expect(url).toBe('https://site.test/api/v1/go/123456789012345678?ref=pub123')
    expect(url).not.toContain('dlh_secret')
  })

  it('retombe sur la clé pour les clés anciennes sans jeton public', () => {
    expect(buildDirectGoUrl('https://site.test', '1', { publicId: null, key: 'dlh_legacy' })).toContain('?key=dlh_legacy')
  })
})

describe('libellé public d’une clé', () => {
  it('n’expose jamais la clé complète', () => {
    expect(publicKeyLabel({ keyPrefix: 'dlh_abcd' } as any)).toBe('dlh_abcd')
    const legacy = publicKeyLabel({ key: 'dlh_1234567890abcdef', keyPrefix: null } as any)
    expect(legacy).toBe('dlh_1234••••cdef')
    expect(legacy).not.toBe('dlh_1234567890abcdef')
  })
})
