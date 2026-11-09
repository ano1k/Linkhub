import { describe, expect, it } from 'vitest'
import { buildOpenApiDocument } from '@/lib/openapi'

const doc = buildOpenApiDocument('https://link.example.com/') as any

describe('specification OpenAPI', () => {
  it('est une spec OpenAPI 3.1', () => {
    expect(doc.openapi).toBe('3.1.0')
    expect(doc.info.title).toBe('LinkHub API')
    expect(doc.info.version).toBe('1.0.0')
  })

  it('utilise l’URL de base fournie, sans slash final', () => {
    expect(doc.servers).toEqual([{ url: 'https://link.example.com', description: 'Instance LinkHub' }])
  })

  it('documente les endpoints publics', () => {
    expect(Object.keys(doc.paths)).toEqual([
      '/api/v1/guilds',
      '/api/v1/go/{discordId}',
      '/api/badge/{discordId}.svg',
    ])
  })

  it('documente la pagination de /api/v1/guilds', () => {
    const params = doc.paths['/api/v1/guilds'].get.parameters as any[]
    const names = params.map((p) => p.name)
    expect(names).toEqual(expect.arrayContaining(['limit', 'cursor']))
    const limit = params.find((p) => p.name === 'limit')
    expect(limit.schema).toEqual({ type: 'integer', minimum: 1, maximum: 200, default: 50 })
  })

  it('décrit la réponse paginée', () => {
    const schema = doc.paths['/api/v1/guilds'].get.responses['200'].content['application/json'].schema
    expect(Object.keys(schema.properties)).toEqual(expect.arrayContaining(['ok', 'count', 'total', 'guilds', 'meta']))
    const meta = doc.components.schemas.Meta.properties
    expect(Object.keys(meta)).toEqual(expect.arrayContaining(['limit', 'has_more', 'next_cursor']))
  })

  it('déclare la clé d’API et les schémas réutilisables', () => {
    expect(doc.components.securitySchemes.ApiKey).toEqual(
      expect.objectContaining({ type: 'apiKey', in: 'header', name: 'X-API-Key' }),
    )
    expect(Object.keys(doc.components.schemas)).toEqual(expect.arrayContaining(['Guild', 'Meta', 'Error']))
  })

  it('documente les erreurs des endpoints authentifiés', () => {
    const responses = doc.paths['/api/v1/guilds'].get.responses
    expect(responses).toHaveProperty('401')
    expect(responses).toHaveProperty('429')
    expect(responses['401'].content['application/json'].schema).toEqual({ $ref: '#/components/schemas/Error' })
  })

  it('reste sérialisable en JSON', () => {
    expect(() => JSON.stringify(doc)).not.toThrow()
    expect(JSON.parse(JSON.stringify(doc)).openapi).toBe('3.1.0')
  })
})
