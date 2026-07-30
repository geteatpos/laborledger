export type MobileSessionContext = {
  sessionId: string;
  groupId: string;
  companyId: string;
  locationId: string;
  deviceId: string;
  employeeId: string;
  expiresAt: Date;
};

export type RequestWithMobileSession = {
  headers: Record<string, string | string[] | undefined>;
  mobileSession?: MobileSessionContext;
};

export type SafeMobileDevice = {
  id: string;
  groupId: string;
  companyId: string;
  locationId: string;
  label: string | null;
  status: string;
  enrolledAt: Date;
  revokedAt: Date | null;
  lastSeenAt: Date | null;
};

export type SafeMobileSession = {
  id: string;
  groupId: string;
  companyId: string;
  locationId: string;
  deviceId: string;
  employeeId: string;
  expiresAt: Date;
  lastSeenAt: Date | null;
  logoutAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

export type SafeBadgeCredential = {
  id: string;
  groupId: string;
  companyId: string;
  locationId: string;
  employeeId: string;
  deviceId: string | null;
  label: string | null;
  lockedUntil: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  provisionedAt: Date;
};
