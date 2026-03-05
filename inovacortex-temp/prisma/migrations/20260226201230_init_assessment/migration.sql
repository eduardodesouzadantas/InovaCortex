-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "teamSize" TEXT NOT NULL,
    "volumeDay" TEXT NOT NULL,
    "channels" JSONB NOT NULL,
    "stack" JSONB NOT NULL,
    "pains" JSONB NOT NULL,
    "urgency" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "scoreTotal" INTEGER NOT NULL,
    "scoreBreakdown" JSONB NOT NULL,
    "classification" TEXT NOT NULL,
    "recommendedMissions" JSONB NOT NULL
);
