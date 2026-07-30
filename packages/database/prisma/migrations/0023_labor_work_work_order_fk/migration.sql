-- Link labor work assignments to work orders and service lines (optional FK for Field My Work).
ALTER TABLE "labor_work_assignments" ADD COLUMN "workOrderId" TEXT;
ALTER TABLE "labor_work_assignments" ADD COLUMN "workOrderServiceLineId" TEXT;

CREATE INDEX "labor_work_assignments_work_order_id_idx" ON "labor_work_assignments"("workOrderId");
CREATE INDEX "labor_work_assignments_work_order_service_line_id_idx" ON "labor_work_assignments"("workOrderServiceLineId");

ALTER TABLE "labor_work_assignments" ADD CONSTRAINT "labor_work_assignments_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "labor_work_assignments" ADD CONSTRAINT "labor_work_assignments_workOrderServiceLineId_fkey" FOREIGN KEY ("workOrderServiceLineId") REFERENCES "work_order_service_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
