export type CreateEnrollmentTokenBody = {
  companyId: string;
  locationId: string;
  expiresAt?: string;
};

export type EnrollMobileDeviceBody = {
  enrollmentToken: string;
  androidId: string;
  label?: string;
};

export type MobileLoginBody = {
  deviceId: string;
  badgeUid: string;
  pin: string;
};

export type RevokeDeviceBody = {
  reason?: string;
};

export type RevokeSessionBody = {
  reason?: string;
};

export type RegisterBadgeBody = {
  locationId: string;
  badgeUid: string;
  label?: string;
  deviceId?: string;
  expiresAt?: string;
};

export type ListBadgesQuery = {
  employeeId?: string;
  includeRevoked?: string;
};

export type RevokeBadgeBody = {
  reason?: string;
};
