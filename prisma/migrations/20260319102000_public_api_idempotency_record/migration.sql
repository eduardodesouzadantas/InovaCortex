-- CreateTable
CREATE TABLE "public_api_idempotency_records" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "routeKey" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "responseStatus" INTEGER,
    "responseBodyJson" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "errorDetailsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "public_api_idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "public_api_idempotency_records_organizationId_routeKey_idempotencyKey_key" ON "public_api_idempotency_records"("organizationId", "routeKey", "idempotencyKey");

-- CreateIndex
CREATE INDEX "public_api_idempotency_records_organizationId_routeKey_createdAt_idx" ON "public_api_idempotency_records"("organizationId", "routeKey", "createdAt");

-- AddForeignKey
ALTER TABLE "public_api_idempotency_records" ADD CONSTRAINT "public_api_idempotency_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
