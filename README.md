# LinkHub — tes serveurs Discord, partages proprement

Plateforme ou les proprietaires de serveurs Discord partagent une **invitation permanente surveillee** :
le lien sert a une API publique (pour tes sites/boutons "Rejoindre") et est **regenere automatiquement
toutes les 5 minutes** si l'invitation disparait.

## Fonctionnement

- Connexion avec Discord (OAuth2, scopes `identify guilds`).
- L'utilisateur partage un serveur ou il a les droits : le **bot de la plateforme** (que tu ajoutes au
  serveur en un clic) liste les salons et cree l'invitation permanente sur le salon choisi.
- Un verificateur interne tourne toutes les 5 minutes : invitation supprimee/expiree ? Il en recree une
  immediatement et met a jour les compteurs (membres, en ligne, utilisations).
- API publique v1 (cle d'API) : `GET /api/v1/guilds`, `GET /api/v1/guilds/{id}`, `GET /api/v1/go/{id}`
  (redirection vers le lien a jour). Documentation integree dans l'onglet "Documentation".
- **Reglages reserve au staff** : liste d'IDs Discord dans la variable `STAFF_DISCORD_IDS`.

## Pourquoi un bot ?

Discord **refuse** les endpoints `GET /guilds/{id}/channels` et `POST /channels/{id}/invites` aux tokens
UTILISATEUR OAuth2 (reponse 401) : seuls les **bots membres du serveur** peuvent le faire. Le bot utilise
est celui de TON application Discord (meme Client ID que la connexion). Permissions demandees :
Voir les salons + Creer une invitation (1025). Il n'envoie jamais de messages.

## Installation (Render + Turso)

1. **Base Turso** (app.turso.io) : cree une base, note l'URL et le token.
2. **Application Discord** (discord.com/developers/applications) :
   - OAuth2 : copie le Client ID, Reset Secret, ajoute le Redirect (affiche dans les Reglages du site).
   - Bot : Reset Token, garde le Bot Token pour l'etape 4.
3. **Deploy Render** (Build `npm install && npm run build`, Start `npm start`) avec les variables :
   - `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
   - `APP_SECRET` (chaine aleatoire, signe les sessions)
   - `PUBLIC_BASE_URL` (sans slash final)
   - `STAFF_DISCORD_IDS` (ton ID Discord : Mode developpeur puis clic droit sur ton nom)
4. **Reglages du site** (staff) : Client ID, Client Secret, Bot Token.
5. **Migration si la base existait avant le support du bot** : dans la console Turso, execute
   `ALTER TABLE AppConfig ADD COLUMN discordBotToken TEXT;` (voir `migration-bot-token.sql`).
   Base neuve : colle `turso-schema.sql` ou uploade `linkhub-schema.db`.
6. Sur un serveur a partager : bouton « Ajouter le bot » (dans la liste des salons), puis « Partager ».

## Variables d'environnement

Voir `.env.example` pour la liste complete. `DISCORD_API_BASE` sert uniquement au mode demo
(Discord simule) : ne PAS le definir en production.

## Developpement local

```bash
npm install
npm run db:push     # cree la base locale (db/custom.db)
npm run dev         # mode demo si DISCORD_API_BASE est defini dans .env
```
