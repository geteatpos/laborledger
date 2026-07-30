-- AlterTable
ALTER TABLE "mechanic_order_parts" ADD COLUMN     "identifiedAt" TIMESTAMP(3),
ADD COLUMN     "identifiedName" TEXT,
ADD COLUMN     "identifiedPartNumber" TEXT;
