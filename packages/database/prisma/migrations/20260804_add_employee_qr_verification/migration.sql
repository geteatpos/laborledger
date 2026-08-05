-- CreateEnum
CREATE TYPE "EmployeeVerificationScanOutcome" AS ENUM ('VALID', 'INACTIVE', 'REVOKED', 'NOT_FOUND');

-- CreateTable
CREATE TABLE "employee_verification_tokens" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenHashPrefix" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" TEXT,
    "revocationReason" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_verification_scan_events" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT,
    "employeeId" TEXT,
    "companyId" TEXT,
    "outcome" "EmployeeVerificationScanOutcome" NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_verification_scan_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_verification_tokens_group_id_idx" ON "employee_verification_tokens"("groupId");

-- CreateIndex
CREATE INDEX "employee_verification_tokens_company_id_idx" ON "employee_verification_tokens"("companyId");

-- CreateIndex
CREATE INDEX "employee_verification_tokens_employee_id_idx" ON "employee_verification_tokens"("employeeId");

-- CreateIndex
CREATE INDEX "employee_verification_tokens_token_hash_prefix_idx" ON "employee_verification_tokens"("tokenHashPrefix");

-- CreateIndex
CREATE INDEX "employee_verification_tokens_revoked_at_idx" ON "employee_verification_tokens"("revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "employee_verification_tokens_token_hash_key" ON "employee_verification_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "employee_verification_scan_events_token_id_idx" ON "employee_verification_scan_events"("tokenId");

-- CreateIndex
CREATE INDEX "employee_verification_scan_events_employee_id_idx" ON "employee_verification_scan_events"("employeeId");

-- CreateIndex
CREATE INDEX "employee_verification_scan_events_company_id_idx" ON "employee_verification_scan_events"("companyId");

-- CreateIndex
CREATE INDEX "employee_verification_scan_events_created_at_idx" ON "employee_verification_scan_events"("createdAt");

-- AddForeignKey
ALTER TABLE "employee_verification_tokens" ADD CONSTRAINT "employee_verification_tokens_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_verification_tokens" ADD CONSTRAINT "employee_verification_tokens_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_verification_tokens" ADD CONSTRAINT "employee_verification_tokens_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_verification_tokens" ADD CONSTRAINT "employee_verification_tokens_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_verification_tokens" ADD CONSTRAINT "employee_verification_tokens_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_verification_scan_events" ADD CONSTRAINT "employee_verification_scan_events_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "employee_verification_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_verification_scan_events" ADD CONSTRAINT "employee_verification_scan_events_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_verification_scan_events" ADD CONSTRAINT "employee_verification_scan_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

