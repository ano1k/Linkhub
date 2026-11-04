import {
  createChannelInvite,
  createChannelInviteAsBot,
  fetchGuildAsBot,
  isBotNotInGuild,
  type DiscordInvite,
} from '@/lib/discord'
import { buildBotInviteUrl, getDiscordConfig, isMockMode } from '@/lib/config'

/** Erreur metier d'invitation : message affichable + URL d'ajout du bot si pertinent. */
export class InviteError extends Error {
  status: number
  addBotUrl?: string
  botRequired?: boolean
  constructor(
    status: number,
    message: string,
    opts?: { addBotUrl?: string; botRequired?: boolean },
  ) {
    super(message)
    this.status = status
    this.addBotUrl = opts?.addBotUrl
    this.botRequired = opts?.botRequired
  }
}

/** Convertit une InviteError en reponse JSON exploitable par le client. */
export function inviteErrorResponse(e: unknown): Response | null {
  if (!(e instanceof InviteError)) return null
  return Response.json(
    { error: e.message, addBotUrl: e.addBotUrl ?? null, botRequired: e.botRequired ?? false },
    { status: e.status },
  )
}

/**
 * Cree une invitation permanente sur un salon : via le BOT du serveur (obligatoire en
 * production : Discord refuse les tokens utilisateur sur la creation d'invitations),
 * sinon via le token utilisateur en mode demo seulement.
 * Leve une InviteError avec un message affichable si Discord refuse.
 */
export async function createInviteSmart(
  discordId: string,
  channelId: string,
): Promise<DiscordInvite> {
  const { clientId, botToken } = await getDiscordConfig()

  if (botToken) {
    try {
      await fetchGuildAsBot(botToken, discordId)
    } catch (e) {
      if (isBotNotInGuild(e)) {
        throw new InviteError(
          403,
          "Le bot n'est pas encore sur ce serveur : ajoute-le avec le bouton « Ajouter le bot » de la liste des salons, puis reessaie.",
          { addBotUrl: buildBotInviteUrl(clientId, discordId) },
        )
      }
      throw new InviteError(
        400,
        `Verification du bot impossible (${e instanceof Error ? e.message : 'erreur Discord'}).`,
      )
    }
    try {
      return await createChannelInviteAsBot(botToken, channelId)
    } catch (e) {
      throw new InviteError(
        400,
        `Impossible de creer l'invitation sur ce salon (${e instanceof Error ? e.message : 'erreur Discord'}). Verifie que le bot a la permission « Creer une invitation » sur ce salon, ou choisis un autre salon.`,
      )
    }
  }

  if (isMockMode()) {
    // Mode demo : le Discord simule accepte tout
    try {
      return await createChannelInvite('demo-token', channelId)
    } catch (e) {
      throw new InviteError(
        400,
        `Impossible de creer l'invitation sur ce salon (${e instanceof Error ? e.message : 'erreur Discord'}).`,
      )
    }
  }

  throw new InviteError(
    400,
    "Le bot Discord n'est pas configure : un staff doit ajouter le Bot Token dans les Reglages.",
    { botRequired: true },
  )
}
