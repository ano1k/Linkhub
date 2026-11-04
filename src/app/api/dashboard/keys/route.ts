import { db } from '@/lib/db'
import { generateApiKey, getSessionUser } from '@/lib/auth'

// GET /api/dashboard/keys -> liste des cles de l'utilisateur
export async function GET() {
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Non connecte.' }, { status: 401 })

  const keys = await db.apiKey.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })
  return Response.json({ keys })
}

// POST /api/dashboard/keys -> cree une nouvelle cle { name }
export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Non connecte.' }, { status: 401 })

  let body: { name?: string }
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const name = (body.name || '').trim() || 'Ma cle'
  if (name.length > 60) {
    return Response.json({ error: 'Nom trop long (60 caracteres max).' }, { status: 400 })
  }

  const existing = await db.apiKey.count({ where: { userId: user.id } })
  if (existing >= 25) {
    return Response.json(
      { error: 'Limite de 25 cles atteinte : supprime une cle avant d\'en creer une nouvelle.' },
      { status: 400 },
    )
  }

  const key = await db.apiKey.create({
    data: { key: generateApiKey(), name, userId: user.id },
  })
  return Response.json({ key })
}
