-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CARD');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'POSTED', 'VOIDED');

-- AlterTable
ALTER TABLE "company_billing_settings" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "company_invoice_sequences" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "employees" ALTER COLUMN "photoUpdatedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "hireDate" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "terminationDate" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "client_invoice_payments" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientInvoiceId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "externalPaymentId" TEXT,
    "externalProvider" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "recordedByUserId" TEXT NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidedByUserId" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_invoice_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_invoice_payments_group_id_idx" ON "client_invoice_payments"("groupId");

-- CreateIndex
CREATE INDEX "client_invoice_payments_company_id_idx" ON "client_invoice_payments"("companyId");

-- CreateIndex
CREATE INDEX "client_invoice_payments_client_invoice_id_idx" ON "client_invoice_payments"("clientInvoiceId");

-- CreateIndex
CREATE INDEX "client_invoice_payments_recorded_by_user_id_idx" ON "client_invoice_payments"("recordedByUserId");

-- CreateIndex
CREATE INDEX "client_invoice_payments_status_idx" ON "client_invoice_payments"("status");

-- AddForeignKey
ALTER TABLE "client_invoice_payments" ADD CONSTRAINT "client_invoice_payments_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoice_payments" ADD CONSTRAINT "client_invoice_payments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoice_payments" ADD CONSTRAINT "client_invoice_payments_clientInvoiceId_fkey" FOREIGN KEY ("clientInvoiceId") REFERENCES "client_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoice_payments" ADD CONSTRAINT "client_invoice_payments_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoice_payments" ADD CONSTRAINT "client_invoice_payments_voidedByUserId_fkey" FOREIGN KEY ("voidedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
