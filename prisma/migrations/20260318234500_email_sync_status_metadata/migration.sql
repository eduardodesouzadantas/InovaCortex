ALTER TABLE "email_integrations"
ADD COLUMN IF NOT EXISTS "lastSyncStatus" TEXT,
ADD COLUMN IF NOT EXISTS "lastSyncDurationMs" INTEGER;
