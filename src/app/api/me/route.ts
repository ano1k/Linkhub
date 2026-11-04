import { getSessionUser } from '@/lib/auth'
import { userAvatarUrl } from '@/lib/discord'

// GET /api/me -> utilisateur connecte (ou null)
export async function GET() {
  const user = await getSessionUser()
  if (!user) return Response.json({ user: null })
  return Response.json({
    user: {
      id: user.id,
      username: user.username,
      globalName: user.globalName,
      avatarUrl: userAvatarUrl(user.id, user.avatar),
    },
  })
}
