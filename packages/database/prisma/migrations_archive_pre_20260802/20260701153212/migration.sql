-- CreateEnum
CREATE TYPE "MechanicOrderApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WorkOrderStatus" ADD VALUE 'PENDING_MECHANIC_APPROVAL';
ALTER TYPE "WorkOrderStatus" ADD VALUE 'MECHANIC_REJECTED';

-- DropIndex
DROP INDEX "groups_status_idx";

-- CreateTable
CREATE TABLE "mechanic_order_parts" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "photoId" TEXT,
    "positionOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mechanic_order_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mechanic_order_approvals" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "supervisorId" TEXT,
    "status" "MechanicOrderApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "contactMethod" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mechanic_order_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "in_app_notifications" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "recipientType" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "referenceId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "in_app_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mechanic_order_parts_work_order_id_idx" ON "mechanic_order_parts"("workOrderId");

-- CreateIndex
CREATE INDEX "mechanic_order_parts_company_id_idx" ON "mechanic_order_parts"("companyId");

-- CreateIndex
CREATE INDEX "mechanic_order_parts_group_id_idx" ON "mechanic_order_parts"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "mechanic_order_approvals_workOrderId_key" ON "mechanic_order_approvals"("workOrderId");

-- CreateIndex
CREATE INDEX "mechanic_order_approvals_work_order_id_idx" ON "mechanic_order_approvals"("workOrderId");

-- CreateIndex
CREATE INDEX "mechanic_order_approvals_company_id_idx" ON "mechanic_order_approvals"("companyId");

-- CreateIndex
CREATE INDEX "mechanic_order_approvals_group_id_idx" ON "mechanic_order_approvals"("groupId");

-- CreateIndex
CREATE INDEX "in_app_notifications_recipient_id_read_at_idx" ON "in_app_notifications"("recipientId", "readAt");

-- CreateIndex
CREATE INDEX "in_app_notifications_company_id_created_at_idx" ON "in_app_notifications"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "in_app_notifications_group_id_idx" ON "in_app_notifications"("groupId");

-- RenameForeignKey
ALTER TABLE "password_reset_tokens" RENAME CONSTRAINT "password_reset_tokens_user_id_fkey" TO "password_reset_tokens_userId_fkey";

-- AddForeignKey
ALTER TABLE "mechanic_order_parts" ADD CONSTRAINT "mechanic_order_parts_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mechanic_order_parts" ADD CONSTRAINT "mechanic_order_parts_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "vehicle_photos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mechanic_order_approvals" ADD CONSTRAINT "mechanic_order_approvals_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mechanic_order_approvals" ADD CONSTRAINT "mechanic_order_approvals_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "field_sites_location_id_key" RENAME TO "field_sites_locationId_key";

-- RenameIndex
ALTER INDEX "kiosk_credentials_kiosk_id_key" RENAME TO "kiosk_credentials_kioskId_key";

-- RenameIndex
ALTER INDEX "kiosks_location_id_key" RENAME TO "kiosks_locationId_key";

-- RenameIndex
ALTER INDEX "password_reset_tokens_token_hash_key" RENAME TO "password_reset_tokens_tokenHash_key";

-- RenameIndex
ALTER INDEX "punch_events_idempotency_key_key" RENAME TO "punch_events_idempotencyKey_key";

-- RenameIndex
ALTER INDEX "worker_scan_events_idempotency_key_key" RENAME TO "worker_scan_events_idempotencyKey_key";
