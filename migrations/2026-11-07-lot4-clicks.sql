-- Migration LinkHub : compteur de clics par serveur et par jour
-- Additive et idempotente : aucune donnee supprimee, rejouable sans risque.
--
-- A appliquer sur une base existante, au choix :
--   1. en une commande (nom de la base SANS chevrons ni guillemets) :
--        turso db shell NOM-DE-TA-BASE < migrations/2026-11-07-lot4-clicks.sql
--   2. dans la console web Turso, qui n'execute qu'UNE instruction a la fois :
--        colle le bloc CREATE TABLE ci-dessous, seul, sans les commentaires.

CREATE TABLE IF NOT EXISTS "ClickStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "discordId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClickStat_discordId_day_key" UNIQUE ("discordId", "day")
);

-- Verification : doit renvoyer "ClickStat".
--   SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'ClickStat';
