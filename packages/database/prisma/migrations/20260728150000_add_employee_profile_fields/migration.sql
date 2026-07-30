-- Add employee profile fields for photo, contact, address, and emergency contact.
-- All fields are nullable to maintain backward compatibility with existing employees.

ALTER TABLE "employees"
  ADD COLUMN "photoUrl" TEXT,
  ADD COLUMN "photoUpdatedAt" TIMESTAMP,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "email" TEXT,
  ADD COLUMN "title" TEXT,
  ADD COLUMN "department" TEXT,
  ADD COLUMN "hireDate" DATE,
  ADD COLUMN "terminationDate" DATE,
  ADD COLUMN "addressLine1" TEXT,
  ADD COLUMN "addressLine2" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "stateOrRegion" TEXT,
  ADD COLUMN "postalCode" TEXT,
  ADD COLUMN "countryCode" TEXT,
  ADD COLUMN "emergencyContactName" TEXT,
  ADD COLUMN "emergencyContactPhone" TEXT,
  ADD COLUMN "emergencyContactRelationship" TEXT;