-- Migration LinkHub : sessions revocables + verrou des taches planifiees
-- A appliquer sur une base existante (console web Turso ou `turso db shell <base>`).
-- Additive : aucune donnee n'est supprimee.

-- 1. Version de session : incrementee pour deconnecter un utilisateur de partout.
--    Si la colonne existe deja, SQLite renvoie "duplicate column name" : c'est sans gravite.
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- 2. Verrou distribue des taches planifiees (cron de rafraichissement des invitations).
CREATE TABLE IF NOT EXISTS "JobLock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lockedUntil" DATETIME NOT NULL,
    "owner" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- 3. Chiffrement des secrets deja stockes : aucune action SQL.
--    Les valeurs en clair (AppConfig.discordClientSecret, AppConfig.discordBotToken,
--    User.accessToken, User.refreshToken) restent lisibles : elles sont dechiffrees
--    de facon tolerante puis re-chiffrees automatiquement a la premiere lecture,
--    avec la cle derivee de APP_SECRET. Pense a definir APP_SECRET AVANT de deployer
--    cette version : une valeur differente rend les secrets illisibles.
