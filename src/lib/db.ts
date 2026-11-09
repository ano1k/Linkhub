import path from 'path'
import fs from 'fs'
import { PrismaClient } from '@/generated/prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Base de donnees (SQLite / libSQL) :
 * - TURSO_DATABASE_URL defini (Render, production) -> Turso via le driver adapter libSQL.
 * - Sinon -> SQLite fichier db/custom.db (developpement local), par le meme adapter :
 *   un seul chemin de code, aucun moteur Rust requis.
 *
 * Appliquer le schema a Turso (une fois) :
 *   npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script \
 *     | turso db shell <nom-de-la-base>
 */
function createDb(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL
  if (tursoUrl) {
    const adapter = new PrismaLibSQL({
      url: tursoUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
    return new PrismaClient({ adapter })
  }

  // En production standalone, le process peut demarrer depuis .next/standalone :
  // on resout DATABASE_URL (file:./db/custom.db) par rapport a la racine du projet
  // (INIT_CWD/PWD), sinon on cherche un fichier db/custom.db existant.
  const resolveLocalUrl = (): string => {
    const envUrl = process.env.DATABASE_URL
    if (envUrl && envUrl.startsWith('file:')) {
      const filePath = envUrl.slice(5)
      if (path.isAbsolute(filePath)) return envUrl
      const base = process.env.INIT_CWD || process.env.PWD || process.cwd()
      return `file:${path.join(base, filePath)}`
    }
    const candidates = [process.env.INIT_CWD, process.env.PWD, process.cwd()].filter(
      (value): value is string => Boolean(value),
    )
    for (const candidate of candidates) {
      if (fs.existsSync(path.join(candidate, 'db', 'custom.db'))) {
        return `file:${path.join(candidate, 'db', 'custom.db')}`
      }
    }
    return `file:${path.join(process.cwd(), 'db', 'custom.db')}`
  }
  const localUrl = resolveLocalUrl()
  const adapter = new PrismaLibSQL({ url: localUrl })
  return new PrismaClient({ adapter, log: process.env.NODE_ENV === 'production' ? [] : ['query'] })
}

export const db = globalForPrisma.prisma ?? createDb()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
