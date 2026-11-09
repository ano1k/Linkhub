import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { isMockMode } from '@/lib/config'
import { DirectoryView, type DirectoryGuild } from '@/components/hub/directory-view'

// Chaque appel recharge la liste depuis la base : compteurs toujours à jour.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Annuaire des serveurs Discord',
  description:
    'Tous les serveurs Discord partagés sur LinkHub, avec une invitation vérifiée et réparée automatiquement toutes les 5 minutes.',
}

async function loadDirectory(): Promise<DirectoryGuild[]> {
  const rows = await db.guild
    .findMany({
      where: { invite: { isNot: null } },
      orderBy: [{ memberCount: 'desc' }, { name: 'asc' }],
    })
    .catch(() => [])
  // Un même serveur peut être partagé par plusieurs utilisateurs : une seule carte par serveur.
  const seen = new Set<string>()
  const out: DirectoryGuild[] = []
  for (const row of rows) {
    if (seen.has(row.discordId)) continue
    seen.add(row.discordId)
    out.push({
      discordId: row.discordId,
      name: row.name,
      icon: row.icon,
      memberCount: row.memberCount,
      onlineCount: row.onlineCount,
      lastCheckAt: row.lastCheckAt ? row.lastCheckAt.toISOString() : null,
      lastCheckStatus: row.lastCheckStatus,
    })
  }
  return out
}

export default async function DirectoryPage() {
  const guilds = await loadDirectory()
  return <DirectoryView guilds={guilds} demo={isMockMode()} />
}
