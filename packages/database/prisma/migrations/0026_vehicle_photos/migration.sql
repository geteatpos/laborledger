-- CreateEnum
CREATE TYPE "VehiclePhotoCategory" AS ENUM ('RECEPTION', 'EXTERIOR', 'INTERIOR', 'DAMAGE', 'PART');

-- CreateEnum
CREATE TYPE "VehiclePhotoAngle" AS ENUM ('FRONT', 'REAR', 'DRIVER_SIDE', 'PASSENGER_SIDE', 'TOP', 'DETAIL', 'OTHER');

-- CreateTable
CREATE TABLE "vehicle_photos" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "workOrderId" TEXT,
    "uploadedByEmployeeId" TEXT,
    "uploadedByUserId" TEXT,
    "category" "VehiclePhotoCategory" NOT NULL,
    "angle" "VehiclePhotoAngle",
    "filePath" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "widthPx" INTEGER,
    "heightPx" INTEGER,
    "capturedAt" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "caption" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "vehicle_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicle_photos_vehicle_id_deleted_at_idx" ON "vehicle_photos"("vehicleId", "deletedAt");

-- CreateIndex
CREATE INDEX "vehicle_photos_work_order_id_deleted_at_idx" ON "vehicle_photos"("workOrderId", "deletedAt");

-- CreateIndex
CREATE INDEX "vehicle_photos_company_id_uploaded_at_idx" ON "vehicle_photos"("companyId", "uploadedAt");

-- CreateIndex
CREATE INDEX "vehicle_photos_group_id_idx" ON "vehicle_photos"("groupId");

-- AddForeignKey
ALTER TABLE "vehicle_photos" ADD CONSTRAINT "vehicle_photos_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_photos" ADD CONSTRAINT "vehicle_photos_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_photos" ADD CONSTRAINT "vehicle_photos_uploadedByEmployeeId_fkey" FOREIGN KEY ("uploadedByEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_photos" ADD CONSTRAINT "vehicle_photos_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
