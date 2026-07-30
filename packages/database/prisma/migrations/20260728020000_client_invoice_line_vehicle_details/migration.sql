-- Snapshot make, plate, and color on invoice lines for customer-facing detail.

ALTER TABLE "client_invoice_lines"
  ADD COLUMN "makeSnapshot" TEXT,
  ADD COLUMN "plateSnapshot" TEXT,
  ADD COLUMN "colorSnapshot" TEXT;
