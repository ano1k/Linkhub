import { beforeEach, describe, expect, it, vi } from 'vitest'

// security.ts importe la base (journal d'audit) : on la remplace par un double.
vi.mock('@/lib/db', () => ({
  db: {
    auditEvent: {
      create: vi.fn(async () => ({})),
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
      deleteMany: vi.fn(async () => ({})),
    },
  },
}))

import {
  checkSameOrigin,
  decryptSecret,
  encryptSecret,
  getClientIp,
  hashApiKey,
  isSnowflake,
  isValidBotToken,
  isValidWebhookUrl,
  maskSecret,
  maskWebhookUrl,
  rateLimit,
  rateLimitHeaders,
  safeEqual,
  sanitizeText,
} from '@/lib/security'

process.env.APP_SECRET = 'cle-de-test-suffisamment-longue-123456'

beforeEach(() => {
  delete process.env.DISCORD_API_BASE
  vi.useRealTimers()
})

describe('clés API', () => {
  it('empreinte une clé en SHA-256 stable et normalisée', () => {
    const a = hashApiKey('  dlh_abc  ')
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(a).toBe(hashApiKey('dlh_abc'))
    expect(hashApiKey('dlh_abd')).not.toBe(a)
  })
})

describe('chiffrement des secrets', () => {
  it('fait un aller-retour fidèle', () => {
    const plain = 'https://discord.com/api/webhooks/123/token-àé'
    expect(decryptSecret(encryptSecret(plain))).toBe(plain)
  })

  it('produit un chiffré différent à chaque appel (IV aléatoire)', () => {
    expect(encryptSecret('même valeur')).not.toBe(encryptSecret('même valeur'))
  })

  it('ne contient jamais la valeur en clair', () => {
    expect(encryptSecret('sup3r-secret')).not.toContain('sup3r-secret')
  })

  it('refuse un chiffré altéré (intégrité GCM)', () => {
    const payload = encryptSecret('secret')
    const parts = payload.split('.')
    const tag = parts[2]
    const tampered = [parts[0], parts[1], tag.replace(/^./, (c) => (c === 'a' ? 'b' : 'a')), parts[3]].join('.')
    expect(decryptSecret(tampered)).toBeNull()
  })

  it('refuse un format inconnu ou vide', () => {
    expect(decryptSecret(null)).toBeNull()
    expect(decryptSecret('')).toBeNull()
    expect(decryptSecret('v2.a.b.c')).toBeNull()
    expect(decryptSecret('pas-un-chiffre')).toBeNull()
  })
})

describe('masquage', () => {
  it('masque le milieu d’un secret', () => {
    const masked = maskSecret('dlh_1234567890abcdef')
    expect(masked.startsWith('dlh_')).toBe(true)
    expect(masked).toContain('•')
    expect(masked).not.toContain('567890abcdef')
  })

  it('masque l’identifiant et le token d’une URL de webhook', () => {
    const masked = maskWebhookUrl('https://discord.com/api/webhooks/123456789/token-secret')
    expect(masked).toBe('https://discord.com/api/webhooks/••••••••/••••••••')
  })

  it('garde l’hôte pour une URL quelconque et masque l’illisible', () => {
    expect(maskWebhookUrl('https://exemple.com/hook')).toBe('https://exemple.com/hook')
    expect(maskWebhookUrl('n’importe quoi')).toBe('••••••••')
  })
})

describe('comparaison à temps constant', () => {
  it('compare correctement', () => {
    expect(safeEqual('abc', 'abc')).toBe(true)
    expect(safeEqual('abc', 'abd')).toBe(false)
    expect(safeEqual('abc', 'abcd')).toBe(false)
  })
})

