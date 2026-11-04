import { createHmac, timingSafeEqual, randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { detectPublicProto, isMockMode } from '@/lib/config'
import type { User } from '@prisma/client'

const SESSION_COOKIE = 'dlh_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 jours

/**
 * En https (preview / production), les cookies doivent survivre au aller-retour OAuth
 * (qui passe par discord.com) et a l'affichage dans un apercu integre (iframe) :
 * SameSite=None + Secure (+ Partitioned pour les navigateurs a CHIPS).
 * En http local, SameSite=None est rejete : on utilise Lax.
 */
function cookieOptions(isHttps: boolean) {
  return isHttps
    ? { httpOnly: true, secure: true, sameSite: 'none' as const, partitioned: true, path: '/' }
    : { httpOnly: true, secure: false, sameSite: 'lax' as const, path: '/' }
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

export async function setSessionCookie(userId: string, req?: Request): Promise<void> {
  const store = await cookies()
  const isHttps = req ? isHttpsRequest(req) : false
  store.set(SESSION_COOKIE, createSessionValue(userId), {
    ...cookieOptions(isHttps),
    maxAge: SESSION_MAX_AGE,
  })
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
}

/** Renvoie l'utilisateur connecte, ou null. */
export async function getSessionUser(): Promise<User | null> {
  const store = await cookies()
  const userId = parseSessionValue(store.get(SESSION_COOKIE)?.value)
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
