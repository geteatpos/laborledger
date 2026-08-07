-- CreateEnum
CREATE TYPE "ChecklistStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'VOIDED');

-- CreateEnum
CREATE TYPE "ChecklistItemStatus" AS ENUM ('OK', 'NEEDS_ATTENTION', 'NA');

-- CreateEnum
CREATE TYPE "ChecklistItemCategory" AS ENUM ('BODY', 'LIGHTS', 'GLASS', 'TIRES', 'BRAKES', 'FLUIDS', 'FILTERS', 'ELECTRICAL');

-- CreateTable
CREATE TABLE "vehicle_inspection_checklists" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "status" "ChecklistStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_inspection_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_inspection_checklist_items" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "labelSnapshot" TEXT NOT NULL,
    "category" "ChecklistItemCategory" NOT NULL,
    "positionOrder" INTEGER NOT NULL,
    "status" "ChecklistItemStatus" NOT NULL DEFAULT 'NA',
    "notes" TEXT,
    "measurementValue" DOUBLE PRECISION,
    "measurementUnit" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_inspection_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_inspection_checklists_workOrderId_key" ON "vehicle_inspection_checklists"("workOrderId");

-- CreateIndex
CREATE INDEX "vehicle_inspection_checklists_work_order_id_idx" ON "vehicle_inspection_checklists"("workOrderId");

-- CreateIndex
CREATE INDEX "vehicle_inspection_checklists_vehicle_id_idx" ON "vehicle_inspection_checklists"("vehicleId");

-- CreateIndex
CREATE INDEX "vehicle_inspection_checklists_company_id_created_at_idx" ON "vehicle_inspection_checklists"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "vehicle_inspection_checklists_group_id_idx" ON "vehicle_inspection_checklists"("groupId");

-- CreateIndex
CREATE INDEX "vehicle_inspection_checklist_items_checklist_id_idx" ON "vehicle_inspection_checklist_items"("checklistId");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_inspection_checklist_items_checklist_id_key_key" ON "vehicle_inspection_checklist_items"("checklistId", "key");

-- AddForeignKey
ALTER TABLE "vehicle_inspection_checklists" ADD CONSTRAINT "vehicle_inspection_checklists_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_inspection_checklists" ADD CONSTRAINT "vehicle_inspection_checklists_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_inspection_checklists" ADD CONSTRAINT "vehicle_inspection_checklists_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_inspection_checklist_items" ADD CONSTRAINT "vehicle_inspection_checklist_items_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "vehicle_inspection_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
