/**
 * Per-company (`Tenant`) settings stored in `Company.settings` (Json).
 *
 * Semantic map (cookie session auth — no JWT):
 * - activeCompanyId on Session  → selected tenant (tid)
 * - CompanyMembership.locationId → branch scope (bid); null = all locations
 *
 * Defaults applied when the JSON key is missing. Keep this file as the
 * single source of truth for keys and defaults.
 */

export type CompanySettings = {
  /** IANA timezone used when a location-level timezone is absent. */
  defaultTimezone: string;
  /** Monday-based week start for approvals / weekly close (0=Sun … 6=Sat). */
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Display locale for admin date formatting. */
  locale: string;
  /** Feature flags that used to be env/global. */
  features: {
    mechanicOrders: boolean;
    aiPartIdentify: boolean;
    laborBillingDrafts: boolean;
  };
};

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  defaultTimezone: "America/New_York",
  weekStartsOn: 1,
  locale: "en-US",
  features: {
    mechanicOrders: true,
    aiPartIdentify: true,
    laborBillingDrafts: false
  }
};

/**
 * Config that is still global / hardcoded today and should migrate into
 * `Company.settings` (or location) in follow-up slices:
 *
 * | Current source | Key | Notes |
 * |----------------|-----|-------|
 * | `apps/admin/src/lib/shift-utils.ts` `DEFAULT_TIMEZONE` | `defaultTimezone` | Admin week picker / date labels |
 * | `apps/api/.../weekly-close/week-period.ts` `DEFAULT_TIMEZONE` | `defaultTimezone` | Weekly close bounds fallback |
 * | Location.timezone (per branch) | — | Prefer location; company default is fallback only |
 * | `Company.currencyCode` column | keep column for now | Could mirror into settings later |
 * | `OPENAI_*` / AI flags env | `features.aiPartIdentify` | Kill-switch per tenant |
 * | Mechanic orders enabled | `features.mechanicOrders` | Today always on |
 * | Labor billing drafts | `features.laborBillingDrafts` | API still NotImplemented |
 */

export function mergeCompanySettings(raw: unknown): CompanySettings {
  const base = structuredClone(DEFAULT_COMPANY_SETTINGS);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }

  const input = raw as Record<string, unknown>;

  if (typeof input.defaultTimezone === "string" && input.defaultTimezone.trim()) {
    base.defaultTimezone = input.defaultTimezone.trim();
  }

  if (
    typeof input.weekStartsOn === "number" &&
    Number.isInteger(input.weekStartsOn) &&
    input.weekStartsOn >= 0 &&
    input.weekStartsOn <= 6
  ) {
    base.weekStartsOn = input.weekStartsOn as CompanySettings["weekStartsOn"];
  }

  if (typeof input.locale === "string" && input.locale.trim()) {
    base.locale = input.locale.trim();
  }

  if (input.features && typeof input.features === "object" && !Array.isArray(input.features)) {
    const features = input.features as Record<string, unknown>;
    if (typeof features.mechanicOrders === "boolean") {
      base.features.mechanicOrders = features.mechanicOrders;
    }
    if (typeof features.aiPartIdentify === "boolean") {
      base.features.aiPartIdentify = features.aiPartIdentify;
    }
    if (typeof features.laborBillingDrafts === "boolean") {
      base.features.laborBillingDrafts = features.laborBillingDrafts;
    }
  }

  return base;
}
