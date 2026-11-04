import { db } from '@/lib/db'
import { isMockMode } from '@/lib/config'

// GET /api/health -> diagnostic d'une instance (public, ne revele rien de sensible).
// Verifie que la base repond et que le schema est applique.
export async function GET() {
  const started = Date.now()
  try {
    await db.appConfig.findUnique({ where: { id: '__health__' } })
    return Response.json({
      status: 'ok',
      database: 'ok',
      mockMode: isMockMode(),
      latencyMs: Date.now() - started,
      time: new Date().toISOString(),
    })
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'Erreur inconnue'
    const hint = /no such table|does not exist/i.test(detail)
      ? "Le schema n'est pas applique : npm run db:sql | turso db shell <base>, ou colle turso-schema.sql dans la console web Turso."
      : 'Verifie TURSO_DATABASE_URL et TURSO_AUTH_TOKEN.'
    console.error('[health] base indisponible :', detail)
    return Response.json(
      { status: 'error', database: 'error', detail, hint, time: new Date().toISOString() },
      { status: 500 },
    )
  }
}
