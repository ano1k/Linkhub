import { db } from '@/lib/db'

type Params = { params: Promise<{ discordId: string }> }

/**
 * GET /api/join/[discordId] -> redirection 302 publique vers l'invitation Discord actuelle.
 * Cible du bouton « Rejoindre » de la page de partage /s/[discordId] : aucune authentification,
 * lecture en base a chaque appel donc toujours l'invitation valide du dernier refresh.
 * Si aucune invitation n'est disponible (en cours de regeneration), on renvoie vers la page
 * publique qui affiche l'etat et se recharge automatiquement.
 */
export async function GET(_req: Request, { params }: Params) {
  const { discordId } = await params
  const row = await db.guild
    .findFirst({
      where: { discordId, invite: { isNot: null } },
      include: { invite: true },
      orderBy: { lastCheckAt: 'desc' },
    })
    .catch(() => null)

  if (row?.invite) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: `https://discord.gg/${row.invite.code}`,
        'Cache-Control': 'no-store',
      },
    })
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: `/s/${discordId}?indisponible=1`,
      'Cache-Control': 'no-store',
    },
  })
}
