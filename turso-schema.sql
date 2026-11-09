-- Schema complet LinkHub (SQLite / Turso)
-- Base neuve : colle ce fichier dans la console Turso (ou `turso db shell <base>`).
-- Base existante : applique plutot migrations/2026-11-05-webhook-security.sql

CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "globalName" TEXT,
    "avatar" TEXT,
    "email" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" DATETIME,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "JobLock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lockedUntil" DATETIME NOT NULL,
    "owner" TEXT,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "AppConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'main',
    "discordClientId" TEXT,
    "discordClientSecret" TEXT,
    "discordBotToken" TEXT,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "SiteSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'main',
    "siteName" TEXT,
    "webhookUrl" TEXT,
    "webhookEnabled" BOOLEAN NOT NULL DEFAULT false,
    "webhookIntervalMinutes" INTEGER NOT NULL DEFAULT 5,
    "webhookMention" TEXT,
    "webhookMessage" TEXT,
    "webhookIncludeStats" BOOLEAN NOT NULL DEFAULT true,
    "webhookLastSentAt" DATETIME,
    "webhookLastStatus" TEXT,
    "webhookLastLatencyMs" INTEGER,
    "webhookLastHttpStatus" INTEGER,
    "webhookLastError" TEXT,
    "webhookSuccessCount" INTEGER NOT NULL DEFAULT 0,
    "webhookFailureCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "WebhookDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "httpStatus" INTEGER,
    "latencyMs" INTEGER,
    "siteStatus" TEXT,
    "siteLatencyMs" INTEGER,
    "error" TEXT,
    "trigger" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "WebhookDelivery_createdAt_idx" ON "WebhookDelivery"("createdAt");

CREATE TABLE IF NOT EXISTS "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT,
    "actorName" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

CREATE TABLE IF NOT EXISTS "Guild" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "discordId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "channelId" TEXT,
    "channelName" TEXT,
    "ownerId" TEXT NOT NULL,
    "memberCount" INTEGER,
    "onlineCount" INTEGER,
    "lastCheckAt" DATETIME,
    "lastCheckStatus" TEXT,
    "lastCheckMsg" TEXT,
    "lastCheckLatencyMs" INTEGER,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Guild_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Guild_discordId_ownerId_key" ON "Guild"("discordId", "ownerId");
CREATE INDEX IF NOT EXISTS "Guild_discordId_idx" ON "Guild"("discordId");

CREATE TABLE IF NOT EXISTS "Invite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "maxAge" INTEGER NOT NULL DEFAULT 0,
    "maxUses" INTEGER NOT NULL DEFAULT 0,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invite_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Invite_guildId_key" ON "Invite"("guildId");

CREATE TABLE IF NOT EXISTS "ClickStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "discordId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "ClickStat_discordId_day_key" ON "ClickStat"("discordId", "day");
CREATE INDEX IF NOT EXISTS "ClickStat_discordId_day_idx" ON "ClickStat"("discordId", "day");

CREATE TABLE IF NOT EXISTS "ApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "keyHash" TEXT,
    "keyPrefix" TEXT,
    "publicId" TEXT,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastUsedAt" DATETIME,
    "lastIp" TEXT,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_key_key" ON "ApiKey"("key");
CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_keyHash_key" ON "ApiKey"("keyHash");
CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_publicId_key" ON "ApiKey"("publicId");
