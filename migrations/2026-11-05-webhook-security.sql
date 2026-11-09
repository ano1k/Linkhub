-- Migration LinkHub : heartbeat Discord + securite
-- A appliquer sur une base existante (console Turso ou `turso db shell <base>`).
-- Sans effet sur les donnees existantes.

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

ALTER TABLE "Guild" ADD COLUMN "lastCheckLatencyMs" INTEGER;
ALTER TABLE "Guild" ADD COLUMN "failureCount" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "Guild_discordId_idx" ON "Guild"("discordId");

ALTER TABLE "ApiKey" ADD COLUMN "keyHash" TEXT;
ALTER TABLE "ApiKey" ADD COLUMN "keyPrefix" TEXT;
ALTER TABLE "ApiKey" ADD COLUMN "publicId" TEXT;
ALTER TABLE "ApiKey" ADD COLUMN "lastIp" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_keyHash_key" ON "ApiKey"("keyHash");
CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_publicId_key" ON "ApiKey"("publicId");
