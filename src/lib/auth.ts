import { createHmac, timingSafeEqual, randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { detectPublicProto, isMockMode } from '@/lib/config'
import type { User } from '@prisma/client'

/**
 * _v2 : nouveau nom de cookie. L'ancien nom (dlh_session) a pose probleme : selon la
 * version du site, le cookie pouvait exister en deux "identites" dans le navigateur
 * (Partitioned / non partitionnee), et Next.js ne peut emitter qu'un seul Set-Cookie
 * par nom — on ne remplacait donc qu'une identite par reconnexion, d'ou l'impossibilite
 * de changer de compte Discord. Avec un nom neuf, une seule identite existe : l'ecriture
 * et la suppression visent toujours la bonne, et les anciens cookies deviennent inertes.
 */
const SESSION_COOKIE = 'dlh_session_v2'
const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 jours

/**
 * En https (preview / production), les cookies doivent survivre au aller-retour OAuth
 * (qui passe par discord.com) et a l'affichage dans un apercu integre (iframe) :
 * SameSite=None + Secure (+ Partitioned pour les navigateurs a CHIPS).
 * En http local, SameSite=None est rejete : on utilise Lax.
 *
 * IMPORTANT : on ecrit TOUTES les variantes du cookie (Partitioned ET non partitionnee).
 * Si une ancienne variante subsiste dans le navigateur (ex : cookie pose par une
 * version precedente du site), les deux coexistent et le navigateur envoie les deux ;
 * ne remplacer qu'une seule garderait l'ancienne session active (impossible de
 * changer de compte Discord). Ecrire les deux ecrase n'importe quelle variante.
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

function appSecret(): string {
  return process.env.APP_SECRET || 'discord-link-hub-dev-secret'
}

function sign(value: string): string {
  return createHmac('sha256', appSecret()).update(value).digest('hex')
}

export function createSessionValue(userId: string): string {
  return `${userId}.${sign(userId)}`
}

export function parseSessionValue(raw: string | undefined | null): string | null {
  if (!raw) return null
  const idx = raw.lastIndexOf('.')
  if (idx <= 0) return null
  const userId = raw.slice(0, idx)
  const sig = raw.slice(idx + 1)
  const expected = sign(userId)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  return userId
}

export function setSessionCookie(res: Response, userId: string, req?: Request): void {
  const isHttps = req ? isHttpsRequest(req) : false
  for (const cookie of sessionCookieStrings(createSessionValue(userId), SESSION_MAX_AGE, isHttps)) {
    res.headers.append('set-cookie', cookie)
  }
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
  let userId: string | null = null
  for (const cookie of store.getAll(SESSION_COOKIE)) {
    const parsed = parseSessionValue(cookie.value)
    if (parsed) userId = parsed
  }
  if (!userId) return null
  try {
    return await db.user.findUnique({ where: { id: userId } })
  } catch {
    return null
  }
}

/** Genere une nouvelle cle d'API (prefixe lisible + partie aleatoire). */
export function generateApiKey(): string {
  return `dlh_${randomBytes(24).toString('hex')}`
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
