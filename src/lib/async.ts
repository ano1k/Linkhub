/**
 * Petits utilitaires asynchrones partages par les routes serveur.
 */

/**
 * Applique `fn` a chaque element en limitant le nombre d'executions simultanees.
 *
 * Utile pour ne pas envoyer N requetes Discord en rafale (rate limit global de
 * l'API) tout en restant bien plus rapide qu'un traitement sequentiel.
 * L'ordre des resultats suit celui des entrees.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  if (items.length === 0) return results

  const size = Math.max(1, Math.min(Math.floor(limit) || 1, items.length))
  let cursor = 0

  const worker = async (): Promise<void> => {
    for (;;) {
      const index = cursor
      cursor += 1
      if (index >= items.length) return
      results[index] = await fn(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: size }, worker))
  return results
}
