import { db } from '@/lib/db'

/**
 * Compteur de clics sur les liens de partage.
 *
 * Chaque clic incremente un compteur journalier (`ClickStat`) : aucune donnee
 * personnelle n'est conservee (ni IP, ni user-agent), et la table reste petite
 * (une ligne par serveur et par jour).
 *
 * L'enregistrement est toujours non bloquant : un clic perdu ne doit jamais
 * casser une redirection.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** Cle de jour UTC (AAAA-MM-JJ) : stable quel que soit le fuseau du serveur. */
export function dayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

/** Cle du jour situe `days` jours avant `from`. */
export function daysAgoKey(days: number, from: Date = new Date()): string {
  return dayKey(new Date(from.getTime() - days * DAY_MS))
}

export type ClickSummary = {
  today: number
  last7Days: number
  last30Days: number
  /** Clics par jour sur 7 jours, du plus ancien au plus recent (pour le graphique). */
  series: number[]
}

const EMPTY_SERIES = [0, 0, 0, 0, 0, 0, 0]

export function emptyClickSummary(): ClickSummary {
  return { today: 0, last7Days: 0, last30Days: 0, series: [...EMPTY_SERIES] }
}

/** Position d'un jour dans la fenetre de 7 jours (0 = il y a 6 jours, 6 = aujourd'hui). */
function seriesIndex(day: string, today: string): number {
  const diff = Math.round((Date.parse(today) - Date.parse(day)) / DAY_MS)
  return 6 - diff
}

/** Enregistre un clic. Ne leve jamais et n'attend rien de l'appelant. */
export async function recordClick(discordId: string): Promise<void> {
  if (!/^\d{17,20}$/.test(discordId)) return
  try {
    const day = dayKey()
    await db.clickStat.upsert({
      where: { discordId_day: { discordId, day } },
      create: { discordId, day, count: 1 },
      update: { count: { increment: 1 } },
    })
  } catch {
    // table absente (migration non appliquee) ou base indisponible : on ignore
  }
}

/**
 * Agrege les clics des serveurs demandes en une requete.
 * Renvoie une entree (a zero) pour chaque identifiant, meme sans clic.
 */
export async function summarizeClicks(
  discordIds: readonly string[],
  now: Date = new Date(),
): Promise<Map<string, ClickSummary>> {
  const ids = [...new Set(discordIds)]
  const result = new Map<string, ClickSummary>()
  for (const id of ids) result.set(id, emptyClickSummary())
  if (ids.length === 0) return result

  const today = dayKey(now)
  const from7 = daysAgoKey(6, now) // 7 jours, aujourd'hui inclus
  const from30 = daysAgoKey(29, now) // 30 jours, aujourd'hui inclus

  const rows = await db.clickStat
    .findMany({
      where: { discordId: { in: ids }, day: { gte: from30 } },
      select: { discordId: true, day: true, count: true },
    })
    .catch(() => [] as Array<{ discordId: string; day: string; count: number }>)

  for (const row of rows) {
    const summary = result.get(row.discordId)
    if (!summary) continue
    summary.last30Days += row.count
    // Comparaison lexicographique : les cles sont des dates ISO (AAAA-MM-JJ).
    if (row.day >= from7) {
      summary.last7Days += row.count
      const index = seriesIndex(row.day, today)
      if (index >= 0 && index < 7) summary.series[index] += row.count
    }
    if (row.day === today) summary.today += row.count
  }

  return result
}
