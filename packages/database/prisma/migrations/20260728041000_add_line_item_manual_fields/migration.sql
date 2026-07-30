-- Add LineItemType and LineItemSource enums
CREATE TYPE "LineItemType" AS ENUM ('SERVICE', 'PART', 'REPAIR', 'LABOR', 'FEE', 'DISCOUNT', 'OTHER');

CREATE TYPE "LineItemSource" AS ENUM ('MANUAL', 'WORK_ORDER', 'SERVICE', 'PART', 'IMPORTED');

-- Make workOrderId, workOrderServiceLineId, vehicleId nullable in client_invoice_lines
-- This allows manual line items that are not tied to work orders
ALTER TABLE "client_invoice_lines" ALTER COLUMN "workOrderId" DROP NOT NULL;
ALTER TABLE "client_invoice_lines" ALTER COLUMN "workOrderServiceLineId" DROP NOT NULL;
ALTER TABLE "client_invoice_lines" ALTER COLUMN "vehicleId" DROP NOT NULL;

-- Allow null for snapshot fields that won't apply to manual entries
ALTER TABLE "client_invoice_lines" ALTER COLUMN "workOrderNumberSnapshot" DROP NOT NULL;
ALTER TABLE "client_invoice_lines" ALTER COLUMN "vinSnapshot" DROP NOT NULL;

-- Add new fields for manual line items and tax calculation
ALTER TABLE "client_invoice_lines" ADD COLUMN "lineSubtotalMinor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "client_invoice_lines" ADD COLUMN "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "client_invoice_lines" ADD COLUMN "taxable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "client_invoice_lines" ADD COLUMN "taxAmountMinor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "client_invoice_lines" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "client_invoice_lines" ADD COLUMN "lineItemType" "LineItemType" NOT NULL DEFAULT 'SERVICE';
ALTER TABLE "client_invoice_lines" ADD COLUMN "lineItemSource" "LineItemSource" NOT NULL DEFAULT 'WORK_ORDER';
ALTER TABLE "client_invoice_lines" ADD COLUMN "sourceId" TEXT;

-- Drop the old foreign key constraints and recreate as optional
ALTER TABLE "client_invoice_lines" DROP CONSTRAINT "client_invoice_lines_workOrderId_fkey";
ALTER TABLE "client_invoice_lines" DROP CONSTRAINT "client_invoice_lines_workOrderServiceLineId_fkey";
ALTER TABLE "client_invoice_lines" DROP CONSTRAINT "client_invoice_lines_vehicleId_fkey";

ALTER TABLE "client_invoice_lines" ADD CONSTRAINT "client_invoice_lines_workOrderId_fkey"
  FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "client_invoice_lines" ADD CONSTRAINT "client_invoice_lines_workOrderServiceLineId_fkey"
  FOREIGN KEY ("workOrderServiceLineId") REFERENCES "work_order_service_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "client_invoice_lines" ADD CONSTRAINT "client_invoice_lines_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
