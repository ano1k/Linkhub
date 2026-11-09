import { db } from '@/lib/db'

/**
 * Verrou distribue pour les taches planifiees.
 *
 * Le rafraichissement des invitations ne doit tourner qu'une fois par intervalle,
 * meme si plusieurs instances du site (ou un cron externe + l'intervalle interne)
 * sont actives. La ligne `JobLock` porte une date d'expiration : seul le premier
 * appel a reussir la mise a jour conditionnelle travaille ; les autres passent
 * leur tour. Le verrou expire tout seul (pas de blocage definitif si un process
 * meurt en cours de route).
 */

export const REFRESH_LOCK = 'refresh'
/** Doit rester superieur a la duree d'un cycle complet. */
export const REFRESH_LOCK_TTL_MS = 5 * 60_000

/**
 * Tente de prendre le verrou. Renvoie true si on l'a obtenu.
 * En cas de base indisponible (ou de table absente), on laisse passer : mieux
 * vaut un cycle en double qu'aucun rafraichissement du tout.
 */
export async function acquireJobLock(
  name: string,
  ttlMs: number = REFRESH_LOCK_TTL_MS,
  owner = 'unknown',
): Promise<boolean> {
  const now = new Date()
  const lockedUntil = new Date(now.getTime() + ttlMs)
  try {
    // Cree la ligne si elle n'existe pas encore (verrou libre).
    const existing = await db.jobLock.findUnique({ where: { id: name } }).catch(() => null)
    if (!existing) {
      await db.jobLock
        .create({ data: { id: name, lockedUntil: new Date(0), owner } })
        .catch(() => {})
    }
    // Mise a jour conditionnelle atomique : un seul appelant peut gagner.
    const result = await db.jobLock.updateMany({
      where: { id: name, lockedUntil: { lt: now } },
      data: { lockedUntil, owner },
    })
    return result.count > 0
  } catch {
    return true
  }
}

/** Libere le verrou (sans erreur si on ne le detient plus). */
export async function releaseJobLock(name: string): Promise<void> {
  await db.jobLock
    .updateMany({ where: { id: name }, data: { lockedUntil: new Date(0) } })
    .catch(() => {})
}
