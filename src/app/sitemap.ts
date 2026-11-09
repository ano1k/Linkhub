import type { MetadataRoute } from 'next'
import { db } from '@/lib/db'

// Les serveurs partages changent peu : on regenere le plan de site au plus
// toutes les heures (et la page reste servie depuis le cache entre-temps).
export const revalidate = 3600

// Volume maximal d'URLs de serveurs : au-dela, le plan de site resterait
// valide (< 50 000 URLs) mais lourd a regenerer a chaque cycle.
const MAX_GUILD_URLS = 5000

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
  const now = new Date()

  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/serveurs`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
  ]

  // Seules les pages `/s/{id}` reellement publiees sont listees : sans
  // invitation partagee, la page n'existe pas pour un visiteur.
  const rows = await db.guild
    .findMany({
      where: { invite: { isNot: null } },
      select: { discordId: true, lastCheckAt: true },
      orderBy: [{ memberCount: 'desc' }, { createdAt: 'desc' }],
      take: MAX_GUILD_URLS,
    })
    .catch(() => [] as Array<{ discordId: string; lastCheckAt: Date | null }>)

  const seen = new Set<string>()
  for (const row of rows) {
    if (seen.has(row.discordId)) continue
    seen.add(row.discordId)
    entries.push({
      url: `${base}/s/${row.discordId}`,
      lastModified: row.lastCheckAt ?? now,
      changeFrequency: 'daily',
      priority: 0.6,
    })
  }

  return entries
}
