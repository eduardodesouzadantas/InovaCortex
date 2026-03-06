-- CreateTable
CREATE TABLE "social_integrations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "linkedinStatus" TEXT NOT NULL DEFAULT 'disconnected',
    "instagramStatus" TEXT NOT NULL DEFAULT 'disconnected',
    "metaPageId" TEXT,
    "metaAccessTokenEnc" TEXT,
    "linkedinAccessTokenEnc" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "publication_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "marketingPlanId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "externalPostId" TEXT,
    "scheduledFor" DATETIME,
    "postedAt" DATETIME,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_marketing_plans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "platform" TEXT NOT NULL,
    "postType" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "hook" TEXT NOT NULL,
    "cta" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 2,
    "contentJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduledFor" DATETIME,
    "postedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_marketing_plans" ("contentJson", "createdAt", "cta", "day", "hook", "id", "orgId", "platform", "postType", "priority", "topic") SELECT "contentJson", "createdAt", "cta", "day", "hook", "id", "orgId", "platform", "postType", "priority", "topic" FROM "marketing_plans";
DROP TABLE "marketing_plans";
ALTER TABLE "new_marketing_plans" RENAME TO "marketing_plans";
CREATE INDEX "marketing_plans_orgId_platform_idx" ON "marketing_plans"("orgId", "platform");
CREATE INDEX "marketing_plans_orgId_status_idx" ON "marketing_plans"("orgId", "status");
CREATE UNIQUE INDEX "marketing_plans_orgId_day_key" ON "marketing_plans"("orgId", "day");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "social_integrations_orgId_key" ON "social_integrations"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "publication_logs_marketingPlanId_key" ON "publication_logs"("marketingPlanId");

-- CreateIndex
CREATE INDEX "publication_logs_orgId_status_idx" ON "publication_logs"("orgId", "status");

-- CreateIndex
CREATE INDEX "publication_logs_orgId_platform_idx" ON "publication_logs"("orgId", "platform");
