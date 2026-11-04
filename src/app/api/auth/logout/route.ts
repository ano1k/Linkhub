import { clearSessionCookie } from '@/lib/auth'
import { redirectRelative } from '@/lib/config'

// POST /api/auth/logout -> deconnexion (utilise par le tableau de bord)
export async function POST() {
  await clearSessionCookie()
  return redirectRelative('/')
}

// GET /api/auth/logout -> deconnexion directe par lien
export async function GET() {
  await clearSessionCookie()
  return redirectRelative('/')
}
