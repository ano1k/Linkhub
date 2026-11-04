import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

// DELETE /api/dashboard/keys/[id] -> supprime une cle
export async function DELETE(_req: Request, { params }: Params) {
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Non connecte.' }, { status: 401 })

  const { id } = await params
  const key = await db.apiKey.findUnique({ where: { id } })
  if (!key || key.userId !== user.id) {
    return Response.json({ error: 'Cle non trouvee.' }, { status: 404 })
  }
  await db.apiKey.delete({ where: { id } })
  return Response.json({ ok: true })
}
