# LinkHub — tes serveurs Discord, partagés proprement

Plateforme où les propriétaires de serveurs Discord partagent une **invitation permanente surveillée** :
le lien sert à une API publique (pour tes sites / boutons « Rejoindre ») et est **régénéré automatiquement
toutes les 5 minutes** si l'invitation disparaît. Un **heartbeat Discord** prévient ton équipe quand le
site est en ligne (ou non), et un **tableau de bord** complet permet de tout piloter.

## Fonctionnalités

- **Connexion Discord OAuth2** (scopes `identify guilds`), sessions signées avec expiration.
- **Partage de serveur** : le bot de ton application liste les salons et crée l'invitation permanente
  sur le salon choisi (Discord refuse les tokens utilisateur sur ces endpoints).
- **Vérificateur toutes les 5 min** : invitation supprimée/expirée ? Il en recrée une immédiatement et
  met à jour les compteurs (membres, en ligne, utilisations). Auto-réparation du salon si nécessaire.
  Une erreur **temporaire** de Discord (timeout, 429, 5xx) ne déclenche **jamais** de régénération :
  seule une invitation réellement inconnue (404) ou expirée est remplacée.
- **Heartbeat Discord** : le site se ping lui-même (`/api/health`) puis envoie un embed à un webhook
  Discord. Intervalle réglable (5 min par défaut), mention de rôle, message personnalisable, test
  immédiat et historique des envois. URL chiffrée en AES-256-GCM.
- **API publique v1** : `GET /api/v1/guilds`, `GET /api/v1/guilds/{id}`, `GET /api/v1/go/{id}`.
  Clés hachées SHA-256, rate limiting, ETag/304, CORS, en-têtes `X-RateLimit-*`.
- **Pages publiques** : `/s/{discordId}` (page de partage) et `/serveurs` (annuaire avec recherche).
- **Réglages réservés au staff** : application Discord, bot, heartbeat, sécurité, audit.
- **Mode démo** : Discord simulé intégré pour tester sans compte réel (`DISCORD_API_BASE`).

## Démarrage rapide (production)

1. **Base Turso** : crée une base, note l'URL et le token.
2. **Application Discord** (discord.com/developers/applications) :
   - OAuth2 : copie le Client ID, fais un Reset Secret, ajoute l'URL de redirection affichée dans les
     Réglages (exactement `https://TON-SITE/api/auth/discord/callback`).
   - Bot : Reset Token, garde le Bot Token pour les Réglages.
