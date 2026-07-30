export type FieldSiteRecord = {
  id: string;
  companyId: string;
  locationId: string;
  hostname: string;
  displayName: string | null;
  ready: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  clockAvailable: boolean;
};

export function validateFieldHostname(hostname: string) {
  const trimmed = hostname.trim().toLowerCase();
  if (!trimmed) {
    return "Hostname is required.";
  }

  if (trimmed.length > 253) {
    return "Hostname is too long.";
  }

  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/u.test(trimmed)) {
    return "Hostname must be a valid domain (for example, app.example.com).";
  }

  return null;
}
