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
CREATE INDEX "mobile_devices_group_id_idx" ON "mobile_devices"("groupId");
CREATE INDEX "mobile_devices_company_id_idx" ON "mobile_devices"("companyId");
CREATE INDEX "mobile_devices_location_id_idx" ON "mobile_devices"("locationId");
CREATE INDEX "mobile_devices_status_idx" ON "mobile_devices"("status");
CREATE INDEX "mobile_devices_revoked_at_idx" ON "mobile_devices"("revokedAt");
CREATE INDEX "mobile_devices_replacement_for_device_id_idx" ON "mobile_devices"("replacementForDeviceId");
CREATE UNIQUE INDEX "mobile_devices_company_id_android_id_hash_key" ON "mobile_devices"("companyId", "androidIdHash");

-- CreateIndex
CREATE UNIQUE INDEX "mobile_enrollment_tokens_token_hash_key" ON "mobile_enrollment_tokens"("tokenHash");
CREATE INDEX "mobile_enrollment_tokens_group_id_idx" ON "mobile_enrollment_tokens"("groupId");
CREATE INDEX "mobile_enrollment_tokens_company_id_idx" ON "mobile_enrollment_tokens"("companyId");
CREATE INDEX "mobile_enrollment_tokens_location_id_idx" ON "mobile_enrollment_tokens"("locationId");
CREATE INDEX "mobile_enrollment_tokens_status_idx" ON "mobile_enrollment_tokens"("status");
CREATE INDEX "mobile_enrollment_tokens_expires_at_idx" ON "mobile_enrollment_tokens"("expiresAt");
CREATE INDEX "mobile_enrollment_tokens_created_by_user_id_idx" ON "mobile_enrollment_tokens"("createdByUserId");
CREATE INDEX "mobile_enrollment_tokens_consumed_by_device_id_idx" ON "mobile_enrollment_tokens"("consumedByDeviceId");

-- CreateIndex
CREATE UNIQUE INDEX "mobile_sessions_token_hash_key" ON "mobile_sessions"("tokenHash");
CREATE INDEX "mobile_sessions_group_id_idx" ON "mobile_sessions"("groupId");
CREATE INDEX "mobile_sessions_company_id_idx" ON "mobile_sessions"("companyId");
CREATE INDEX "mobile_sessions_location_id_idx" ON "mobile_sessions"("locationId");
CREATE INDEX "mobile_sessions_device_id_idx" ON "mobile_sessions"("deviceId");
CREATE INDEX "mobile_sessions_employee_id_idx" ON "mobile_sessions"("employeeId");
CREATE INDEX "mobile_sessions_expires_at_idx" ON "mobile_sessions"("expiresAt");
CREATE INDEX "mobile_sessions_revoked_at_idx" ON "mobile_sessions"("revokedAt");

-- CreateIndex
CREATE INDEX "employee_badge_credentials_group_id_idx" ON "employee_badge_credentials"("groupId");
CREATE INDEX "employee_badge_credentials_company_id_idx" ON "employee_badge_credentials"("companyId");
CREATE INDEX "employee_badge_credentials_location_id_idx" ON "employee_badge_credentials"("locationId");
CREATE INDEX "employee_badge_credentials_employee_id_idx" ON "employee_badge_credentials"("employeeId");
CREATE INDEX "employee_badge_credentials_device_id_idx" ON "employee_badge_credentials"("deviceId");
CREATE INDEX "employee_badge_credentials_revoked_at_idx" ON "employee_badge_credentials"("revokedAt");
CREATE INDEX "employee_badge_credentials_locked_until_idx" ON "employee_badge_credentials"("lockedUntil");
CREATE UNIQUE INDEX "employee_badge_credentials_company_id_badge_uid_hash_key" ON "employee_badge_credentials"("companyId", "badgeUidHash");

-- CreateIndex
CREATE INDEX "mobile_auth_audit_events_group_id_idx" ON "mobile_auth_audit_events"("groupId");
CREATE INDEX "mobile_auth_audit_events_company_id_idx" ON "mobile_auth_audit_events"("companyId");
CREATE INDEX "mobile_auth_audit_events_location_id_idx" ON "mobile_auth_audit_events"("locationId");
CREATE INDEX "mobile_auth_audit_events_actor_user_id_idx" ON "mobile_auth_audit_events"("actorUserId");
CREATE INDEX "mobile_auth_audit_events_employee_id_idx" ON "mobile_auth_audit_events"("employeeId");
CREATE INDEX "mobile_auth_audit_events_device_id_idx" ON "mobile_auth_audit_events"("deviceId");
CREATE INDEX "mobile_auth_audit_events_action_idx" ON "mobile_auth_audit_events"("action");
CREATE INDEX "mobile_auth_audit_events_outcome_idx" ON "mobile_auth_audit_events"("outcome");
CREATE INDEX "mobile_auth_audit_events_created_at_idx" ON "mobile_auth_audit_events"("createdAt");

