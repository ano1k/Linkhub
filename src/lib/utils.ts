import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Lecture JSON tolerante : une reponse vide ou non-JSON (proxy, process tue,
 * 512 de la passerelle) ne doit pas faire echouer le parse avec
 * "Unexpected end of JSON input" mais renvoyer un objet vide exploitable.
 */
export async function readJson<T = Record<string, unknown>>(res: Response): Promise<T> {
  const raw = await res.text().catch(() => '')
  if (!raw) return {} as T
  try {
    return JSON.parse(raw) as T
  } catch {
    return {} as T
  }
}

/** Message d'erreur lisible depuis une reponse HTTP et son payload (eventuellement vide). */
export function responseError(res: Response, payload: { error?: string } | null | undefined): string {
  return payload?.error || `Erreur serveur (HTTP ${res.status})`
}
