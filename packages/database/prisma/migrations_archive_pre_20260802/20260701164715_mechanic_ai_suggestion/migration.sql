-- CreateTable
CREATE TABLE "mechanic_part_ai_suggestions" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "vin" TEXT NOT NULL,
    "photoId" TEXT,
    "suggestedName" TEXT NOT NULL,
    "suggestedPartNumber" TEXT,
    "confidence" TEXT NOT NULL,
    "rawResponse" TEXT,
    "errorMessage" TEXT,
    "appliedByEmployee" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mechanic_part_ai_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mechanic_part_ai_suggestions_partId_key" ON "mechanic_part_ai_suggestions"("partId");

-- CreateIndex
CREATE INDEX "mechanic_part_ai_suggestions_part_id_idx" ON "mechanic_part_ai_suggestions"("partId");

-- AddForeignKey
ALTER TABLE "mechanic_part_ai_suggestions" ADD CONSTRAINT "mechanic_part_ai_suggestions_partId_fkey" FOREIGN KEY ("partId") REFERENCES "mechanic_order_parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
