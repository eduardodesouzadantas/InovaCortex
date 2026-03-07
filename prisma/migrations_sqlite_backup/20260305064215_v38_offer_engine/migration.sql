-- CreateTable
CREATE TABLE "offers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "niche" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "offerJson" TEXT NOT NULL,
    "roiModelJson" TEXT NOT NULL,
    "publishedSlug" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "offer_assets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "offerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "offer_assets_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "offers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "offers_publishedSlug_key" ON "offers"("publishedSlug");

-- CreateIndex
CREATE INDEX "offers_organizationId_status_idx" ON "offers"("organizationId", "status");

-- CreateIndex
CREATE INDEX "offer_assets_offerId_type_idx" ON "offer_assets"("offerId", "type");
