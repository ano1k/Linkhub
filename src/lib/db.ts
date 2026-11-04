import path from 'path'
import { PrismaClient } from '@prisma/client'
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

  const localUrl = `file:${path.join(process.cwd(), 'db', 'custom.db')}`
  const adapter = new PrismaLibSQL({ url: localUrl })
  return new PrismaClient({ adapter, log: ['query'] })
}

export const db = globalForPrisma.prisma ?? createDb()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
