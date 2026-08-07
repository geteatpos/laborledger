/** Employee-facing copy for Field PWA — safe to import from client components. */

export const FIELD_LOCATION_NOT_READY_MESSAGE =
  "This location is not ready yet. Ask a manager to finish Field setup in Admin.";

export const FIELD_FORGOT_PIN_HINT = "Forgot PIN? Ask supervisor.";

export const FIELD_LABOR_TIMER_DISCLAIMER =
  "Billable hours come from approved clock time. Work timers are for operations only.";

export function fieldLocationNotReadyMessage(): string {
  return FIELD_LOCATION_NOT_READY_MESSAGE;
}

/** @deprecated Use fieldLocationNotReadyMessage — kept for existing imports. */
export function fieldCompanyNotConfiguredMessage(): string {
  return FIELD_LOCATION_NOT_READY_MESSAGE;
}
