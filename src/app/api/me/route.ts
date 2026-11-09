import { getSessionUser, isStaffUser } from '@/lib/auth'
import { userAvatarUrl } from '@/lib/discord'
import { getClientIp, rateLimit, rateLimitHeaders } from '@/lib/security'

// GET /api/me -> utilisateur connecte (ou null)
export async function GET(req: Request) {
  const ip = getClientIp(req)
  const limit = rateLimit(`me:${ip}`, 120, 60_000)
  if (!limit.allowed) {
    return Response.json(
      { error: 'rate_limited' },
      { status: 429, headers: rateLimitHeaders(limit) },
    )
  }
  const user = await getSessionUser()
  if (!user) return Response.json({ user: null }, { headers: rateLimitHeaders(limit) })
  return Response.json({
    user: {
      id: user.id,
      username: user.username,
      globalName: user.globalName,
      avatarUrl: userAvatarUrl(user.id, user.avatar),
      isStaff: isStaffUser(user),
    },
  }, { headers: rateLimitHeaders(limit) })
}