3. **Déploiement** (Render, Vercel, Docker…) avec les variables :
   - `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
   - `APP_SECRET` (chaine aléatoire, `openssl rand -hex 32`)
   - `PUBLIC_BASE_URL` (sans slash final)
   - `STAFF_DISCORD_IDS` (ton ID Discord : Mode développeur → clic droit sur ton nom)
   - `SETUP_TOKEN` (chaine aléatoire, `openssl rand -hex 24`) : **à définir dès que le site
     est public**. Sans lui, la toute première configuration serait ouverte à n'importe qui.
   - `SITE_NAME` (optionnel)
4. **Réglages du site** (staff) : Client ID, Client Secret, Bot Token (+ `SETUP_TOKEN`
   lors de la première configuration).
5. **Heartbeat** : crée un webhook Discord (Salon → Paramètres → Intégrations → Webhooks), colle son URL
   dans **Réglages → Heartbeat**, choisis l'intervalle (5 min), active et clique « Pinger maintenant ».
6. Sur un serveur à partager : bouton « Ajouter le bot » (dans la liste des salons), puis « Partager ».

## Base de données

Le client Prisma est généré avec le générateur `prisma-client` (`engineType = "client"`) : il n'embarque
pas de moteur Rust et s'appuie sur l'adapter libSQL. La CLI Prisma 6.x télécharge en revanche son
`schema-engine` pendant `prisma generate` : l'installation a donc besoin d'un accès à
`binaries.prisma.sh` (ou d'un cache de binaires), même si l'exécution n'en dépend pas.
Le script `postinstall` lance la génération automatiquement.

- **Base neuve** : `turso-schema.sql` (ou `npx prisma db push`).
- **Base existante** : applique dans l'ordre
  `migrations/2026-11-05-webhook-security.sql` (tables `SiteSettings`, `WebhookDelivery`,
  `AuditEvent`, colonnes `Guild.lastCheckLatencyMs`, `Guild.failureCount`, `ApiKey.keyHash`,
  `ApiKey.keyPrefix`, `ApiKey.publicId`, `ApiKey.lastIp`) puis
  `migrations/2026-11-07-lot3-secrets-sessions.sql` (colonne `User.sessionVersion`,
  table `JobLock`), puis `migrations/2026-11-07-lot4-clicks.sql` (table `ClickStat`).
  Sans cette dernière, tout fonctionne : seuls les compteurs de clics restent à zéro.
- La migration est **additive** : aucune donnée existante n'est supprimée. Les anciennes clés d'API
  continuent de fonctionner (compatibilité ascendante).

Pour appliquer une migration, le nom de la base se met **sans chevrons ni guillemets**
(les `<…>` des exemples sont des espaces réservés, le shell les interpréterait comme des redirections) :

```bash
turso db shell NOM-DE-TA-BASE < migrations/2026-11-07-lot4-clicks.sql
```

Si tu préfères la console web Turso, elle n'exécute **qu'une instruction à la fois** : colle les
blocs `CREATE …` un par un, sans les commentaires. Vérification :

```sql
SELECT name, type FROM sqlite_master WHERE name LIKE 'ClickStat%';
```

## Variables d'environnement

Voir `.env.example` pour la liste complète. `DISCORD_API_BASE` sert uniquement au mode démo : ne le
définis **pas** en production.

## Développement local

```bash
cp .env.example .env   # puis renseigne APP_SECRET (et DISCORD_API_BASE pour le mode démo)
npm install
npm run db:push        # crée la base locale db/custom.db (ignorée par git)
npm run dev            # mode démo si DISCORD_API_BASE est défini dans .env
```

Le projet utilise **un seul lockfile** (`package-lock.json`) : `npm ci` pour une installation
reproductible. La base SQLite de développement (`db/*.db`) et le fichier `linkhub-schema.db` sont des
artefacts locaux, non versionnés.

Le mode démo nécessite le serveur Discord simulé :

```bash
node --experimental-strip-types mini-services/mock-discord/index.ts
```

## Tests & CI

```bash
npm test           # Vitest : 54 tests unitaires (ni réseau, ni base requis)
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
```

Les tests couvrent les briques sensibles : chiffrement et empreintes des secrets,
sessions signées (expiration, falsification, ancien format), validation des URL de
webhook et des snowflakes, rate limiting, protection CSRF, et surtout le comportement
du vérificateur : **une panne Discord ne doit jamais régénérer une invitation**, alors
qu'un 404 ou une invitation expirée doivent l'être.

La CI (`.github/workflows/ci.yml`) exécute lint, types, tests et build de production
sur chaque poussée et chaque pull request. Le build échoue désormais sur une erreur
TypeScript (`ignoreBuildErrors: false`).

## Tâches planifiées (cron)

Le vérificateur d'invitations tourne toutes les 5 minutes. Deux modes, selon l'hébergement :

- **Serveur long** (Render, Docker, VPS) : la boucle interne démarre avec le serveur, rien à faire.
- **Serverless** (Vercel, Netlify, Lambda) : une boucle `setInterval` ne survit pas entre deux
  requêtes. Elle est donc désactivée et un **cron externe** doit appeler la route dédiée.

```bash
curl -s -X POST https://TON-SITE/api/cron/refresh -H "Authorization: Bearer $CRON_SECRET"
```

La route (désactivée — 503 — tant que `CRON_SECRET` n'est pas défini) vérifie les invitations par
lots de 100, envoie le heartbeat Discord si son intervalle est échu et renvoie les métriques.
Un verrou en base (`JobLock`) garantit qu'une seule instance travaille à la fois, même si la boucle
interne et le cron se déclenchent ensemble.

### Réveil automatique toutes les 5 minutes (GitHub Actions)

`.github/workflows/ping.yml` appelle le site **toutes les 5 minutes**, sans service externe :

- si `CRON_SECRET` est défini côté dépôt → `POST /api/cron/refresh` : le site se réveille **et**
  rafraîchit les invitations ;
- sinon → `GET /api/ping` : simple keep-alive (le site répond, rien d'autre).

Mise en place, une seule fois, dans **Settings → Secrets and variables → Actions** :

| Type | Nom | Valeur |
| --- | --- | --- |
| Variable | `SITE_URL` | `https://ton-site.exemple.com` (sans slash final) |
| Secret | `CRON_SECRET` | la même valeur que la variable d'environnement du site |

Puis **Actions → Ping (5 min) → Run workflow** pour tester à la main. Comportement des codes :

| Réponse | Sens | Run |
| --- | --- | --- |
| `200` | site joignable, cycle effectué | vert |
| — | `SITE_URL` non configuré | vert + avertissement (aucun échec, pas d'e-mail) |
| `503` | site sans `CRON_SECRET` : keep-alive seul | vert + avertissement |
| `401` | secret du dépôt ≠ secret du site | rouge |
| `429` | limite de 12 appels/min atteinte | vert + avertissement |
| injoignable | DNS / TLS / timeout | rouge |

Limites à connaître : GitHub garantit *au mieux* 5 minutes (décalage possible de quelques minutes
en période de charge), et **désactive les workflows planifiés après 60 jours sans activité du
dépôt** (un commit ou un lancement manuel les réactive). Pour un rythme strict, un cron externe
gratuit (cron-job.org, UptimeRobot) qui appelle la même URL fait l'affaire.

Sur Vercel, un `vercel.json` avec `"crons": [{ "path": "/api/cron/refresh", "schedule": "*/5 * * * *" }]`
fonctionne aussi — mais attention, le plan Hobby n'autorise qu'un passage **par jour** et refuse le
déploiement avec un rythme plus court. Le workflow GitHub, lui, marche partout.