-- CreateIndex
CREATE INDEX "mobile_auth_rate_limits_group_id_idx" ON "mobile_auth_rate_limits"("groupId");
CREATE INDEX "mobile_auth_rate_limits_company_id_idx" ON "mobile_auth_rate_limits"("companyId");
CREATE INDEX "mobile_auth_rate_limits_location_id_idx" ON "mobile_auth_rate_limits"("locationId");
CREATE INDEX "mobile_auth_rate_limits_scope_idx" ON "mobile_auth_rate_limits"("scope");
CREATE INDEX "mobile_auth_rate_limits_locked_until_idx" ON "mobile_auth_rate_limits"("lockedUntil");
CREATE UNIQUE INDEX "mobile_auth_rate_limits_scope_identifier_hash_window_start_key" ON "mobile_auth_rate_limits"("scope", "identifierHash", "windowStart");

-- AddForeignKey
ALTER TABLE "mobile_devices" ADD CONSTRAINT "mobile_devices_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mobile_devices" ADD CONSTRAINT "mobile_devices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mobile_devices" ADD CONSTRAINT "mobile_devices_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mobile_devices" ADD CONSTRAINT "mobile_devices_enrolledByUserId_fkey" FOREIGN KEY ("enrolledByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mobile_devices" ADD CONSTRAINT "mobile_devices_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mobile_devices" ADD CONSTRAINT "mobile_devices_reactivatedByUserId_fkey" FOREIGN KEY ("reactivatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mobile_devices" ADD CONSTRAINT "mobile_devices_replacementForDeviceId_fkey" FOREIGN KEY ("replacementForDeviceId") REFERENCES "mobile_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_enrollment_tokens" ADD CONSTRAINT "mobile_enrollment_tokens_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mobile_enrollment_tokens" ADD CONSTRAINT "mobile_enrollment_tokens_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mobile_enrollment_tokens" ADD CONSTRAINT "mobile_enrollment_tokens_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mobile_enrollment_tokens" ADD CONSTRAINT "mobile_enrollment_tokens_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mobile_enrollment_tokens" ADD CONSTRAINT "mobile_enrollment_tokens_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mobile_enrollment_tokens" ADD CONSTRAINT "mobile_enrollment_tokens_consumedByDeviceId_fkey" FOREIGN KEY ("consumedByDeviceId") REFERENCES "mobile_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_sessions" ADD CONSTRAINT "mobile_sessions_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mobile_sessions" ADD CONSTRAINT "mobile_sessions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mobile_sessions" ADD CONSTRAINT "mobile_sessions_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mobile_sessions" ADD CONSTRAINT "mobile_sessions_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "mobile_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mobile_sessions" ADD CONSTRAINT "mobile_sessions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mobile_sessions" ADD CONSTRAINT "mobile_sessions_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_badge_credentials" ADD CONSTRAINT "employee_badge_credentials_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_badge_credentials" ADD CONSTRAINT "employee_badge_credentials_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_badge_credentials" ADD CONSTRAINT "employee_badge_credentials_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_badge_credentials" ADD CONSTRAINT "employee_badge_credentials_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_badge_credentials" ADD CONSTRAINT "employee_badge_credentials_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "mobile_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employee_badge_credentials" ADD CONSTRAINT "employee_badge_credentials_provisionedByUserId_fkey" FOREIGN KEY ("provisionedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_badge_credentials" ADD CONSTRAINT "employee_badge_credentials_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_auth_audit_events" ADD CONSTRAINT "mobile_auth_audit_events_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mobile_auth_audit_events" ADD CONSTRAINT "mobile_auth_audit_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mobile_auth_audit_events" ADD CONSTRAINT "mobile_auth_audit_events_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mobile_auth_audit_events" ADD CONSTRAINT "mobile_auth_audit_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mobile_auth_audit_events" ADD CONSTRAINT "mobile_auth_audit_events_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mobile_auth_audit_events" ADD CONSTRAINT "mobile_auth_audit_events_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "mobile_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mobile_auth_audit_events" ADD CONSTRAINT "mobile_auth_audit_events_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "mobile_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mobile_auth_audit_events" ADD CONSTRAINT "mobile_auth_audit_events_enrollmentTokenId_fkey" FOREIGN KEY ("enrollmentTokenId") REFERENCES "mobile_enrollment_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mobile_auth_audit_events" ADD CONSTRAINT "mobile_auth_audit_events_badgeCredentialId_fkey" FOREIGN KEY ("badgeCredentialId") REFERENCES "employee_badge_credentials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_auth_rate_limits" ADD CONSTRAINT "mobile_auth_rate_limits_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mobile_auth_rate_limits" ADD CONSTRAINT "mobile_auth_rate_limits_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mobile_auth_rate_limits" ADD CONSTRAINT "mobile_auth_rate_limits_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
