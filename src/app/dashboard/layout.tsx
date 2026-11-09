import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionUser, isStaffUser } from '@/lib/auth'
import { userAvatarUrl } from '@/lib/discord'
import { DashboardShell } from '@/components/hub/dashboard-shell'
import type { SessionUser } from '@/components/hub/types'

// Le tableau de bord est toujours dynamique : il dépend du cookie de session.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Tableau de bord · LinkHub',
  description: 'Gère tes serveurs partagés, tes clés d’API et la surveillance Discord.',
  robots: { index: false, follow: false, nocache: true },
}

export default async function DashboardLayout() {
  const user = await getSessionUser()
  if (!user) redirect('/')

  const sessionUser: SessionUser = {
    id: user.id,
    username: user.username,
    globalName: user.globalName,
    avatarUrl: userAvatarUrl(user.id, user.avatar),
    isStaff: isStaffUser(user),
  }

  return <DashboardShell user={sessionUser} />
}
