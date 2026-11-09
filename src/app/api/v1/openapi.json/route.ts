import { buildOpenApiDocument } from '@/lib/openapi'
import { buildBaseUrl } from '@/lib/config'
import { CORS_HEADERS } from '@/lib/apiKeys'

/**
 * GET /api/v1/openapi.json
 *
 * Specification OpenAPI 3.1 de l'API publique. Publique (aucune cle requise) :
 * elle ne contient que la description du contrat, jamais de donnees.
 */
export async function GET(req: Request) {
  const doc = buildOpenApiDocument(buildBaseUrl(req))
  return new Response(JSON.stringify(doc, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      ...CORS_HEADERS,
    },
  })
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
