import { describe, expect, it } from 'vitest'
import { DEFAULT_LIMIT, MAX_LIMIT, paginateByCursor, parsePageQuery } from '@/lib/pagination'

const items = Array.from({ length: 12 }, (_, i) => ({ id: String(i + 1) }))
const byId = (item: { id: string }) => item.id

describe('lecture des paramètres de pagination', () => {
  it('applique les valeurs par défaut', () => {
    expect(parsePageQuery('https://x.test/api/v1/guilds')).toEqual({ limit: DEFAULT_LIMIT, cursor: null })
  })

  it('lit limit et cursor', () => {
    expect(parsePageQuery('https://x.test/api/v1/guilds?limit=3&cursor=7')).toEqual({ limit: 3, cursor: '7' })
  })

  it('borne la taille de page', () => {
    expect(parsePageQuery('https://x.test/?limit=100000').limit).toBe(MAX_LIMIT)
  })

  it('ignore une limite invalide', () => {
    expect(parsePageQuery('https://x.test/?limit=abc').limit).toBe(DEFAULT_LIMIT)
    expect(parsePageQuery('https://x.test/?limit=-4').limit).toBe(DEFAULT_LIMIT)
    expect(parsePageQuery('https://x.test/?limit=0').limit).toBe(DEFAULT_LIMIT)
    expect(parsePageQuery('https://x.test/?limit=2.9').limit).toBe(2)
  })

  it('traite un curseur vide comme absent', () => {
    expect(parsePageQuery('https://x.test/?cursor=').cursor).toBe(null)
    expect(parsePageQuery('https://x.test/?cursor=%20').cursor).toBe(null)
  })

  it('accepte une URL relative', () => {
    expect(parsePageQuery('/api/v1/guilds?limit=5')).toEqual({ limit: 5, cursor: null })
  })
})

describe('découpage par curseur', () => {
  it('renvoie la première page et le curseur suivant', () => {
    const page = paginateByCursor(items, { limit: 5, cursor: null }, byId)
    expect(page.items.map(byId)).toEqual(['1', '2', '3', '4', '5'])
    expect(page.hasMore).toBe(true)
    expect(page.nextCursor).toBe('5')
  })

  it('reprend après le curseur', () => {
    const page = paginateByCursor(items, { limit: 5, cursor: '5' }, byId)
    expect(page.items.map(byId)).toEqual(['6', '7', '8', '9', '10'])
    expect(page.nextCursor).toBe('10')
  })

  it('signale la fin de liste', () => {
    const page = paginateByCursor(items, { limit: 5, cursor: '10' }, byId)
    expect(page.items.map(byId)).toEqual(['11', '12'])
    expect(page.hasMore).toBe(false)
    expect(page.nextCursor).toBe(null)
  })

  it('repart du début avec un curseur inconnu', () => {
    const page = paginateByCursor(items, { limit: 2, cursor: 'disparu' }, byId)
    expect(page.items.map(byId)).toEqual(['1', '2'])
  })

  it('gère une liste vide', () => {
    const page = paginateByCursor([], { limit: 10, cursor: null }, byId)
    expect(page).toEqual({ items: [], nextCursor: null, hasMore: false })
  })

  it('parcourt toute la liste sans doublon ni oubli', () => {
    const collected: string[] = []
    let cursor: string | null = null
    for (let guard = 0; guard < 20; guard += 1) {
      const page = paginateByCursor(items, { limit: 5, cursor }, byId)
      collected.push(...page.items.map(byId))
      if (!page.hasMore) break
      cursor = page.nextCursor
    }
    expect(collected).toEqual(items.map(byId))
  })
})
