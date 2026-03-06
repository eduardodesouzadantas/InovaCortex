-- CreateTable
CREATE TABLE "marketing_plans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "platform" TEXT NOT NULL,
    "postType" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "hook" TEXT NOT NULL,
    "cta" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 2,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "marketing_plans_orgId_platform_idx" ON "marketing_plans"("orgId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_plans_orgId_day_key" ON "marketing_plans"("orgId", "day");
