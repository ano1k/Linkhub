import { safeEqual } from '@/lib/security'

/**
 * Regles d'ecriture de la configuration Discord (`POST /api/config`).
 *
 * Le cas delicat est le **bootstrap** : sur une instance neuve, personne ne peut
 * encore se connecter (l'OAuth n'est pas configure), donc la premiere ecriture
 * ne peut pas exiger de session. Sans garde-fou, n'importe qui pourrait
 * enregistrer SON application Discord avant le proprietaire et intercepter les
 * connexions. Deux protections, dans cet ordre :
 *
 *  1. `SETUP_TOKEN` defini -> le jeton doit correspondre ;
 *  2. `STAFF_DISCORD_IDS` defini -> une session staff est exigee ;
 *  3. aucun des deux (developpement local) -> bootstrap ouvert.
 */
export type ConfigWriteAccess =
  | { ok: true; via: 'staff' | 'token' | 'open' }
  | { ok: false; status: 403; error: string }

export function evaluateConfigWriteAccess(input: {
  /** Une configuration Discord existe deja en base. */
  alreadyConfigured: boolean
  /** L'utilisateur de la session est-il staff ? */
  isStaff: boolean
  /** Jeton fourni par le client (body ou en-tete x-setup-token). */
  providedToken: string
  /** Valeur de la variable d'environnement SETUP_TOKEN (vide si non definie). */
  expectedToken: string
  /** STAFF_DISCORD_IDS est-il defini ? */
  staffConfigured: boolean
}): ConfigWriteAccess {
  const { alreadyConfigured, isStaff, providedToken, expectedToken, staffConfigured } = input

  // Configuration deja en place : seuls les membres du staff peuvent la modifier.
  if (alreadyConfigured) {
    return isStaff
      ? { ok: true, via: 'staff' }
      : { ok: false, status: 403, error: 'Les reglages sont reserves au staff.' }
  }

  // Premiere configuration : jeton d'installation prioritaire.
  if (expectedToken) {
    if (providedToken && safeEqual(providedToken, expectedToken)) {
      return { ok: true, via: 'token' }
    }
    return {
      ok: false,
      status: 403,
      error:
        "Jeton d'installation requis : definis SETUP_TOKEN dans les variables d'environnement du site, puis saisis-le dans ce formulaire.",
    }
  }

  // Instance protegee par une liste de staff mais sans jeton : session staff obligatoire.
  if (staffConfigured) {
    return isStaff
      ? { ok: true, via: 'staff' }
      : {
          ok: false,
          status: 403,
          error:
            "Cette instance est reservee a son staff. Connecte-toi avec un compte staff, ou definis SETUP_TOKEN pour autoriser la premiere configuration.",
        }
  }

  // Developpement local : aucun staff ni jeton configures, on autorise le bootstrap.
  return { ok: true, via: 'open' }
}
