import { decryptSecret, encryptSecret } from '@/lib/security'

/**
 * Stockage des secrets en base (tokens Discord, Client Secret, Bot Token).
 *
 * Format chiffre : `v1.<iv>.<tag>.<donnees>` (AES-256-GCM, cle derivee de APP_SECRET).
 * Les valeurs ecrites avant cette version sont en clair : `openSecret` les accepte
 * toujours, et les modules qui les lisent les re-chiffrent au passage (migration
 * progressive, aucune interruption de service, aucune action manuelle).
 */

const SEALED_PREFIX = 'v1.'

/** Vrai si la valeur a deja le format chiffre. */
export function isSealed(value: string | null | undefined): boolean {
  return Boolean(value && value.startsWith(SEALED_PREFIX) && value.split('.').length === 4)
}

/** Chiffre une valeur avant ecriture. Une valeur deja chiffree n'est pas re-chiffree. */
export function sealSecret(value: string | null | undefined): string | null {
  if (!value) return null
  return isSealed(value) ? value : encryptSecret(value)
}

/** Dechiffre une valeur lue en base (les anciennes valeurs en clair passent telles quelles). */
export function openSecret(value: string | null | undefined): string | null {
  if (!value) return null
  if (!isSealed(value)) return value
  return decryptSecret(value)
}
