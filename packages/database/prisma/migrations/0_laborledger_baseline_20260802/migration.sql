-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "GlobalRole" AS ENUM ('NONE', 'PLATFORM_SUPERADMIN');

-- CreateEnum
CREATE TYPE "GroupRole" AS ENUM ('GROUP_OWNER');

-- CreateEnum
CREATE TYPE "GroupStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CompanyRole" AS ENUM ('COMPANY_ADMIN', 'SUPERVISOR');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "InvitationKind" AS ENUM ('ONBOARDING', 'COMPANY_ADMIN_ACCESS');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('SCHEDULED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShiftBatchType" AS ENUM ('RECURRING_TEMPLATE', 'COPY_WEEK');

-- CreateEnum
CREATE TYPE "PunchAction" AS ENUM ('CLOCK_IN', 'BREAK_START', 'BREAK_END', 'CLOCK_OUT');

-- CreateEnum
CREATE TYPE "CorrectionType" AS ENUM ('MISSING_CLOCK_OUT', 'OPEN_BREAK_END', 'INCORRECT_CLOCK_IN', 'INCORRECT_CLOCK_OUT', 'INCORRECT_BREAK_START', 'INCORRECT_BREAK_END');

-- CreateEnum
CREATE TYPE "CorrectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'APPLIED');

-- CreateEnum
CREATE TYPE "WeeklyPeriodStatus" AS ENUM ('OPEN', 'CLOSED', 'REOPENED');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('DRAFT', 'READY', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'INVOICED', 'CANCELLED', 'PENDING_MECHANIC_APPROVAL', 'MECHANIC_REJECTED');

-- CreateEnum
CREATE TYPE "ClientInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'VOID');

-- CreateEnum
CREATE TYPE "ClientInvoiceDeliveryStatus" AS ENUM ('SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CARD');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'POSTED', 'VOIDED');

-- CreateEnum
CREATE TYPE "LineItemType" AS ENUM ('SERVICE', 'PART', 'REPAIR', 'LABOR', 'FEE', 'DISCOUNT', 'OTHER');

-- CreateEnum
CREATE TYPE "LineItemSource" AS ENUM ('MANUAL', 'WORK_ORDER', 'SERVICE', 'PART', 'IMPORTED');

-- CreateEnum
CREATE TYPE "LaborBillingDraftStatus" AS ENUM ('DRAFT', 'LOCKED', 'VOIDED');

