-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_system_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "payloadJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_system_events" ("createdAt", "entityId", "entityType", "id", "organizationId", "payloadJson", "type") SELECT "createdAt", "entityId", "entityType", "id", "organizationId", "payloadJson", "type" FROM "system_events";
DROP TABLE "system_events";
ALTER TABLE "new_system_events" RENAME TO "system_events";
CREATE INDEX "system_events_organizationId_createdAt_idx" ON "system_events"("organizationId", "createdAt");
CREATE INDEX "system_events_organizationId_type_idx" ON "system_events"("organizationId", "type");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
