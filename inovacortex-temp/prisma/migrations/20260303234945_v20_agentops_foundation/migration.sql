-- CreateTable
CREATE TABLE "agent_budgets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "dailyTokenLimit" INTEGER NOT NULL DEFAULT 20000,
    "dailyTokenUsed" INTEGER NOT NULL DEFAULT 0,
    "dailyCostUsdUsed" REAL NOT NULL DEFAULT 0.0,
    "resetAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hardStop" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "agent_cache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "outputJson" TEXT NOT NULL,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "costUsd" REAL NOT NULL DEFAULT 0.0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_budgets_orgId_key" ON "agent_budgets"("orgId");

-- CreateIndex
CREATE INDEX "agent_cache_orgId_agentName_idx" ON "agent_cache"("orgId", "agentName");

-- CreateIndex
CREATE INDEX "agent_cache_createdAt_idx" ON "agent_cache"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "agent_cache_orgId_keyHash_key" ON "agent_cache"("orgId", "keyHash");
