/**
 * Pagination par curseur pour l'API publique v1.
 *
 * Le curseur est l'identifiant du dernier element recu (`discordId` des
 * serveurs) : stable, lisible et sans etat serveur. Un curseur inconnu (serveur
 * supprime entre deux appels) relance simplement depuis le debut.
 */

export const DEFAULT_LIMIT = 50
export const MAX_LIMIT = 200

export type PageQuery = {
  limit: number
  cursor: string | null
}

export type PageResult<T> = {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
}

/**
 * Lit `?limit=` et `?cursor=` d'une URL. Un `limit` absent, invalide ou hors
 * bornes est ramene a une valeur acceptable au lieu de renvoyer une erreur :
 * un client ne doit pas casser pour un parametre d'affichage.
 */
export function parsePageQuery(
  input: string | URL,
  options: { defaultLimit?: number; maxLimit?: number } = {},
): PageQuery {
  const defaultLimit = options.defaultLimit ?? DEFAULT_LIMIT
  const maxLimit = options.maxLimit ?? MAX_LIMIT
  const url = typeof input === 'string' ? new URL(input, 'http://localhost') : input

  const raw = Number(url.searchParams.get('limit'))
  const limit =
    Number.isFinite(raw) && raw >= 1 ? Math.min(Math.floor(raw), maxLimit) : Math.min(defaultLimit, maxLimit)

  const cursor = url.searchParams.get('cursor')?.trim()

  return { limit, cursor: cursor && cursor.length > 0 ? cursor : null }
}

/** Decoupe `items` selon la requete de pagination. */
export function paginateByCursor<T>(
  items: readonly T[],
  query: PageQuery,
  getCursor: (item: T) => string,
): PageResult<T> {
  const start = query.cursor ? items.findIndex((item) => getCursor(item) === query.cursor) + 1 : 0
  const slice = items.slice(start, start + query.limit)
  const last = slice[slice.length - 1]
  const hasMore = start + slice.length < items.length

  return {
    items: slice,
    nextCursor: hasMore && last ? getCursor(last) : null,
    hasMore,
  }
}
