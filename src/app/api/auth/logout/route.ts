import { clearSessionCookie } from '@/lib/auth'
import { redirectRaw } from '@/lib/config'

// POST /api/auth/logout -> deconnexion (utilise par le tableau de bord)
export async function POST(req: Request) {
  const res = redirectRaw('/')
  clearSessionCookie(res, req)
  return res
}

// GET /api/auth/logout -> deconnexion directe par lien
export async function GET(req: Request) {
  const res = redirectRaw('/')
  clearSessionCookie(res, req)
  return res
}