### Webhook Discord toutes les 5 minutes

C'est le **heartbeat** : le site se ping lui-même (`/api/health`) puis poste un embed dans ton salon.

1. Discord → ton salon → **Paramètres du salon → Intégrations → Webhooks → Nouveau webhook** →
   *Copier l'URL du webhook*.
2. LinkHub → **Réglages → Heartbeat** : colle l'URL, choisis **toutes les 5 min**, active, puis
   **Pinger maintenant** pour vérifier que le message arrive.
3. Rien d'autre : le site envoie ensuite un message toutes les 5 minutes (mention de rôle et texte
   personnalisables avec `{site}`, `{status}`, `{latency}`, `{guilds}`, `{errors}`, `{url}`).

Comment le rythme est tenu :

- **serveur long** : une boucle interne vérifie toutes les 30 s si l'intervalle est échu ;
- **serverless** : pas de boucle, c'est l'appel `POST /api/cron/refresh` (toutes les 5 min) qui
  envoie le heartbeat — désormais **à chaque appel**, même si une autre instance tient le verrou du
  cycle, sinon un ping sur deux était perdu ;
- une marge de 60 s (plafonnée au quart de l'intervalle) évite qu'un cron légèrement en avance rate
  son tour et n'envoie qu'une fois sur deux.

L'URL du webhook est stockée chiffrée (AES-256-GCM), jamais renvoyée en clair, et l'historique des
50 derniers envois (statut, latence, erreur) est visible dans le même panneau.

## Sécurité

- Sessions HMAC-SHA256 avec expiration (30 j), nonce, cookie `HttpOnly; Secure; SameSite=None` en HTTPS.
- Protection CSRF same-origin sur toutes les mutations.
- Première configuration protégée : `SETUP_TOKEN` (ou une session staff si `STAFF_DISCORD_IDS`
  est défini). Une fois configuré, les réglages restent réservés au staff.
- Rate limiting : 120 req/min/clé, 300 req/min/IP, limites dédiées OAuth / réglages / partages.
- Clés d'API : seule l'empreinte SHA-256 est stockée ; la clé en clair est affichée une seule fois.
  Les boutons HTML utilisent un **jeton public** non secret (`?ref=`) séparé de la clé d'API.
- **Secrets chiffrés en base** (AES-256-GCM, clé dérivée de `APP_SECRET`) : URL de webhook, Client
  Secret, Bot Token, access/refresh tokens Discord. Les valeurs encore en clair (installations
  antérieures) restent lisibles et sont re-chiffrées automatiquement à la première lecture.
  ⚠️ `APP_SECRET` est la clé de ces secrets : si tu le changes, ils deviennent illisibles et
  doivent être ressaisis dans **Réglages** (garde-le stable et sauvegardé).
- **Sessions révocables** : chaque cookie porte `User.sessionVersion` ; incrémenter cette valeur
  (bouton « déconnecter toutes mes sessions ») invalide immédiatement tous les cookies existants.
- En-têtes CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP.
- Journal d'audit (500 derniers événements) visible dans **Réglages → Sécurité**.
- Validation stricte des identifiants Discord (snowflakes) et des URLs de webhook.

## API publique

```bash
curl -s https://TON-SITE/api/v1/guilds -H "X-API-Key: dlh_ta_cle"
```

Réponse (extrait) :

```json
{
  "ok": true,
  "count": 1,
  "total": 1,
  "guilds": [
    {
      "id": "123456789012345678",
      "name": "Mon serveur",
      "invite_url": "https://discord.gg/abc123",
      "invite_url_direct": "https://TON-SITE/api/v1/go/123456789012345678?ref=JETON_PUBLIC",
      "members": 1240,
      "online": 87
    }
  ]
}
```

### Pagination

La liste est paginée par curseur : `?limit=` (1 à 200, 50 par défaut) et `?cursor=`.
La réponse contient `count` (serveurs de cette page), `total` (tous les serveurs du
propriétaire) et un bloc `meta` :

```json
{
  "meta": {
    "request_id": "5f0c…",
    "limit": 50,
    "has_more": true,
    "next_cursor": "123456789012345678",
    "rate_limit": 120,
    "rate_remaining": 118,
    "rate_reset": 1762526400
  }
}
```

Pour la page suivante, rejoue le même appel avec `&cursor=<next_cursor>`. Un curseur
dont le serveur a été supprimé entre-temps relance simplement depuis le début.

### Documentation OpenAPI

`GET /api/v1/openapi.json` renvoie la spécification OpenAPI 3.1 complète (endpoints,
schémas, erreurs, en-têtes de rate limit). Elle est publique et importable directement
dans Postman, Insomnia ou `openapi-typescript`.

### Badge « invitation vérifiée »

Une image SVG prête à intégrer sur n'importe quel site, sans clé d'API :

```html
<a href="https://TON-SITE/s/123456789012345678">
  <img src="https://TON-SITE/api/badge/123456789012345678.svg" alt="Invitation vérifiée">
</a>
```

Trois états : **invitation vérifiée** (contrôle de moins de 15 min), **vérification en
échec** (dernier contrôle en erreur ou trop ancien) et **non vérifié** (identifiant
inconnu). Le nombre de clics des 7 derniers jours s'ajoute automatiquement dès qu'il
est non nul. Réponse en 200 dans tous les cas, avec 60 s de cache navigateur et 5 min
de cache CDN (`Cache-Control` public, surchargé dans `next.config.ts`).

### Statistiques de clics

Chaque passage par `/api/v1/go/{id}` (et par le bouton de la page publique) incrémente
un compteur **journalier** par serveur (table `ClickStat`). Aucune donnée personnelle
n'est conservée : ni IP, ni user-agent, ni identifiant de visiteur — seulement
« serveur + jour + nombre ».

Le tableau de bord affiche les clics des 7 derniers jours sur chaque carte serveur
(infobulle : aujourd'hui / 7 jours / 30 jours). L'écriture est non bloquante : si la
table n'existe pas encore, la redirection fonctionne quand même.

### Référencement

- `/robots.txt` : pages publiques autorisées (`/`, `/serveurs`, `/s/{id}`), `dashboard` et
  `api` exclus, plan de site déclaré.
- `/sitemap.xml` : pages statiques + un URL par serveur réellement publié (jusqu'à 5 000,
  régénéré au plus toutes les heures). `PUBLIC_BASE_URL` doit être défini en production,
  sinon les URL générées utilisent `http://localhost:3000`.

Endpoints complémentaires : `/api/ping` (moniteurs), `/api/health` (diagnostic + heartbeat),
`/api/stats` (chiffres publics agrégés), `/api/audit` (staff).

## Pourquoi un bot ?

Discord refuse les endpoints `GET /guilds/{id}/channels` et `POST /channels/{id}/invites` aux tokens
UTILISATEUR OAuth2 (401). Seul un **bot membre du serveur** peut le faire. Le bot utilisé est celui de
TON application Discord (même Client ID que la connexion). Permissions demandées : Voir les salons +
Créer une invitation (1025). Il n'envoie jamais de messages.

## Pages & bot (v2)

- `/` : landing minimaliste (hero, 3 fonctionnalités, 3 étapes, CTA).
- `/dashboard` : vue d'ensemble (stats, état du système, heartbeat).
- `/dashboard/serveurs` : serveurs partagés + section « Serveurs sans le bot ».
- `/dashboard/cles` : clés d'API hachées + jeton public pour les boutons.
- `/dashboard/docs` : documentation de l'API v1.
- `/dashboard/reglages` : application Discord, bot, heartbeat, sécurité, audit.
- `/serveurs` : annuaire public avec recherche et tri.
- `/s/{discordId}` : page de partage publique d'un serveur.

### Bot présent uniquement

Le tableau de bord ne liste que les serveurs où le bot de la plateforme est membre.
Les serveurs éligibles sans bot sont regroupés dans une section dédiée avec un bouton
« Ajouter le bot » en un clic. Le bouton est aussi présent sur la landing et dans les
Réglages. En mode démo, `/api/mock/bot-invite?guild_id=...` simule l'ajout du bot.

### Sécurité (v2)

- `unsafe-eval` retiré de la CSP.
- En-têtes ajoutés : `X-DNS-Prefetch-Control`, `X-Download-Options`,
  `X-Permitted-Cross-Domain-Policies`, `Origin-Agent-Cluster`.
- `/dashboard/*` et `/api/*` en `Cache-Control: no-store` + `X-Robots-Tag: noindex`.
- Rate limiting ajouté sur `/api/health`, `/api/ping`, `/api/me` et `/api/config`.
