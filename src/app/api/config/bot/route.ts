import { db } from '@/lib/db'
import { getSessionUser, isStaffUser } from '@/lib/auth'

// POST /api/config/bot -> enregistre le Bot Token (reserve au staff)
// Route dediee : on peut enregistrer le bot sans retaper le Client Secret.
export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!isStaffUser(user)) {
    return Response.json({ error: 'Les reglages sont reserves au staff.' }, { status: 403 })
  }

  let body: { botToken?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Corps de requete invalide.' }, { status: 400 })
  }

  const botToken = (body.botToken || '').trim()
  if (!botToken) {
    return Response.json({ error: 'Le Bot Token est requis.' }, { status: 400 })
  }

  try {
    await db.appConfig.upsert({
      where: { id: 'main' },
      create: { id: 'main', discordBotToken: botToken },
      update: { discordBotToken: botToken },
    })
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'Erreur inconnue'
    const hint = /no column named discordBotToken|no such column/i.test(detail)
      ? "La colonne du bot n'existe pas encore : applique la migration (console Turso) : ALTER TABLE AppConfig ADD COLUMN discordBotToken TEXT;"
      : 'Verifie TURSO_DATABASE_URL et TURSO_AUTH_TOKEN, puis l\'etat de la base sur /api/health.'
    console.error('[config:bot] echec enregistrement :', detail)
    return Response.json(
      { error: `Ecriture en base impossible : ${detail}. ${hint}` },
      { status: 500 },
    )
  }

  return Response.json({ ok: true, botConfigured: true })
}
