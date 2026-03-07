-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_assessments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "teamSize" TEXT NOT NULL,
    "volumeDay" TEXT NOT NULL,
    "channels" TEXT NOT NULL,
    "stack" TEXT NOT NULL,
    "pains" TEXT NOT NULL,
    "urgency" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "scoreTotal" INTEGER NOT NULL,
    "scoreBreakdown" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "recommendedMissions" TEXT NOT NULL
);
INSERT INTO "new_assessments" ("channels", "classification", "company", "createdAt", "email", "goal", "id", "name", "pains", "recommendedMissions", "role", "scoreBreakdown", "scoreTotal", "segment", "stack", "teamSize", "urgency", "volumeDay") SELECT "channels", "classification", "company", "createdAt", "email", "goal", "id", "name", "pains", "recommendedMissions", "role", "scoreBreakdown", "scoreTotal", "segment", "stack", "teamSize", "urgency", "volumeDay" FROM "assessments";
DROP TABLE "assessments";
ALTER TABLE "new_assessments" RENAME TO "assessments";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
