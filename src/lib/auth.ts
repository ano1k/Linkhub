import { randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { detectPublicProto, isMockMode } from '@/lib/config'
import { hmac, safeEqual } from '@/lib/security'
import type { User } from '@/generated/prisma/client'

/**
 * Session signee (HMAC-SHA256) avec expiration et revocation.
 *
 * Format v3 : <userId>.<expiresAt>.<version>.<nonce>.<signature>
 * - expiration : 30 jours, verifiee a chaque requete
 * - version : copie de User.sessionVersion ; incrementer cette colonne revoque
 *   toutes les sessions de l'utilisateur (bouton « deconnecter partout »)
 * - nonce : rend chaque session unique (rotation a chaque connexion)
 * - signature : empeche la falsification du userId, de l'expiration ou de la version
 *
 * Les formats precedents (v2 `<userId>.<expires>` sans version, v1 sans expiration)
 * restent acceptes pour ne pas deconnecter les sessions en cours : ils sont lus
 * comme version 0, donc revoques des que sessionVersion passe a 1.
 *
 * Le nom du cookie (`dlh_session_v2`) est historique et n'est jamais change : le
 * renommer deconnecterait tout le monde, alors que le format, lui, est versionne.
 */
const SESSION_COOKIE = 'dlh_session_v2'
const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 jours
const SESSION_TTL_MS = SESSION_MAX_AGE * 1000

/**
 * En https (preview / production), les cookies doivent survivre au aller-retour OAuth
 * (qui passe par discord.com) et a l'affichage dans un apercu integre (iframe) :
 * SameSite=None + Secure (+ Partitioned pour les navigateurs a CHIPS).
 * En http local, SameSite=None est rejete : on utilise Lax.
 */
function sessionCookieStrings(value: string, maxAge: number, isHttps: boolean): string[] {
  const base = `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Max-Age=${maxAge}`
  return isHttps
    ? [`${base}; Secure; SameSite=None`, `${base}; Secure; SameSite=None; Partitioned`]
    : [`${base}; SameSite=Lax`]
}

function isHttpsRequest(req: Request): boolean {
  return detectPublicProto(req) === 'https'
}

export type ParsedSession = {
  userId: string
  /** Version de session attendue (0 pour les cookies des anciens formats). */
  version: number
}

export function createSessionValue(userId: string, sessionVersion = 0): string {
  const expiresAt = Date.now() + SESSION_TTL_MS
  const nonce = randomBytes(12).toString('hex')
  const payload = `${userId}.${expiresAt}.${sessionVersion}.${nonce}`
  return `${payload}.${hmac(payload)}`
}

export function parseSessionValue(raw: string | undefined | null): ParsedSession | null {
  if (!raw) return null
  const parts = raw.split('.')

  // v1 : userId.signature (pas d'expiration) — version 0
  if (parts.length === 2) {
    const [userId, sig] = parts
    if (!userId || !sig) return null
    return safeEqual(sig, hmac(userId)) ? { userId, version: 0 } : null
  }

  // v2 : userId.expiresAt.nonce.signature — version 0
  if (parts.length === 4) {
    const [userId, expiresRaw, nonce, sig] = parts
    if (!userId || !expiresRaw || !nonce || !sig) return null
    const expiresAt = Number(expiresRaw)
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null
    return safeEqual(sig, hmac(`${userId}.${expiresAt}.${nonce}`)) ? { userId, version: 0 } : null
  }

  // v3 : userId.expiresAt.version.nonce.signature
  if (parts.length === 5) {
    const [userId, expiresRaw, versionRaw, nonce, sig] = parts
    if (!userId || !expiresRaw || !versionRaw || !nonce || !sig) return null
    const expiresAt = Number(expiresRaw)
    const version = Number(versionRaw)
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null
    if (!Number.isInteger(version) || version < 0) return null
    const payload = `${userId}.${expiresAt}.${version}.${nonce}`
    return safeEqual(sig, hmac(payload)) ? { userId, version } : null
  }

  return null
}

export function setSessionCookie(
  res: Response,
  userId: string,
  req?: Request,
  sessionVersion = 0,
): void {
  const isHttps = req ? isHttpsRequest(req) : false
  const value = createSessionValue(userId, sessionVersion)
  for (const cookie of sessionCookieStrings(value, SESSION_MAX_AGE, isHttps)) {
    res.headers.append('set-cookie', cookie)
  }
}

/**
 * Revoque toutes les sessions d'un utilisateur (y compris celle en cours) :
 * les cookies existants portent l'ancienne version et sont refuses au prochain
 * appel. Renvoie la nouvelle version.
 */
export async function revokeAllSessions(userId: string): Promise<number> {
  const updated = await db.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  })
  return updated.sessionVersion
}

export function clearSessionCookie(res: Response, req?: Request): void {
  const isHttps = req ? isHttpsRequest(req) : false
  for (const cookie of sessionCookieStrings('', 0, isHttps)) {
    res.headers.append('set-cookie', cookie)
  }
}

/** Renvoie l'utilisateur connecte, ou null. */
export async function getSessionUser(): Promise<User | null> {
  const store = await cookies()
  // Plusieurs cookies de session peuvent coexister (variantes Partitioned / legacy) :
  // le navigateur les envoie du plus ancien au plus recent, on retient le DERNIER
  // valide, c'est-a-dire celui de la connexion la plus recente.
  let parsed: ParsedSession | null = null
  for (const cookie of store.getAll(SESSION_COOKIE)) {
    const candidate = parseSessionValue(cookie.value)
    if (candidate) parsed = candidate
  }
  if (!parsed) return null
  try {
    const user = await db.user.findUnique({ where: { id: parsed.userId } })
    if (!user) return null
    // Session revoquee (ou emise avant une deconnexion globale) : on l'ignore.
    if ((user.sessionVersion ?? 0) !== parsed.version) return null
    return user
  } catch {
    return null
  }
}

/**
 * Le staff (gestion des Reglages de la plateforme) est defini par la variable
 * d'environnement STAFF_DISCORD_IDS : IDs Discord separes par des virgules.
 * En mode demo (Discord simule), tout le monde est staff pour garder le parcours complet.
 */
export function isStaffUser(user: { id: string } | null): boolean {
  if (!user) return false
  if (isMockMode()) return true
  const raw = (process.env.STAFF_DISCORD_IDS || '').trim()
  if (!raw) return false
  return raw
    .split(/[,;\s]+/)
    .filter(Boolean)
    .includes(user.id)
}