describe('validation', () => {
  it('reconnaît les snowflakes Discord', () => {
    expect(isSnowflake('123456789012345678')).toBe(true)
    expect(isSnowflake('1234')).toBe(false)
    expect(isSnowflake(123456789012345678)).toBe(false)
  })

  it('nettoie un texte libre', () => {
    const cleaned = sanitizeText('  hello\u0000\u0007world  ')
    expect(cleaned).toBe('hello  world')
    expect(cleaned).not.toMatch(/[\u0000-\u001f\u007f]/)
    expect(sanitizeText('x'.repeat(50), 10)).toHaveLength(10)
    expect(sanitizeText(null)).toBe('')
  })

  it('accepte uniquement les webhooks Discord valides', () => {
    expect(isValidWebhookUrl('https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwx')).toBe(true)
    expect(isValidWebhookUrl('https://evil.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwx')).toBe(false)
    expect(isValidWebhookUrl('http://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwx')).toBe(false)
    expect(isValidWebhookUrl('https://discord.com/api/webhooks/pas-un-id/token')).toBe(false)
    expect(isValidWebhookUrl('pas une url')).toBe(false)
  })

  it('n’autorise le sink local qu’en mode démo', () => {
    const local = 'http://127.0.0.1:3030/mock/webhook'
    expect(isValidWebhookUrl(local)).toBe(false)
    process.env.DISCORD_API_BASE = 'http://127.0.0.1:3030'
    expect(isValidWebhookUrl(local)).toBe(true)
  })

  it('valide un token de bot Discord', () => {
    const token = `${'a'.repeat(24)}.${'b'.repeat(6)}.${'c'.repeat(38)}`
    expect(isValidBotToken(token)).toBe(true)
    expect(isValidBotToken('trop-court')).toBe(false)
    expect(isValidBotToken(`deux.${'b'.repeat(60)}`)).toBe(false)
    expect(isValidBotToken(`${'a'.repeat(30)}.${'b'.repeat(30)}.${'c'.repeat(30)} avec espace`)).toBe(false)
  })
})

describe('rate limiting', () => {
  it('autorise jusqu’à la limite puis bloque', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const key = `test:${Math.random()}`

    for (let i = 0; i < 3; i++) {
      const r = rateLimit(key, 3, 60_000)
      expect(r.allowed).toBe(true)
      expect(r.remaining).toBe(2 - i)
    }
    const blocked = rateLimit(key, 3, 60_000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
    expect(rateLimitHeaders(blocked)['Retry-After']).toBeDefined()

    vi.advanceTimersByTime(60_001)
    expect(rateLimit(key, 3, 60_000).allowed).toBe(true)
  })

  it('isole les compteurs par clé', () => {
    expect(rateLimit('a:1', 1, 60_000).allowed).toBe(true)
    expect(rateLimit('b:1', 1, 60_000).allowed).toBe(true)
    expect(rateLimit('a:1', 1, 60_000).allowed).toBe(false)
  })
})

describe('origine des requêtes (CSRF)', () => {
  const req = (headers: Record<string, string>) =>
    new Request('https://linkhub.test/api/action', { method: 'POST', headers })

  it('accepte la même origine', () => {
    expect(checkSameOrigin(req({ origin: 'https://linkhub.test' }))).toBeNull()
  })

  it('refuse une origine différente', () => {
    expect(checkSameOrigin(req({ origin: 'https://evil.test' }))).toMatch(/refusee/i)
  })

  it('accepte une requête sans Origin/Referer (curl, serveur à serveur)', () => {
    expect(checkSameOrigin(req({}))).toBeNull()
  })

  it('se fie à l’hôte transmis par le proxy', () => {
    expect(checkSameOrigin(req({ origin: 'https://public.test', 'x-forwarded-host': 'public.test' }))).toBeNull()
    expect(checkSameOrigin(req({ origin: 'https://autre.test', 'x-forwarded-host': 'public.test' }))).not.toBeNull()
  })
})

describe('IP du client', () => {
  it('retient la première IP de X-Forwarded-For', () => {
    const req = new Request('https://linkhub.test/', {
      headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1', 'x-real-ip': '10.0.0.9' },
    })
    expect(getClientIp(req)).toBe('203.0.113.7')
  })

  it('retombe sur les en-têtes alternatifs puis sur "inconnu"', () => {
    expect(getClientIp(new Request('https://linkhub.test/', { headers: { 'cf-connecting-ip': '198.51.100.2' } }))).toBe(
      '198.51.100.2',
    )
    expect(getClientIp(new Request('https://linkhub.test/'))).toBe('inconnu')
  })
})
