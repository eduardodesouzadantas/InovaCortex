-- Allow OAuth tokens to be cleared on disconnect while preserving account metadata.
ALTER TABLE "email_integrations"
ALTER COLUMN "accessTokenEncrypted" DROP NOT NULL,
ALTER COLUMN "refreshTokenEncrypted" DROP NOT NULL;

