# LinkHub — Hub de liens de serveurs Discord

Application web pour partager les serveurs Discord d'une communauté : connexion OAuth2 Discord, sélection des salons, génération d'invitations, clés API publiques et bouton « Rejoindre » à intégrer sur vos sites.

**Stack** : Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · Prisma 6 + libSQL (Turso en production, SQLite fichier en local).

---

## 1. Prérequis

| Outil | Usage | Notes |
|---|---|---|
| **Bun 1.1+** (recommandé) | serveur, mock Discord | `curl -fsSL https://bun.sh/install \| bash` |
| Node.js 20+ (alternative) | serveur, déploiement | le mock Discord utilise `Bun.serve` → le **mode démo nécessite Bun** ; avec Node, passez directement en mode réel |
| Turso CLI (production) | base de données distante | `curl -sSfL https://get.tur.so/install.sh \| bash` |

## 2. Installation locale

```bash
unzip linkhub-source.zip && cd linkhub

# 1) Environnement
cp .env.example .env
#   → mettez un vrai secret :  APP_SECRET=$(openssl rand -hex 32)

# 2) Dépendances
bun install        # ou : npm install

# 3) Base de données : le fichier db/custom.db est fourni (données incluses).
#    Pour repartir de zéro :
npm run db:push
```

En local, l'application utilise automatiquement `db/custom.db` via le driver adapter libSQL — aucune variable supplémentaire n'est nécessaire.

**Mode démo** (aucun compte Discord requis) :

```bash
# Terminal 1 — mock Discord (port 3030)
bun mini-services/mock-discord/index.ts

# Terminal 2 — application (port 3000)
bun run dev
```

Ouvrez http://localhost:3000 puis cliquez sur **« Se connecter avec Discord »** : le mock fournit trois comptes de test (admin, invitant, sans droits).

**Production locale** :

```bash
npm run build
node .next/standalone/server.js     # serveur standalone sur le port $PORT (3000 par défaut)
```

## 3. Base de données distante : Turso

Turso héberge votre SQLite sur le cloud (plan gratuit généreux) — idéal sur Render/Vercel où le disque est éphémère.

```bash
# 1) Créer la base et récupérer les identifiants
turso db create linkhub
turso db show linkhub              # → TURSO_DATABASE_URL (libsql://...)
turso db tokens create linkhub     # → TURSO_AUTH_TOKEN

# 2) Créer le schéma (génère le SQL depuis prisma/schema.prisma et l'applique)
npm run db:sql | turso db shell linkhub
```

Puis définissez ces variables partout où l'app tourne (Render, etc.) :

```
TURSO_DATABASE_URL=libsql://linkhub-<user>.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOiJFZERTQSIs...
```

Tant que `TURSO_DATABASE_URL` n'est pas défini, l'app retombe sur le fichier local — même code, zéro configuration. Pour éviter le throttle sur le plan gratuit de Turso, créez la base **proche de votre hébergement** (ex. région `fra` ou `cdg` pour Render Europe) : `turso db create linkhub --location cdg`.

> Le CLI Prisma ne parle pas à Turso directement : `npm run db:push` vise le fichier local, et `npm run db:sql` régénère le SQL complet à appliquer avec `turso db shell` (ou la console web Turso) après chaque évolution du schéma.

## 4. Déploiement sur Render

| Champ Render | Valeur |
|---|---|
| Runtime | `Node` |
| Build Command | `npm install --include=dev && npx prisma generate && npm run build` |
| Start Command | `node .next/standalone/server.js` |

Variables d'environnement (Environment) :

```
APP_SECRET=<openssl rand -hex 32>
TURSO_DATABASE_URL=libsql://linkhub-<user>.turso.io
TURSO_AUTH_TOKEN=eyJ...
PUBLIC_BASE_URL=https://ton-app.onrender.com   # optionnel mais recommandé
```

Notes :
- **Pas de `DATABASE_URL` ni de `db push` dans le build** : la base est distante (Turso), le build n'y touche pas.
- **Pas de disque persistant à attacher** : les données vivent chez Turso.
- **Ne définissez pas `DISCORD_API_BASE`** en production : c'est la variable du mode démo.
- Le serveur standalone écoute sur `process.env.PORT` (fourni par Render).

## 5. Passer au vrai Discord

1. Dans `.env` (local) : supprimez la ligne `DISCORD_API_BASE=...` puis redémarrez. Sur Render : ne la définissez simplement pas.
2. Sur https://discord.com/developers/applications : créez une application, onglet **OAuth2**, ajoutez l'URI de redirection :

   ```
   https://VOTRE-DOMAINE/api/auth/discord/callback
   ```

   (l'URL exacte à copier est affichée dans l'onglet **Réglages** du site).
3. Renseignez **Client ID** et **Client Secret** dans l'onglet **Réglages** du site (stockés en base), ou dans `.env` (`DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`).
4. Les scopes utilisés : `identify`, `guilds`, `guilds.invites_create`.

## 6. API publique

Générez une clé dans l'onglet **Clé API** du tableau de bord, puis :

```bash
# Liste des serveurs partagés (header X-API-Key prioritaire, sinon ?key=)
curl -H "X-API-Key: VOTRE_CLE" https://VOTRE-DOMAINE/api/v1/guilds

# Bouton « Rejoindre » direct (redirection 302 vers discord.gg)
<a href="https://VOTRE-DOMAINE/api/v1/go/ID_DU_SERVEUR?key=VOTRE_CLE">Rejoindre</a>
```

Réponses JSON avec CORS ouvert, rate-limit intégré, rafraîchissement automatique des invitations expirées côté serveur.

## 7. Notes techniques

- **Protocole derrière proxy** : l'app détecte automatiquement HTTPS (`X-Forwarded-Proto`, domaine `*.space-z.ai`). Proxy exotique → forcez `PUBLIC_BASE_URL`.
- **Cookies** : en HTTPS, session en `SameSite=None; Secure; Partitioned` (compatible aperçu intégré en iframe) ; en HTTP local, `SameSite=Lax`.
- **Caddyfile** : passerelle HTTP incluse (port 81) pour les environnements de prévisualisation routant via `XTransformPort`. Inutile sur Render/VPS.
- **Sauvegarde** : en local, sauvegardez `db/custom.db` ; avec Turso, utilisez `turso db replicate` / les backups de la plateforme.

## 8. Scripts disponibles

| Commande | Effet |
|---|---|
| `npm run dev` | serveur de développement (port 3000) |
| `npm run build` | build standalone (statique + public copiés) |
| `node .next/standalone/server.js` | lancement production |
| `npm run db:push` | applique le schéma à la base SQLite locale |
| `npm run db:sql` | génère le SQL complet du schéma (à appliquer à Turso) |
| `npm run db:generate` | régénère le client Prisma |
| `npm run lint` | ESLint |
| `bun mini-services/mock-discord/index.ts` | Discord simulé (port 3030) |
