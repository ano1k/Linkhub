import { getSessionUser } from '@/lib/auth'
import { ensureAccessToken } from '@/lib/refresher'
import { fetchGuildChannels } from '@/lib/discord'

type Params = { params: Promise<{ discordId: string }> }

// GET /api/dashboard/guilds/[discordId]/channels -> salons texte du serveur
export async function GET(_req: Request, { params }: Params) {
  try {
    return await listChannels({ params })
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'Erreur inconnue'
    console.error('[guilds:channels]', detail)
    return Response.json({ error: `Liste des salons impossible : ${detail}` }, { status: 500 })
  }
}

async function listChannels({ params }: Params) {
  const user = await getSessionUser()
  if (!user) return Response.json({ error: 'Non connecte.' }, { status: 401 })

  const { discordId } = await params
  const token = await ensureAccessToken(user).catch(() => null)
  if (!token) {
    return Response.json({ error: 'Session Discord expiree.', needsReauth: true }, { status: 401 })
  }

  let channels
  try {
    channels = await fetchGuildChannels(token, discordId)
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'erreur Discord'
    return Response.json(
      { error: `Impossible de lister les salons (${detail}). Verifie que tu es toujours membre de ce serveur.` },
      { status: 400 },
    )
  }

  const salons = channels
    .filter((c) => c.type === 0 || c.type === 5) // texte + annonces
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((c) => ({ id: c.id, name: c.name }))

  return Response.json({ channels: salons })
}