-- CreateEnum
CREATE TYPE "LaborWorkAssignmentStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LaborWorkProgressStatus" AS ENUM ('STARTED', 'PREP_IN_PROGRESS', 'WASH_IN_PROGRESS', 'ALMOST_DONE', 'COMPLETED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ChecklistStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'VOIDED');

-- CreateEnum
CREATE TYPE "ChecklistItemStatus" AS ENUM ('OK', 'NEEDS_ATTENTION', 'NA');

-- CreateEnum
CREATE TYPE "ChecklistItemCategory" AS ENUM ('BODY', 'LIGHTS', 'GLASS', 'TIRES', 'BRAKES', 'FLUIDS', 'FILTERS', 'ELECTRICAL');

-- CreateEnum
CREATE TYPE "VehiclePhotoCategory" AS ENUM ('RECEPTION', 'EXTERIOR', 'INTERIOR', 'DAMAGE', 'PART');

-- CreateEnum
CREATE TYPE "VehiclePhotoAngle" AS ENUM ('FRONT', 'REAR', 'DRIVER_SIDE', 'PASSENGER_SIDE', 'TOP', 'DETAIL', 'OTHER');

-- CreateEnum
CREATE TYPE "MechanicOrderApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MobileDeviceStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "MobileEnrollmentTokenStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MobileAuthAuditAction" AS ENUM ('ENROLLMENT_TOKEN_CREATED', 'ENROLLMENT_TOKEN_CONSUMED', 'ENROLLMENT_TOKEN_FAILED', 'DEVICE_ENROLLED', 'DEVICE_REVOKED', 'DEVICE_REACTIVATED', 'BADGE_REGISTERED', 'BADGE_REVOKED', 'LOGIN_SUCCEEDED', 'LOGIN_FAILED', 'LOGOUT', 'SESSION_REVOKED', 'SESSION_EXPIRED', 'BADGE_LOCKED', 'BADGE_EXPIRED', 'RATE_LIMIT_LOCKOUT');

-- CreateEnum
CREATE TYPE "MobileAuthAuditOutcome" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateEnum
CREATE TYPE "MobileAuthRateLimitScope" AS ENUM ('DEVICE_ENROLLMENT', 'LOGIN', 'LOGOUT', 'SESSION_ME', 'ADMIN_REVOKE', 'BADGE_PROVISIONING');

-- CreateTable
CREATE TABLE "groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "GroupStatus" NOT NULL DEFAULT 'ACTIVE',
    "suspendedAt" TIMESTAMP(3),
    "suspendedByUserId" TEXT,
    "suspendedReason" TEXT,
    "archivedAt" TIMESTAMP(3),
    "archivedByUserId" TEXT,
    "archivedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "legalName" TEXT,
    "phone" TEXT,
    "billingEmail" TEXT,
    "primaryContactName" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "stateRegion" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT,
    "globalRole" "GlobalRole" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "activeCompanyId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_memberships" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "role" "GroupRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'INVITED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_memberships" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "role" "CompanyRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'INVITED',
    "locationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "invitedEmail" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "kind" "InvitationKind" NOT NULL DEFAULT 'ONBOARDING',
    "createdByUserId" TEXT NOT NULL,
    "userId" TEXT,
    "groupId" TEXT,
    "companyId" TEXT,
    "groupMembershipId" TEXT,
    "companyMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requesterIp" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "groupId" TEXT,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_clients" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "taxId" TEXT,
    "billingContactName" TEXT,
    "phone" TEXT,
    "billingEmail" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "stateRegion" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "serviceClientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_client_locations" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "serviceClientId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_client_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "photoUrl" TEXT,
    "photoUpdatedAt" TIMESTAMP(3),
    "phone" TEXT,
    "email" TEXT,
    "title" TEXT,
    "department" TEXT,
    "hireDate" TIMESTAMP(3),
    "terminationDate" TIMESTAMP(3),
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "stateOrRegion" TEXT,
    "postalCode" TEXT,
    "countryCode" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "emergencyContactRelationship" TEXT,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_pin_credentials" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_pin_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_rates" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "rateMinorUnits" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "effectiveStart" TIMESTAMP(3) NOT NULL,
    "effectiveEnd" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_labor_rates" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "serviceClientId" TEXT,
    "locationId" TEXT,
    "rateMinorUnits" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "effectiveStart" TIMESTAMP(3) NOT NULL,
    "effectiveEnd" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_labor_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supervisor_location_assignments" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "supervisorUserId" TEXT NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),

    CONSTRAINT "supervisor_location_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_templates" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "serviceClientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "daysOfWeek" INTEGER[],
    "localStartTime" TEXT NOT NULL,
    "localEndTime" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "startsOnDate" TIMESTAMP(3) NOT NULL,
    "endsOnDate" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_generation_batches" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "operationType" "ShiftBatchType" NOT NULL,
    "operationKey" TEXT NOT NULL,
    "sourceTemplateId" TEXT,
    "sourceWeekStartUtc" TIMESTAMP(3),
    "targetWeekStartUtc" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_generation_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "serviceClientId" TEXT NOT NULL,
    "status" "ShiftStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledStartUtc" TIMESTAMP(3) NOT NULL,
    "scheduledEndUtc" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByUserId" TEXT,
    "cancelReason" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "additionalTimeApprovedAt" TIMESTAMP(3),
    "additionalTimeApprovedByUserId" TEXT,
    "generationBatchId" TEXT,
    "planningKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kiosks" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kiosks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kiosk_credentials" (
    "id" TEXT NOT NULL,
    "kioskId" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "kiosk_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_sites" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "displayName" TEXT,
    "ready" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "punch_events" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "kioskId" TEXT NOT NULL,
    "action" "PunchAction" NOT NULL,
    "eventUtc" TIMESTAMP(3) NOT NULL,
    "serverReceivedUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" TEXT NOT NULL,
    "deviceEventId" TEXT,
    "deviceTimestamp" TIMESTAMP(3),
    "sequence" INTEGER,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "isEarly" BOOLEAN NOT NULL DEFAULT false,
    "breakMinutes" INTEGER,

    CONSTRAINT "punch_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correction_requests" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "type" "CorrectionType" NOT NULL,
    "status" "CorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "originalPayload" JSONB NOT NULL,
    "proposedPayload" JSONB NOT NULL,
    "finalPayload" JSONB,
    "requestedByUserId" TEXT,
    "requestedByEmployeeId" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewReason" TEXT,
    "appliedAt" TIMESTAMP(3),
    "appliedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "correction_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "punch_corrections" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "correctionRequestId" TEXT NOT NULL,
    "targetPunchEventId" TEXT,
    "action" "PunchAction" NOT NULL,
    "eventUtc" TIMESTAMP(3) NOT NULL,
    "breakMinutes" INTEGER,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "isEarly" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedByUserId" TEXT NOT NULL,

    CONSTRAINT "punch_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_periods" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "weekStartLocalDate" TEXT NOT NULL,
    "weekEndLocalDate" TEXT NOT NULL,
    "closeTimeZone" TEXT NOT NULL,
    "targetPayDate" TEXT NOT NULL,
    "status" "WeeklyPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenedByUserId" TEXT,
    "reopenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_close_snapshots" (
    "id" TEXT NOT NULL,
    "weeklyPeriodId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshotPayload" JSONB NOT NULL,
    "approvedShiftCount" INTEGER NOT NULL,
    "payableMinutes" INTEGER NOT NULL,
    "employeeGrossEstimateMinor" INTEGER NOT NULL,
    "clientLaborEstimateMinor" INTEGER NOT NULL,
    "grossMarginEstimateMinor" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT NOT NULL,

    CONSTRAINT "weekly_close_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_catalog_items" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "fixedPriceMinor" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "serviceClientId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "vin" TEXT NOT NULL,
    "plate" TEXT,
    "color" TEXT,
    "mileage" INTEGER,
    "notes" TEXT,
    "year" INTEGER,
    "make" TEXT,
    "model" TEXT,
    "trim" TEXT,
    "bodyClass" TEXT,
    "vehicleType" TEXT,
    "fuelType" TEXT,
    "decodedAt" TIMESTAMP(3),
    "decodeSource" TEXT,
    "decodePayload" JSONB,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "serviceClientId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "workOrderNumber" TEXT NOT NULL,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "invoicedClientInvoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_service_lines" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "serviceCatalogItemId" TEXT NOT NULL,
    "serviceNameSnapshot" TEXT NOT NULL,
    "serviceCategorySnapshot" TEXT,
    "unitPriceMinor" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "lineTotalMinor" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_order_service_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_status_history" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "fromStatus" "WorkOrderStatus",
    "toStatus" "WorkOrderStatus" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT NOT NULL,

    CONSTRAINT "work_order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_assignments" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "workOrderServiceLineId" TEXT,
    "employeeId" TEXT NOT NULL,
    "roleLabel" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedByUserId" TEXT,
    "unassignedAt" TIMESTAMP(3),
    "unassignedByUserId" TEXT,
    "unassignReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_order_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_responsibility_logs" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "employeeId" TEXT,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB,

    CONSTRAINT "vehicle_responsibility_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worker_scan_events" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "workOrderAssignmentId" TEXT,
    "employeeId" TEXT NOT NULL,
    "enteredVin" TEXT NOT NULL,
    "matchedVin" BOOLEAN NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "deviceLabel" TEXT,
    "idempotencyKey" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_scan_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_completions" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "workOrderServiceLineId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workOrderAssignmentId" TEXT,
    "workerScanEventId" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedBySource" TEXT NOT NULL DEFAULT 'worker',
    "notes" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedByUserId" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_invoices" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "serviceClientId" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "status" "ClientInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotalMinor" INTEGER NOT NULL,
    "taxMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "dueDate" TIMESTAMP(3),
    "paymentTermsDays" INTEGER,
    "issuerSnapshot" JSONB,
    "billToSnapshot" JSONB,
    "amountPaidMinor" INTEGER NOT NULL DEFAULT 0,
    "balanceMinor" INTEGER NOT NULL DEFAULT 0,
    "issuedAt" TIMESTAMP(3),
    "issuedByUserId" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedByUserId" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_billing_settings" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
    "defaultNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_billing_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_invoice_sequences" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sequenceKey" TEXT NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_invoice_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_invoice_lines" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientInvoiceId" TEXT NOT NULL,
    "workOrderId" TEXT,
    "workOrderServiceLineId" TEXT,
    "vehicleId" TEXT,
    "workOrderNumberSnapshot" TEXT,
    "vinSnapshot" TEXT,
    "makeSnapshot" TEXT,
    "plateSnapshot" TEXT,
    "colorSnapshot" TEXT,
    "vehicleLabelSnapshot" TEXT,
    "serviceNameSnapshot" TEXT NOT NULL,
    "serviceCategorySnapshot" TEXT,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceMinor" INTEGER NOT NULL,
    "lineSubtotalMinor" INTEGER NOT NULL DEFAULT 0,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxable" BOOLEAN NOT NULL DEFAULT false,
    "taxAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "lineTotalMinor" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "lineItemType" "LineItemType" NOT NULL DEFAULT 'SERVICE',
    "lineItemSource" "LineItemSource" NOT NULL DEFAULT 'WORK_ORDER',
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_invoice_deliveries" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientInvoiceId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "recipientEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "ClientInvoiceDeliveryStatus" NOT NULL,
    "provider" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "messageNote" TEXT,
    "sentAt" TIMESTAMP(3),
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_invoice_deliveries_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "labor_billing_drafts" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "locationId" TEXT,
    "periodStart" TEXT NOT NULL,
    "periodEnd" TEXT NOT NULL,
    "status" "LaborBillingDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "previewSnapshot" JSONB NOT NULL,
    "payrollCsvSnapshot" TEXT,
    "clientBillingCsvSnapshot" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labor_billing_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labor_work_assignments" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "serviceClientId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "serviceCatalogItemId" TEXT,
    "vehicleId" TEXT,
    "vinSnapshot" TEXT,
    "workOrderId" TEXT,
    "workOrderServiceLineId" TEXT,
    "employeeNameSnapshot" TEXT NOT NULL,
    "clientNameSnapshot" TEXT NOT NULL,
    "locationNameSnapshot" TEXT NOT NULL,
    "addressSnapshot" TEXT NOT NULL,
    "serviceNameSnapshot" TEXT NOT NULL,
    "status" "LaborWorkAssignmentStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "progressStatus" "LaborWorkProgressStatus",
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "blockedAt" TIMESTAMP(3),
    "referencePrepStartedAt" TIMESTAMP(3),
    "referencePrepCompletedAt" TIMESTAMP(3),
    "referenceWashStartedAt" TIMESTAMP(3),
    "referenceWashCompletedAt" TIMESTAMP(3),
    "referenceServiceMinutes" INTEGER,
    "referencePrepMinutes" INTEGER,
    "referenceWashMinutes" INTEGER,
    "notes" TEXT,
    "blockedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labor_work_assignments_pkey" PRIMARY KEY ("id")
);

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
    "identifiedName" TEXT,
    "identifiedPartNumber" TEXT,
    "identifiedAt" TIMESTAMP(3),
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

-- CreateTable
CREATE TABLE "mobile_devices" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "androidIdHash" TEXT NOT NULL,
    "androidIdHashPrefix" TEXT,
    "label" TEXT,
    "status" "MobileDeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enrolledByUserId" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" TEXT,
    "revocationReason" TEXT,
    "reactivatedAt" TIMESTAMP(3),
    "reactivatedByUserId" TEXT,
    "reactivationReason" TEXT,
    "replacementForDeviceId" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mobile_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mobile_enrollment_tokens" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenHashPrefix" TEXT,
    "deviceLabel" TEXT,
    "status" "MobileEnrollmentTokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "consumedByDeviceId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" TEXT,
    "revocationReason" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mobile_enrollment_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mobile_sessions" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenHashPrefix" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "logoutAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" TEXT,
    "revocationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mobile_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_badge_credentials" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "deviceId" TEXT,
    "badgeUidHash" TEXT NOT NULL,
    "badgeUidHashPrefix" TEXT,
    "label" TEXT,
    "lockedUntil" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" TEXT,
    "revocationReason" TEXT,
    "provisionedByUserId" TEXT NOT NULL,
    "provisionedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_badge_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mobile_auth_audit_events" (
    "id" TEXT NOT NULL,
    "groupId" TEXT,
    "companyId" TEXT,
    "locationId" TEXT,
    "actorUserId" TEXT,
    "employeeId" TEXT,
    "deviceId" TEXT,
    "sessionId" TEXT,
    "enrollmentTokenId" TEXT,
    "badgeCredentialId" TEXT,
    "action" "MobileAuthAuditAction" NOT NULL,
    "outcome" "MobileAuthAuditOutcome" NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mobile_auth_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mobile_auth_rate_limits" (
    "id" TEXT NOT NULL,
    "groupId" TEXT,
    "companyId" TEXT,
    "locationId" TEXT,
    "scope" "MobileAuthRateLimitScope" NOT NULL,
    "identifierHash" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mobile_auth_rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "companies_group_id_idx" ON "companies"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "companies_group_id_name_key" ON "companies"("groupId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "sessions_active_company_id_idx" ON "sessions"("activeCompanyId");

-- CreateIndex
CREATE INDEX "group_memberships_group_id_idx" ON "group_memberships"("groupId");

-- CreateIndex
CREATE INDEX "group_memberships_user_id_idx" ON "group_memberships"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "group_memberships_group_id_email_key" ON "group_memberships"("groupId", "email");

-- CreateIndex
CREATE INDEX "company_memberships_company_id_idx" ON "company_memberships"("companyId");

-- CreateIndex
CREATE INDEX "company_memberships_user_id_idx" ON "company_memberships"("userId");

-- CreateIndex
CREATE INDEX "company_memberships_location_id_idx" ON "company_memberships"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "company_memberships_company_id_email_key" ON "company_memberships"("companyId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_tokenHash_key" ON "invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "invitations_invited_email_idx" ON "invitations"("invitedEmail");

-- CreateIndex
CREATE INDEX "invitations_expires_at_idx" ON "invitations"("expiresAt");

-- CreateIndex
CREATE INDEX "invitations_company_id_idx" ON "invitations"("companyId");

-- CreateIndex
CREATE INDEX "invitations_kind_idx" ON "invitations"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "audit_events_actor_user_id_idx" ON "audit_events"("actorUserId");

-- CreateIndex
CREATE INDEX "audit_events_group_id_idx" ON "audit_events"("groupId");

-- CreateIndex
CREATE INDEX "audit_events_company_id_idx" ON "audit_events"("companyId");

-- CreateIndex
CREATE INDEX "audit_events_created_at_idx" ON "audit_events"("createdAt");

-- CreateIndex
CREATE INDEX "service_clients_group_id_idx" ON "service_clients"("groupId");

-- CreateIndex
CREATE INDEX "service_clients_company_id_idx" ON "service_clients"("companyId");

-- CreateIndex
CREATE INDEX "service_clients_archived_at_idx" ON "service_clients"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "service_clients_company_id_name_key" ON "service_clients"("companyId", "name");

-- CreateIndex
CREATE INDEX "locations_group_id_idx" ON "locations"("groupId");

-- CreateIndex
CREATE INDEX "locations_company_id_idx" ON "locations"("companyId");

-- CreateIndex
CREATE INDEX "locations_service_client_id_idx" ON "locations"("serviceClientId");

-- CreateIndex
CREATE INDEX "locations_archived_at_idx" ON "locations"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "locations_company_id_name_key" ON "locations"("companyId", "name");

-- CreateIndex
CREATE INDEX "service_client_locations_group_id_idx" ON "service_client_locations"("groupId");

-- CreateIndex
CREATE INDEX "service_client_locations_company_id_idx" ON "service_client_locations"("companyId");

-- CreateIndex
CREATE INDEX "service_client_locations_service_client_id_idx" ON "service_client_locations"("serviceClientId");

-- CreateIndex
CREATE INDEX "service_client_locations_location_id_idx" ON "service_client_locations"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "service_client_locations_client_location_key" ON "service_client_locations"("serviceClientId", "locationId");

-- CreateIndex
CREATE INDEX "employees_group_id_idx" ON "employees"("groupId");

-- CreateIndex
CREATE INDEX "employees_company_id_idx" ON "employees"("companyId");

-- CreateIndex
CREATE INDEX "employees_archived_at_idx" ON "employees"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "employees_company_id_full_name_key" ON "employees"("companyId", "fullName");

-- CreateIndex
CREATE INDEX "employee_pin_credentials_employee_id_idx" ON "employee_pin_credentials"("employeeId");

-- CreateIndex
CREATE INDEX "employee_pin_credentials_company_id_idx" ON "employee_pin_credentials"("companyId");

-- CreateIndex
CREATE INDEX "employee_pin_credentials_revoked_at_idx" ON "employee_pin_credentials"("revokedAt");

-- CreateIndex
CREATE INDEX "employee_rates_employee_id_idx" ON "employee_rates"("employeeId");

-- CreateIndex
CREATE INDEX "employee_rates_company_id_idx" ON "employee_rates"("companyId");

-- CreateIndex
CREATE INDEX "employee_rates_effective_start_idx" ON "employee_rates"("effectiveStart");

-- CreateIndex
CREATE INDEX "client_labor_rates_company_id_idx" ON "client_labor_rates"("companyId");

-- CreateIndex
CREATE INDEX "client_labor_rates_service_client_id_idx" ON "client_labor_rates"("serviceClientId");

-- CreateIndex
CREATE INDEX "client_labor_rates_location_id_idx" ON "client_labor_rates"("locationId");

-- CreateIndex
CREATE INDEX "client_labor_rates_effective_start_idx" ON "client_labor_rates"("effectiveStart");

-- CreateIndex
CREATE INDEX "supervisor_location_assignments_group_id_idx" ON "supervisor_location_assignments"("groupId");

-- CreateIndex
CREATE INDEX "supervisor_location_assignments_company_id_idx" ON "supervisor_location_assignments"("companyId");

-- CreateIndex
CREATE INDEX "supervisor_location_assignments_location_id_idx" ON "supervisor_location_assignments"("locationId");

-- CreateIndex
CREATE INDEX "supervisor_location_assignments_supervisor_user_id_idx" ON "supervisor_location_assignments"("supervisorUserId");

-- CreateIndex
CREATE INDEX "supervisor_location_assignments_unassigned_at_idx" ON "supervisor_location_assignments"("unassignedAt");

-- CreateIndex
CREATE INDEX "schedule_templates_group_id_idx" ON "schedule_templates"("groupId");

-- CreateIndex
CREATE INDEX "schedule_templates_company_id_idx" ON "schedule_templates"("companyId");

-- CreateIndex
CREATE INDEX "schedule_templates_location_id_idx" ON "schedule_templates"("locationId");

-- CreateIndex
CREATE INDEX "schedule_templates_employee_id_idx" ON "schedule_templates"("employeeId");

-- CreateIndex
CREATE INDEX "schedule_templates_archived_at_idx" ON "schedule_templates"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "shift_generation_batches_operationKey_key" ON "shift_generation_batches"("operationKey");

-- CreateIndex
CREATE INDEX "shift_generation_batches_group_id_idx" ON "shift_generation_batches"("groupId");

-- CreateIndex
CREATE INDEX "shift_generation_batches_company_id_idx" ON "shift_generation_batches"("companyId");

-- CreateIndex
CREATE INDEX "shift_generation_batches_source_template_id_idx" ON "shift_generation_batches"("sourceTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_planningKey_key" ON "shifts"("planningKey");

-- CreateIndex
CREATE INDEX "shifts_group_id_idx" ON "shifts"("groupId");

-- CreateIndex
CREATE INDEX "shifts_company_id_idx" ON "shifts"("companyId");

-- CreateIndex
CREATE INDEX "shifts_location_id_idx" ON "shifts"("locationId");

-- CreateIndex
CREATE INDEX "shifts_employee_id_idx" ON "shifts"("employeeId");

-- CreateIndex
CREATE INDEX "shifts_scheduled_start_utc_idx" ON "shifts"("scheduledStartUtc");

-- CreateIndex
CREATE INDEX "shifts_scheduled_end_utc_idx" ON "shifts"("scheduledEndUtc");

-- CreateIndex
CREATE INDEX "shifts_status_idx" ON "shifts"("status");

-- CreateIndex
CREATE INDEX "shifts_generation_batch_id_idx" ON "shifts"("generationBatchId");

-- CreateIndex
CREATE INDEX "shifts_approved_at_idx" ON "shifts"("approvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "kiosks_locationId_key" ON "kiosks"("locationId");

-- CreateIndex
CREATE INDEX "kiosks_group_id_idx" ON "kiosks"("groupId");

-- CreateIndex
CREATE INDEX "kiosks_company_id_idx" ON "kiosks"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "kiosk_credentials_kioskId_key" ON "kiosk_credentials"("kioskId");

-- CreateIndex
CREATE UNIQUE INDEX "field_sites_locationId_key" ON "field_sites"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "field_sites_hostname_key" ON "field_sites"("hostname");

-- CreateIndex
CREATE INDEX "field_sites_group_id_idx" ON "field_sites"("groupId");

-- CreateIndex
CREATE INDEX "field_sites_company_id_idx" ON "field_sites"("companyId");

-- CreateIndex
CREATE INDEX "field_sites_archived_at_idx" ON "field_sites"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "punch_events_idempotencyKey_key" ON "punch_events"("idempotencyKey");

-- CreateIndex
CREATE INDEX "punch_events_shift_id_idx" ON "punch_events"("shiftId");

-- CreateIndex
CREATE INDEX "punch_events_employee_id_idx" ON "punch_events"("employeeId");

-- CreateIndex
CREATE INDEX "punch_events_kiosk_id_idx" ON "punch_events"("kioskId");

-- CreateIndex
CREATE INDEX "punch_events_event_utc_idx" ON "punch_events"("eventUtc");

-- CreateIndex
CREATE INDEX "correction_requests_company_id_idx" ON "correction_requests"("companyId");

-- CreateIndex
CREATE INDEX "correction_requests_shift_id_idx" ON "correction_requests"("shiftId");

-- CreateIndex
CREATE INDEX "correction_requests_status_idx" ON "correction_requests"("status");

-- CreateIndex
CREATE INDEX "correction_requests_created_at_idx" ON "correction_requests"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "punch_corrections_correctionRequestId_key" ON "punch_corrections"("correctionRequestId");

-- CreateIndex
CREATE INDEX "punch_corrections_shift_id_idx" ON "punch_corrections"("shiftId");

-- CreateIndex
CREATE INDEX "punch_corrections_company_id_idx" ON "punch_corrections"("companyId");

-- CreateIndex
CREATE INDEX "weekly_periods_company_id_idx" ON "weekly_periods"("companyId");

-- CreateIndex
CREATE INDEX "weekly_periods_status_idx" ON "weekly_periods"("status");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_periods_company_id_week_start_key" ON "weekly_periods"("companyId", "weekStartLocalDate");

-- CreateIndex
CREATE INDEX "weekly_close_snapshots_period_id_idx" ON "weekly_close_snapshots"("weeklyPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_close_snapshots_period_version_key" ON "weekly_close_snapshots"("weeklyPeriodId", "version");

-- CreateIndex
CREATE INDEX "service_catalog_items_group_id_idx" ON "service_catalog_items"("groupId");

-- CreateIndex
CREATE INDEX "service_catalog_items_company_id_idx" ON "service_catalog_items"("companyId");

-- CreateIndex
CREATE INDEX "service_catalog_items_company_id_archived_at_idx" ON "service_catalog_items"("companyId", "archivedAt");

-- CreateIndex
CREATE INDEX "service_catalog_items_company_id_sort_order_idx" ON "service_catalog_items"("companyId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "service_catalog_items_company_id_name_key" ON "service_catalog_items"("companyId", "name");

-- CreateIndex
CREATE INDEX "vehicles_group_id_idx" ON "vehicles"("groupId");

-- CreateIndex
CREATE INDEX "vehicles_company_id_idx" ON "vehicles"("companyId");

-- CreateIndex
CREATE INDEX "vehicles_service_client_id_idx" ON "vehicles"("serviceClientId");

-- CreateIndex
CREATE INDEX "vehicles_location_id_idx" ON "vehicles"("locationId");

-- CreateIndex
CREATE INDEX "vehicles_company_id_archived_at_idx" ON "vehicles"("companyId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_company_id_vin_key" ON "vehicles"("companyId", "vin");

-- CreateIndex
CREATE INDEX "work_orders_group_id_idx" ON "work_orders"("groupId");

-- CreateIndex
CREATE INDEX "work_orders_company_id_idx" ON "work_orders"("companyId");

-- CreateIndex
CREATE INDEX "work_orders_service_client_id_idx" ON "work_orders"("serviceClientId");

-- CreateIndex
CREATE INDEX "work_orders_location_id_idx" ON "work_orders"("locationId");

-- CreateIndex
CREATE INDEX "work_orders_vehicle_id_idx" ON "work_orders"("vehicleId");

-- CreateIndex
CREATE INDEX "work_orders_company_id_status_idx" ON "work_orders"("companyId", "status");

-- CreateIndex
CREATE INDEX "work_orders_invoiced_client_invoice_id_idx" ON "work_orders"("invoicedClientInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_company_id_work_order_number_key" ON "work_orders"("companyId", "workOrderNumber");

-- CreateIndex
CREATE INDEX "work_order_service_lines_group_id_idx" ON "work_order_service_lines"("groupId");

-- CreateIndex
CREATE INDEX "work_order_service_lines_company_id_idx" ON "work_order_service_lines"("companyId");

-- CreateIndex
CREATE INDEX "work_order_service_lines_work_order_id_idx" ON "work_order_service_lines"("workOrderId");

-- CreateIndex
CREATE INDEX "work_order_service_lines_service_catalog_item_id_idx" ON "work_order_service_lines"("serviceCatalogItemId");

-- CreateIndex
CREATE INDEX "work_order_status_history_group_id_idx" ON "work_order_status_history"("groupId");

-- CreateIndex
CREATE INDEX "work_order_status_history_company_id_idx" ON "work_order_status_history"("companyId");

-- CreateIndex
CREATE INDEX "work_order_status_history_work_order_id_idx" ON "work_order_status_history"("workOrderId");

-- CreateIndex
CREATE INDEX "work_order_assignments_group_id_idx" ON "work_order_assignments"("groupId");

-- CreateIndex
CREATE INDEX "work_order_assignments_company_id_idx" ON "work_order_assignments"("companyId");

-- CreateIndex
CREATE INDEX "work_order_assignments_work_order_id_idx" ON "work_order_assignments"("workOrderId");

-- CreateIndex
CREATE INDEX "work_order_assignments_work_order_service_line_id_idx" ON "work_order_assignments"("workOrderServiceLineId");

-- CreateIndex
CREATE INDEX "work_order_assignments_employee_id_idx" ON "work_order_assignments"("employeeId");

-- CreateIndex
CREATE INDEX "work_order_assignments_company_id_unassigned_at_idx" ON "work_order_assignments"("companyId", "unassignedAt");

-- CreateIndex
CREATE INDEX "vehicle_responsibility_logs_company_id_idx" ON "vehicle_responsibility_logs"("companyId");

-- CreateIndex
CREATE INDEX "vehicle_responsibility_logs_work_order_id_idx" ON "vehicle_responsibility_logs"("workOrderId");

-- CreateIndex
CREATE INDEX "vehicle_responsibility_logs_vehicle_id_idx" ON "vehicle_responsibility_logs"("vehicleId");

-- CreateIndex
CREATE INDEX "vehicle_responsibility_logs_employee_id_idx" ON "vehicle_responsibility_logs"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "worker_scan_events_idempotencyKey_key" ON "worker_scan_events"("idempotencyKey");

-- CreateIndex
CREATE INDEX "worker_scan_events_company_id_idx" ON "worker_scan_events"("companyId");

-- CreateIndex
CREATE INDEX "worker_scan_events_location_id_idx" ON "worker_scan_events"("locationId");

-- CreateIndex
CREATE INDEX "worker_scan_events_vehicle_id_idx" ON "worker_scan_events"("vehicleId");

-- CreateIndex
CREATE INDEX "worker_scan_events_work_order_id_idx" ON "worker_scan_events"("workOrderId");

-- CreateIndex
CREATE INDEX "worker_scan_events_employee_id_idx" ON "worker_scan_events"("employeeId");

-- CreateIndex
CREATE INDEX "worker_scan_events_work_order_assignment_id_idx" ON "worker_scan_events"("workOrderAssignmentId");

-- CreateIndex
CREATE INDEX "service_completions_company_id_idx" ON "service_completions"("companyId");

-- CreateIndex
CREATE INDEX "service_completions_work_order_id_idx" ON "service_completions"("workOrderId");

-- CreateIndex
CREATE INDEX "service_completions_work_order_service_line_id_idx" ON "service_completions"("workOrderServiceLineId");

-- CreateIndex
CREATE INDEX "service_completions_employee_id_idx" ON "service_completions"("employeeId");

-- CreateIndex
CREATE INDEX "client_invoices_group_id_idx" ON "client_invoices"("groupId");

-- CreateIndex
CREATE INDEX "client_invoices_company_id_idx" ON "client_invoices"("companyId");

-- CreateIndex
CREATE INDEX "client_invoices_service_client_id_idx" ON "client_invoices"("serviceClientId");

-- CreateIndex
CREATE INDEX "client_invoices_company_id_status_idx" ON "client_invoices"("companyId", "status");

-- CreateIndex
CREATE INDEX "client_invoices_company_id_due_date_idx" ON "client_invoices"("companyId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "client_invoices_company_id_invoice_number_key" ON "client_invoices"("companyId", "invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "company_billing_settings_companyId_key" ON "company_billing_settings"("companyId");

-- CreateIndex
CREATE INDEX "company_billing_settings_group_id_idx" ON "company_billing_settings"("groupId");

-- CreateIndex
CREATE INDEX "company_invoice_sequences_group_id_idx" ON "company_invoice_sequences"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "company_invoice_sequences_company_id_sequence_key_key" ON "company_invoice_sequences"("companyId", "sequenceKey");

-- CreateIndex
CREATE INDEX "client_invoice_lines_company_id_idx" ON "client_invoice_lines"("companyId");

-- CreateIndex
CREATE INDEX "client_invoice_lines_client_invoice_id_idx" ON "client_invoice_lines"("clientInvoiceId");

-- CreateIndex
CREATE INDEX "client_invoice_lines_work_order_id_idx" ON "client_invoice_lines"("workOrderId");

-- CreateIndex
CREATE INDEX "client_invoice_lines_work_order_service_line_id_idx" ON "client_invoice_lines"("workOrderServiceLineId");

-- CreateIndex
CREATE INDEX "client_invoice_lines_vehicle_id_idx" ON "client_invoice_lines"("vehicleId");

-- CreateIndex
CREATE INDEX "client_invoice_deliveries_company_id_idx" ON "client_invoice_deliveries"("companyId");

-- CreateIndex
CREATE INDEX "client_invoice_deliveries_client_invoice_id_idx" ON "client_invoice_deliveries"("clientInvoiceId");

-- CreateIndex
CREATE INDEX "client_invoice_deliveries_recipient_email_idx" ON "client_invoice_deliveries"("recipientEmail");

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

-- CreateIndex
CREATE INDEX "labor_billing_drafts_company_id_idx" ON "labor_billing_drafts"("companyId");

-- CreateIndex
CREATE INDEX "labor_billing_drafts_location_id_idx" ON "labor_billing_drafts"("locationId");

-- CreateIndex
CREATE INDEX "labor_billing_drafts_created_by_user_id_idx" ON "labor_billing_drafts"("createdByUserId");

-- CreateIndex
CREATE INDEX "labor_billing_drafts_period_start_idx" ON "labor_billing_drafts"("periodStart");

-- CreateIndex
CREATE INDEX "labor_work_assignments_group_id_idx" ON "labor_work_assignments"("groupId");

-- CreateIndex
CREATE INDEX "labor_work_assignments_company_id_idx" ON "labor_work_assignments"("companyId");

-- CreateIndex
CREATE INDEX "labor_work_assignments_employee_id_idx" ON "labor_work_assignments"("employeeId");

-- CreateIndex
CREATE INDEX "labor_work_assignments_shift_id_idx" ON "labor_work_assignments"("shiftId");

-- CreateIndex
CREATE INDEX "labor_work_assignments_service_client_id_idx" ON "labor_work_assignments"("serviceClientId");

-- CreateIndex
CREATE INDEX "labor_work_assignments_location_id_idx" ON "labor_work_assignments"("locationId");

-- CreateIndex
CREATE INDEX "labor_work_assignments_status_idx" ON "labor_work_assignments"("status");

-- CreateIndex
CREATE INDEX "labor_work_assignments_started_at_idx" ON "labor_work_assignments"("startedAt");

-- CreateIndex
CREATE INDEX "labor_work_assignments_work_order_id_idx" ON "labor_work_assignments"("workOrderId");

-- CreateIndex
CREATE INDEX "labor_work_assignments_work_order_service_line_id_idx" ON "labor_work_assignments"("workOrderServiceLineId");

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

-- CreateIndex
CREATE INDEX "vehicle_photos_vehicle_id_deleted_at_idx" ON "vehicle_photos"("vehicleId", "deletedAt");

-- CreateIndex
CREATE INDEX "vehicle_photos_work_order_id_deleted_at_idx" ON "vehicle_photos"("workOrderId", "deletedAt");

-- CreateIndex
CREATE INDEX "vehicle_photos_company_id_uploaded_at_idx" ON "vehicle_photos"("companyId", "uploadedAt");

-- CreateIndex
CREATE INDEX "vehicle_photos_group_id_idx" ON "vehicle_photos"("groupId");

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

-- CreateIndex
CREATE UNIQUE INDEX "mechanic_part_ai_suggestions_partId_key" ON "mechanic_part_ai_suggestions"("partId");

-- CreateIndex
CREATE INDEX "mechanic_part_ai_suggestions_part_id_idx" ON "mechanic_part_ai_suggestions"("partId");

-- CreateIndex
CREATE INDEX "mobile_devices_group_id_idx" ON "mobile_devices"("groupId");

-- CreateIndex
CREATE INDEX "mobile_devices_company_id_idx" ON "mobile_devices"("companyId");

-- CreateIndex
CREATE INDEX "mobile_devices_location_id_idx" ON "mobile_devices"("locationId");

-- CreateIndex
CREATE INDEX "mobile_devices_status_idx" ON "mobile_devices"("status");

-- CreateIndex
CREATE INDEX "mobile_devices_revoked_at_idx" ON "mobile_devices"("revokedAt");

-- CreateIndex
CREATE INDEX "mobile_devices_replacement_for_device_id_idx" ON "mobile_devices"("replacementForDeviceId");

-- CreateIndex
CREATE UNIQUE INDEX "mobile_devices_company_id_android_id_hash_key" ON "mobile_devices"("companyId", "androidIdHash");

-- CreateIndex
CREATE UNIQUE INDEX "mobile_enrollment_tokens_token_hash_key" ON "mobile_enrollment_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "mobile_enrollment_tokens_group_id_idx" ON "mobile_enrollment_tokens"("groupId");

-- CreateIndex
CREATE INDEX "mobile_enrollment_tokens_company_id_idx" ON "mobile_enrollment_tokens"("companyId");

-- CreateIndex
CREATE INDEX "mobile_enrollment_tokens_location_id_idx" ON "mobile_enrollment_tokens"("locationId");

-- CreateIndex
CREATE INDEX "mobile_enrollment_tokens_status_idx" ON "mobile_enrollment_tokens"("status");

-- CreateIndex
CREATE INDEX "mobile_enrollment_tokens_expires_at_idx" ON "mobile_enrollment_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "mobile_enrollment_tokens_created_by_user_id_idx" ON "mobile_enrollment_tokens"("createdByUserId");

-- CreateIndex
CREATE INDEX "mobile_enrollment_tokens_consumed_by_device_id_idx" ON "mobile_enrollment_tokens"("consumedByDeviceId");

-- CreateIndex
CREATE UNIQUE INDEX "mobile_sessions_token_hash_key" ON "mobile_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "mobile_sessions_group_id_idx" ON "mobile_sessions"("groupId");

-- CreateIndex
CREATE INDEX "mobile_sessions_company_id_idx" ON "mobile_sessions"("companyId");

-- CreateIndex
CREATE INDEX "mobile_sessions_location_id_idx" ON "mobile_sessions"("locationId");

-- CreateIndex
CREATE INDEX "mobile_sessions_device_id_idx" ON "mobile_sessions"("deviceId");

-- CreateIndex
CREATE INDEX "mobile_sessions_employee_id_idx" ON "mobile_sessions"("employeeId");

-- CreateIndex
CREATE INDEX "mobile_sessions_expires_at_idx" ON "mobile_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "mobile_sessions_revoked_at_idx" ON "mobile_sessions"("revokedAt");

-- CreateIndex
CREATE INDEX "employee_badge_credentials_group_id_idx" ON "employee_badge_credentials"("groupId");

-- CreateIndex
CREATE INDEX "employee_badge_credentials_company_id_idx" ON "employee_badge_credentials"("companyId");

-- CreateIndex
CREATE INDEX "employee_badge_credentials_location_id_idx" ON "employee_badge_credentials"("locationId");

-- CreateIndex
CREATE INDEX "employee_badge_credentials_employee_id_idx" ON "employee_badge_credentials"("employeeId");

-- CreateIndex
CREATE INDEX "employee_badge_credentials_device_id_idx" ON "employee_badge_credentials"("deviceId");

-- CreateIndex
CREATE INDEX "employee_badge_credentials_revoked_at_idx" ON "employee_badge_credentials"("revokedAt");

-- CreateIndex
CREATE INDEX "employee_badge_credentials_locked_until_idx" ON "employee_badge_credentials"("lockedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "employee_badge_credentials_company_id_badge_uid_hash_key" ON "employee_badge_credentials"("companyId", "badgeUidHash");

-- CreateIndex
CREATE INDEX "mobile_auth_audit_events_group_id_idx" ON "mobile_auth_audit_events"("groupId");

-- CreateIndex
CREATE INDEX "mobile_auth_audit_events_company_id_idx" ON "mobile_auth_audit_events"("companyId");

-- CreateIndex
CREATE INDEX "mobile_auth_audit_events_location_id_idx" ON "mobile_auth_audit_events"("locationId");

-- CreateIndex
CREATE INDEX "mobile_auth_audit_events_actor_user_id_idx" ON "mobile_auth_audit_events"("actorUserId");

-- CreateIndex
CREATE INDEX "mobile_auth_audit_events_employee_id_idx" ON "mobile_auth_audit_events"("employeeId");

-- CreateIndex
CREATE INDEX "mobile_auth_audit_events_device_id_idx" ON "mobile_auth_audit_events"("deviceId");

-- CreateIndex
CREATE INDEX "mobile_auth_audit_events_action_idx" ON "mobile_auth_audit_events"("action");

-- CreateIndex
CREATE INDEX "mobile_auth_audit_events_outcome_idx" ON "mobile_auth_audit_events"("outcome");

-- CreateIndex
CREATE INDEX "mobile_auth_audit_events_created_at_idx" ON "mobile_auth_audit_events"("createdAt");

-- CreateIndex
CREATE INDEX "mobile_auth_rate_limits_group_id_idx" ON "mobile_auth_rate_limits"("groupId");

-- CreateIndex
CREATE INDEX "mobile_auth_rate_limits_company_id_idx" ON "mobile_auth_rate_limits"("companyId");

-- CreateIndex
CREATE INDEX "mobile_auth_rate_limits_location_id_idx" ON "mobile_auth_rate_limits"("locationId");

-- CreateIndex
CREATE INDEX "mobile_auth_rate_limits_scope_idx" ON "mobile_auth_rate_limits"("scope");

-- CreateIndex
CREATE INDEX "mobile_auth_rate_limits_locked_until_idx" ON "mobile_auth_rate_limits"("lockedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "mobile_auth_rate_limits_scope_identifier_hash_window_start_key" ON "mobile_auth_rate_limits"("scope", "identifierHash", "windowStart");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_activeCompanyId_fkey" FOREIGN KEY ("activeCompanyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_groupMembershipId_fkey" FOREIGN KEY ("groupMembershipId") REFERENCES "group_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_companyMembershipId_fkey" FOREIGN KEY ("companyMembershipId") REFERENCES "company_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_clients" ADD CONSTRAINT "service_clients_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_clients" ADD CONSTRAINT "service_clients_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_serviceClientId_fkey" FOREIGN KEY ("serviceClientId") REFERENCES "service_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_client_locations" ADD CONSTRAINT "service_client_locations_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_client_locations" ADD CONSTRAINT "service_client_locations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_client_locations" ADD CONSTRAINT "service_client_locations_serviceClientId_fkey" FOREIGN KEY ("serviceClientId") REFERENCES "service_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_client_locations" ADD CONSTRAINT "service_client_locations_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_pin_credentials" ADD CONSTRAINT "employee_pin_credentials_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_pin_credentials" ADD CONSTRAINT "employee_pin_credentials_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_pin_credentials" ADD CONSTRAINT "employee_pin_credentials_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_rates" ADD CONSTRAINT "employee_rates_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_rates" ADD CONSTRAINT "employee_rates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_rates" ADD CONSTRAINT "employee_rates_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_labor_rates" ADD CONSTRAINT "client_labor_rates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_labor_rates" ADD CONSTRAINT "client_labor_rates_serviceClientId_fkey" FOREIGN KEY ("serviceClientId") REFERENCES "service_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_labor_rates" ADD CONSTRAINT "client_labor_rates_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_labor_rates" ADD CONSTRAINT "client_labor_rates_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supervisor_location_assignments" ADD CONSTRAINT "supervisor_location_assignments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supervisor_location_assignments" ADD CONSTRAINT "supervisor_location_assignments_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supervisor_location_assignments" ADD CONSTRAINT "supervisor_location_assignments_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supervisor_location_assignments" ADD CONSTRAINT "supervisor_location_assignments_supervisorUserId_fkey" FOREIGN KEY ("supervisorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supervisor_location_assignments" ADD CONSTRAINT "supervisor_location_assignments_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_templates" ADD CONSTRAINT "schedule_templates_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_templates" ADD CONSTRAINT "schedule_templates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_templates" ADD CONSTRAINT "schedule_templates_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_templates" ADD CONSTRAINT "schedule_templates_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_templates" ADD CONSTRAINT "schedule_templates_serviceClientId_fkey" FOREIGN KEY ("serviceClientId") REFERENCES "service_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_templates" ADD CONSTRAINT "schedule_templates_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_generation_batches" ADD CONSTRAINT "shift_generation_batches_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_generation_batches" ADD CONSTRAINT "shift_generation_batches_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_generation_batches" ADD CONSTRAINT "shift_generation_batches_sourceTemplateId_fkey" FOREIGN KEY ("sourceTemplateId") REFERENCES "schedule_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_generation_batches" ADD CONSTRAINT "shift_generation_batches_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_serviceClientId_fkey" FOREIGN KEY ("serviceClientId") REFERENCES "service_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_additionalTimeApprovedByUserId_fkey" FOREIGN KEY ("additionalTimeApprovedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_generationBatchId_fkey" FOREIGN KEY ("generationBatchId") REFERENCES "shift_generation_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "shifts"
    ADD CONSTRAINT "shifts_no_overlap_for_employee"
    EXCLUDE USING gist (
        "companyId" WITH =,
        "employeeId" WITH =,
        tsrange("scheduledStartUtc", "scheduledEndUtc", '[)') WITH &&
    )
    WHERE ("status" = 'SCHEDULED');

-- AddForeignKey
ALTER TABLE "kiosks" ADD CONSTRAINT "kiosks_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kiosks" ADD CONSTRAINT "kiosks_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kiosks" ADD CONSTRAINT "kiosks_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kiosk_credentials" ADD CONSTRAINT "kiosk_credentials_kioskId_fkey" FOREIGN KEY ("kioskId") REFERENCES "kiosks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_sites" ADD CONSTRAINT "field_sites_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_sites" ADD CONSTRAINT "field_sites_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_sites" ADD CONSTRAINT "field_sites_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_events" ADD CONSTRAINT "punch_events_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_events" ADD CONSTRAINT "punch_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_events" ADD CONSTRAINT "punch_events_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_events" ADD CONSTRAINT "punch_events_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_events" ADD CONSTRAINT "punch_events_kioskId_fkey" FOREIGN KEY ("kioskId") REFERENCES "kiosks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_appliedByUserId_fkey" FOREIGN KEY ("appliedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_corrections" ADD CONSTRAINT "punch_corrections_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_corrections" ADD CONSTRAINT "punch_corrections_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_corrections" ADD CONSTRAINT "punch_corrections_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_corrections" ADD CONSTRAINT "punch_corrections_correctionRequestId_fkey" FOREIGN KEY ("correctionRequestId") REFERENCES "correction_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_corrections" ADD CONSTRAINT "punch_corrections_targetPunchEventId_fkey" FOREIGN KEY ("targetPunchEventId") REFERENCES "punch_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_corrections" ADD CONSTRAINT "punch_corrections_appliedByUserId_fkey" FOREIGN KEY ("appliedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_periods" ADD CONSTRAINT "weekly_periods_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_periods" ADD CONSTRAINT "weekly_periods_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_periods" ADD CONSTRAINT "weekly_periods_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_periods" ADD CONSTRAINT "weekly_periods_reopenedByUserId_fkey" FOREIGN KEY ("reopenedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_close_snapshots" ADD CONSTRAINT "weekly_close_snapshots_weeklyPeriodId_fkey" FOREIGN KEY ("weeklyPeriodId") REFERENCES "weekly_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_close_snapshots" ADD CONSTRAINT "weekly_close_snapshots_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_catalog_items" ADD CONSTRAINT "service_catalog_items_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_catalog_items" ADD CONSTRAINT "service_catalog_items_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_serviceClientId_fkey" FOREIGN KEY ("serviceClientId") REFERENCES "service_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_serviceClientId_fkey" FOREIGN KEY ("serviceClientId") REFERENCES "service_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_invoicedClientInvoiceId_fkey" FOREIGN KEY ("invoicedClientInvoiceId") REFERENCES "client_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_service_lines" ADD CONSTRAINT "work_order_service_lines_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_service_lines" ADD CONSTRAINT "work_order_service_lines_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_service_lines" ADD CONSTRAINT "work_order_service_lines_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_service_lines" ADD CONSTRAINT "work_order_service_lines_serviceCatalogItemId_fkey" FOREIGN KEY ("serviceCatalogItemId") REFERENCES "service_catalog_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_status_history" ADD CONSTRAINT "work_order_status_history_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_status_history" ADD CONSTRAINT "work_order_status_history_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_status_history" ADD CONSTRAINT "work_order_status_history_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_status_history" ADD CONSTRAINT "work_order_status_history_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_assignments" ADD CONSTRAINT "work_order_assignments_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_assignments" ADD CONSTRAINT "work_order_assignments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_assignments" ADD CONSTRAINT "work_order_assignments_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_assignments" ADD CONSTRAINT "work_order_assignments_workOrderServiceLineId_fkey" FOREIGN KEY ("workOrderServiceLineId") REFERENCES "work_order_service_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_assignments" ADD CONSTRAINT "work_order_assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_assignments" ADD CONSTRAINT "work_order_assignments_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_assignments" ADD CONSTRAINT "work_order_assignments_unassignedByUserId_fkey" FOREIGN KEY ("unassignedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_responsibility_logs" ADD CONSTRAINT "vehicle_responsibility_logs_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_responsibility_logs" ADD CONSTRAINT "vehicle_responsibility_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_responsibility_logs" ADD CONSTRAINT "vehicle_responsibility_logs_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_responsibility_logs" ADD CONSTRAINT "vehicle_responsibility_logs_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_responsibility_logs" ADD CONSTRAINT "vehicle_responsibility_logs_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_responsibility_logs" ADD CONSTRAINT "vehicle_responsibility_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_scan_events" ADD CONSTRAINT "worker_scan_events_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_scan_events" ADD CONSTRAINT "worker_scan_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_scan_events" ADD CONSTRAINT "worker_scan_events_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_scan_events" ADD CONSTRAINT "worker_scan_events_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_scan_events" ADD CONSTRAINT "worker_scan_events_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_scan_events" ADD CONSTRAINT "worker_scan_events_workOrderAssignmentId_fkey" FOREIGN KEY ("workOrderAssignmentId") REFERENCES "work_order_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_scan_events" ADD CONSTRAINT "worker_scan_events_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_completions" ADD CONSTRAINT "service_completions_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_completions" ADD CONSTRAINT "service_completions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_completions" ADD CONSTRAINT "service_completions_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_completions" ADD CONSTRAINT "service_completions_workOrderServiceLineId_fkey" FOREIGN KEY ("workOrderServiceLineId") REFERENCES "work_order_service_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_completions" ADD CONSTRAINT "service_completions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_completions" ADD CONSTRAINT "service_completions_workOrderAssignmentId_fkey" FOREIGN KEY ("workOrderAssignmentId") REFERENCES "work_order_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_completions" ADD CONSTRAINT "service_completions_workerScanEventId_fkey" FOREIGN KEY ("workerScanEventId") REFERENCES "worker_scan_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_completions" ADD CONSTRAINT "service_completions_voidedByUserId_fkey" FOREIGN KEY ("voidedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoices" ADD CONSTRAINT "client_invoices_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoices" ADD CONSTRAINT "client_invoices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoices" ADD CONSTRAINT "client_invoices_serviceClientId_fkey" FOREIGN KEY ("serviceClientId") REFERENCES "service_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoices" ADD CONSTRAINT "client_invoices_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoices" ADD CONSTRAINT "client_invoices_voidedByUserId_fkey" FOREIGN KEY ("voidedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_billing_settings" ADD CONSTRAINT "company_billing_settings_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_billing_settings" ADD CONSTRAINT "company_billing_settings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_invoice_sequences" ADD CONSTRAINT "company_invoice_sequences_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_invoice_sequences" ADD CONSTRAINT "company_invoice_sequences_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoice_lines" ADD CONSTRAINT "client_invoice_lines_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoice_lines" ADD CONSTRAINT "client_invoice_lines_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoice_lines" ADD CONSTRAINT "client_invoice_lines_clientInvoiceId_fkey" FOREIGN KEY ("clientInvoiceId") REFERENCES "client_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoice_lines" ADD CONSTRAINT "client_invoice_lines_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoice_lines" ADD CONSTRAINT "client_invoice_lines_workOrderServiceLineId_fkey" FOREIGN KEY ("workOrderServiceLineId") REFERENCES "work_order_service_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoice_lines" ADD CONSTRAINT "client_invoice_lines_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoice_deliveries" ADD CONSTRAINT "client_invoice_deliveries_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoice_deliveries" ADD CONSTRAINT "client_invoice_deliveries_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoice_deliveries" ADD CONSTRAINT "client_invoice_deliveries_clientInvoiceId_fkey" FOREIGN KEY ("clientInvoiceId") REFERENCES "client_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoice_deliveries" ADD CONSTRAINT "client_invoice_deliveries_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "labor_billing_drafts" ADD CONSTRAINT "labor_billing_drafts_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_billing_drafts" ADD CONSTRAINT "labor_billing_drafts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_billing_drafts" ADD CONSTRAINT "labor_billing_drafts_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_billing_drafts" ADD CONSTRAINT "labor_billing_drafts_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_work_assignments" ADD CONSTRAINT "labor_work_assignments_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_work_assignments" ADD CONSTRAINT "labor_work_assignments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_work_assignments" ADD CONSTRAINT "labor_work_assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_work_assignments" ADD CONSTRAINT "labor_work_assignments_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_work_assignments" ADD CONSTRAINT "labor_work_assignments_serviceClientId_fkey" FOREIGN KEY ("serviceClientId") REFERENCES "service_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_work_assignments" ADD CONSTRAINT "labor_work_assignments_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_work_assignments" ADD CONSTRAINT "labor_work_assignments_serviceCatalogItemId_fkey" FOREIGN KEY ("serviceCatalogItemId") REFERENCES "service_catalog_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_work_assignments" ADD CONSTRAINT "labor_work_assignments_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_work_assignments" ADD CONSTRAINT "labor_work_assignments_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_work_assignments" ADD CONSTRAINT "labor_work_assignments_workOrderServiceLineId_fkey" FOREIGN KEY ("workOrderServiceLineId") REFERENCES "work_order_service_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_inspection_checklists" ADD CONSTRAINT "vehicle_inspection_checklists_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_inspection_checklists" ADD CONSTRAINT "vehicle_inspection_checklists_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_inspection_checklists" ADD CONSTRAINT "vehicle_inspection_checklists_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_inspection_checklist_items" ADD CONSTRAINT "vehicle_inspection_checklist_items_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "vehicle_inspection_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_photos" ADD CONSTRAINT "vehicle_photos_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_photos" ADD CONSTRAINT "vehicle_photos_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_photos" ADD CONSTRAINT "vehicle_photos_uploadedByEmployeeId_fkey" FOREIGN KEY ("uploadedByEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_photos" ADD CONSTRAINT "vehicle_photos_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mechanic_order_parts" ADD CONSTRAINT "mechanic_order_parts_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mechanic_order_parts" ADD CONSTRAINT "mechanic_order_parts_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "vehicle_photos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mechanic_order_approvals" ADD CONSTRAINT "mechanic_order_approvals_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mechanic_order_approvals" ADD CONSTRAINT "mechanic_order_approvals_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mechanic_part_ai_suggestions" ADD CONSTRAINT "mechanic_part_ai_suggestions_partId_fkey" FOREIGN KEY ("partId") REFERENCES "mechanic_order_parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_devices" ADD CONSTRAINT "mobile_devices_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_devices" ADD CONSTRAINT "mobile_devices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_devices" ADD CONSTRAINT "mobile_devices_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_devices" ADD CONSTRAINT "mobile_devices_enrolledByUserId_fkey" FOREIGN KEY ("enrolledByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_devices" ADD CONSTRAINT "mobile_devices_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_devices" ADD CONSTRAINT "mobile_devices_reactivatedByUserId_fkey" FOREIGN KEY ("reactivatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_devices" ADD CONSTRAINT "mobile_devices_replacementForDeviceId_fkey" FOREIGN KEY ("replacementForDeviceId") REFERENCES "mobile_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_enrollment_tokens" ADD CONSTRAINT "mobile_enrollment_tokens_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_enrollment_tokens" ADD CONSTRAINT "mobile_enrollment_tokens_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_enrollment_tokens" ADD CONSTRAINT "mobile_enrollment_tokens_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_enrollment_tokens" ADD CONSTRAINT "mobile_enrollment_tokens_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_enrollment_tokens" ADD CONSTRAINT "mobile_enrollment_tokens_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_enrollment_tokens" ADD CONSTRAINT "mobile_enrollment_tokens_consumedByDeviceId_fkey" FOREIGN KEY ("consumedByDeviceId") REFERENCES "mobile_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_sessions" ADD CONSTRAINT "mobile_sessions_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_sessions" ADD CONSTRAINT "mobile_sessions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_sessions" ADD CONSTRAINT "mobile_sessions_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_sessions" ADD CONSTRAINT "mobile_sessions_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "mobile_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_sessions" ADD CONSTRAINT "mobile_sessions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_sessions" ADD CONSTRAINT "mobile_sessions_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_badge_credentials" ADD CONSTRAINT "employee_badge_credentials_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_badge_credentials" ADD CONSTRAINT "employee_badge_credentials_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_badge_credentials" ADD CONSTRAINT "employee_badge_credentials_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_badge_credentials" ADD CONSTRAINT "employee_badge_credentials_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_badge_credentials" ADD CONSTRAINT "employee_badge_credentials_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "mobile_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_badge_credentials" ADD CONSTRAINT "employee_badge_credentials_provisionedByUserId_fkey" FOREIGN KEY ("provisionedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_badge_credentials" ADD CONSTRAINT "employee_badge_credentials_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_auth_audit_events" ADD CONSTRAINT "mobile_auth_audit_events_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_auth_audit_events" ADD CONSTRAINT "mobile_auth_audit_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_auth_audit_events" ADD CONSTRAINT "mobile_auth_audit_events_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_auth_audit_events" ADD CONSTRAINT "mobile_auth_audit_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_auth_audit_events" ADD CONSTRAINT "mobile_auth_audit_events_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_auth_audit_events" ADD CONSTRAINT "mobile_auth_audit_events_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "mobile_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_auth_audit_events" ADD CONSTRAINT "mobile_auth_audit_events_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "mobile_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_auth_audit_events" ADD CONSTRAINT "mobile_auth_audit_events_enrollmentTokenId_fkey" FOREIGN KEY ("enrollmentTokenId") REFERENCES "mobile_enrollment_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_auth_audit_events" ADD CONSTRAINT "mobile_auth_audit_events_badgeCredentialId_fkey" FOREIGN KEY ("badgeCredentialId") REFERENCES "employee_badge_credentials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_auth_rate_limits" ADD CONSTRAINT "mobile_auth_rate_limits_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_auth_rate_limits" ADD CONSTRAINT "mobile_auth_rate_limits_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_auth_rate_limits" ADD CONSTRAINT "mobile_auth_rate_limits_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
