import type { LocationRecord, ServiceClientRecord } from "./location-utils";
import {
  canCreateVehicleIntake,
  normalizeVin,
  validateVin,
  type VinDecodePreviewRecord
} from "./vehicle-utils";
import { formatVehicleTitle } from "./vehicle-utils";

export const RECEPTION_PAGE_TITLE = "Reception";
export const RECEPTION_PAGE_DESCRIPTION =
  "Search an existing vehicle or customer, then create a work order for today.";
export const RECEPTION_HELPER_COPY =
  "Start by searching VIN, plate, phone, or customer name. If the vehicle already exists, receive it again instead of creating a duplicate.";
export const RECEPTION_SUPERVISOR_BLOCKED_LINE_1 =
  "Reception is available to company admins and group owners.";
export const RECEPTION_SUPERVISOR_BLOCKED_LINE_2 =
  "Supervisors can review assigned-location jobs from the Jobs page, but they cannot receive vehicles or create work orders.";
export const RECEPTION_GO_TO_JOBS_CTA = "Go to Jobs";

/** @deprecated Use RECEPTION_SUPERVISOR_BLOCKED_LINE_1 + LINE_2 */
export const RECEPTION_SUPERVISOR_BLOCKED_COPY = `${RECEPTION_SUPERVISOR_BLOCKED_LINE_1} ${RECEPTION_SUPERVISOR_BLOCKED_LINE_2}`;

export function isReceptionBlockedForSupervisor(canManageCompany: boolean) {
  return !canManageCompany;
}

export type ReceptionFormState = {
  serviceClientId: string;
  locationId: string;
  vin: string;
  plate: string;
  color: string;
  notes: string;
  selectedCatalogIds: string[];
  workOrderNotes: string;
};

export type ReceptionStep = "search" | "select" | "create" | "services";

export type ReceptionVehicleWorkOrderSummary = {
  id: string;
  workOrderNumber: string;
  status: string;
  createdAt: string;
  serviceLines: { serviceNameSnapshot: string }[];
};

export type ReceptionVehicleResult = {
  match: "vin_exact" | "search";
  vehicle: {
    id: string;
    vin: string;
    plate: string | null;
    color: string | null;
    year: number | null;
    make: string | null;
    model: string | null;
    trim: string | null;
    archivedAt: string | null;
    serviceClient: { id: string; name: string };
    location: { id: string; name: string; timezone: string; serviceClientId: string };
    workOrders: ReceptionVehicleWorkOrderSummary[];
  };
};

export function receptionRoute() {
  return "/reception";
}

export function jobsRoute() {
  return "/jobs";
}

export function jobDetailRoute(workOrderId: string) {
  return `/jobs/${encodeURIComponent(workOrderId)}`;
}

export function canOpenReception(
  serviceClients: ServiceClientRecord[],
  locations: LocationRecord[],
  canManageCompany: boolean
) {
  return canManageCompany && canCreateVehicleIntake(serviceClients, locations);
}

export function buildReceptionVehiclePayload(form: ReceptionFormState) {
  return {
    vin: normalizeVin(form.vin),
    serviceClientId: form.serviceClientId,
    locationId: form.locationId,
    plate: form.plate.trim() || undefined,
    color: form.color.trim() || undefined,
    notes: form.notes.trim() || undefined
  };
}

export function buildReceptionWorkOrderPayload(vehicleId: string, form: ReceptionFormState) {
  return {
    vehicleId,
    serviceCatalogItemIds: form.selectedCatalogIds,
    status: "READY" as const,
    notes: form.workOrderNotes.trim() || undefined
  };
}

export function formatDecodedVehicleSummary(
  decode: VinDecodePreviewRecord | Pick<VinDecodePreviewRecord, "year" | "make" | "model" | "trim" | "vin">
) {
  const title = formatVehicleTitle({
    year: decode.year,
    make: decode.make,
    model: decode.model,
    vin: decode.vin
  });

  if (decode.trim) {
    return `${title} · ${decode.trim}`;
  }

  return title;
}

export function formatReceptionVehicleTitle(
  vehicle: Pick<ReceptionVehicleResult["vehicle"], "year" | "make" | "model" | "vin">
) {
  return formatVehicleTitle({ year: vehicle.year, make: vehicle.make, model: vehicle.model, vin: vehicle.vin });
}

export function formatReceptionLastVisit(workOrders: ReceptionVehicleWorkOrderSummary[]) {
  if (workOrders.length === 0) {
    return "No prior visits";
  }

  const sorted = [...workOrders].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );

  const latest = sorted[0];
  if (!latest) {
    return "No prior visits";
  }

  const parsed = new Date(latest.createdAt);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(parsed);
}

export function validateReceptionForm(
  form: ReceptionFormState,
  options: { activeCatalogCount: number }
): Partial<Record<keyof ReceptionFormState | "selectedCatalogIds", string>> {
  const errors: Partial<Record<keyof ReceptionFormState | "selectedCatalogIds", string>> = {};

  const vinError = validateVin(form.vin);
  if (vinError) {
    errors.vin = vinError;
  }

  if (!form.serviceClientId) {
    errors.serviceClientId = "Service client is required.";
  }

  if (!form.locationId) {
    errors.locationId = "Location is required.";
  }

  if (form.selectedCatalogIds.length === 0) {
    errors.selectedCatalogIds = "Select at least one service.";
  }

  if (options.activeCatalogCount === 0) {
    errors.selectedCatalogIds = "Add active catalog services before receiving vehicles.";
  }

  return errors;
}

export function normalizeVinDisplay(value: string) {
  return normalizeVin(value);
}
