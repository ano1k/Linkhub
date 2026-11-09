import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(async (_args?: any): Promise<any[]> => []),
}))

vi.mock('@/lib/db', () => ({
  db: { guild: { findMany: mocks.findMany } },
}))

import robots from '@/app/robots'
import sitemap from '@/app/sitemap'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.findMany.mockResolvedValue([])
  delete process.env.PUBLIC_BASE_URL
})

describe('robots.txt', () => {
  it('autorise le public et bloque le privé', () => {
    const rules = robots().rules as any
    const rule = Array.isArray(rules) ? rules[0] : rules
    expect(rule.userAgent).toBe('*')
    expect(rule.allow).toBe('/')
    expect(rule.disallow).toEqual(expect.arrayContaining(['/dashboard', '/api/']))
  })

  it('pointe vers le plan de site', () => {
    expect(robots().sitemap).toBe('http://localhost:3000/sitemap.xml')
  })

  it('respecte PUBLIC_BASE_URL', () => {
    process.env.PUBLIC_BASE_URL = 'https://link.example.com/'
    expect(robots().sitemap).toBe('https://link.example.com/sitemap.xml')
    expect(robots().host).toBe('https://link.example.com')
  })
})

describe('plan de site', () => {
  it('liste les pages statiques', async () => {
    const entries = await sitemap()
    const urls = entries.map((e) => e.url)
    expect(urls).toEqual(['http://localhost:3000/', 'http://localhost:3000/serveurs'])
  })

  it('ajoute une URL par serveur publié', async () => {
    mocks.findMany.mockResolvedValue([
      { discordId: '111111111111111111', lastCheckAt: new Date('2026-11-01T10:00:00Z') },
      { discordId: '222222222222222222', lastCheckAt: null },
    ])
    const entries = await sitemap()
    const urls = entries.map((e) => e.url)
    expect(urls).toContain('http://localhost:3000/s/111111111111111111')
    expect(urls).toContain('http://localhost:3000/s/222222222222222222')
    expect(entries).toHaveLength(4)
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { invite: { isNot: null } } }),
    )
  })

  it('ne liste que les serveurs avec invitation', async () => {
    await sitemap()
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { invite: { isNot: null } } }))
  })

  it('déduplique et reste valide si la base échoue', async () => {
    mocks.findMany.mockResolvedValueOnce([
      { discordId: '111111111111111111', lastCheckAt: null },
      { discordId: '111111111111111111', lastCheckAt: null },
    ])
    const entries = await sitemap()
    expect(entries.filter((e) => e.url.includes('/s/'))).toHaveLength(1)

    mocks.findMany.mockRejectedValueOnce(new Error('base indisponible'))
    const fallback = await sitemap()
    expect(fallback).toHaveLength(2)
  })
})
