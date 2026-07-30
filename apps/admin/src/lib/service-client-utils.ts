import type { CompanyRecord } from "./employee-utils";
import { isLocationUsableByClient, type LocationRecord } from "./location-utils";

export type ServiceClientBillingFields = {
  legalName: string | null;
  taxId: string | null;
  billingContactName: string | null;
  phone: string | null;
  billingEmail: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateRegion: string | null;
  postalCode: string | null;
  country: string | null;
};

export type ServiceClientListRecord = {
  id: string;
  companyId: string;
  name: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt?: string;
} & ServiceClientBillingFields;

export type ServiceClientViewRecord = ServiceClientListRecord & {
  locationCount: number;
};

export type ServiceClientBillingFormState = {
  legalName: string;
  taxId: string;
  billingContactName: string;
  phone: string;
  billingEmail: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  country: string;
};

export type ServiceClientFormState = ServiceClientBillingFormState & {
  name: string;
};

export type LocationCountSource = Pick<
  LocationRecord,
  "serviceClientId" | "archivedAt" | "linkedServiceClientIds"
>;

const BILLING_FIELD_LIMITS = {
  legalName: 160,
  taxId: 64,
  billingContactName: 120,
  phone: 40,
  billingEmail: 254,
  addressLine1: 160,
  addressLine2: 160,
  city: 100,
  stateRegion: 100,
  postalCode: 32,
  country: 100
} as const;

const PHONE_PATTERN = /^[\d\s()+.\-xX#ext]+$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export function emptyServiceClientFormState(name = ""): ServiceClientFormState {
  return {
    name,
    legalName: "",
    taxId: "",
    billingContactName: "",
    phone: "",
    billingEmail: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    stateRegion: "",
    postalCode: "",
    country: ""
  };
}

export function serviceClientToFormState(
  client: Pick<ServiceClientListRecord, "name" | keyof ServiceClientBillingFields>
): ServiceClientFormState {
  return {
    name: client.name ?? "",
    legalName: client.legalName ?? "",
    taxId: client.taxId ?? "",
    billingContactName: client.billingContactName ?? "",
    phone: client.phone ?? "",
    billingEmail: client.billingEmail ?? "",
    addressLine1: client.addressLine1 ?? "",
    addressLine2: client.addressLine2 ?? "",
    city: client.city ?? "",
    stateRegion: client.stateRegion ?? "",
    postalCode: client.postalCode ?? "",
    country: client.country ?? ""
  };
}

export function normalizeServiceClientListRecord(
  client: Partial<ServiceClientListRecord> & {
    id: string;
    companyId: string;
    name: string;
    archivedAt: string | null;
    createdAt: string;
  }
): ServiceClientListRecord {
  return {
    id: client.id,
    companyId: client.companyId,
    name: client.name,
    archivedAt: client.archivedAt,
    createdAt: client.createdAt,
    ...(client.updatedAt ? { updatedAt: client.updatedAt } : {}),
    legalName: client.legalName ?? null,
    taxId: client.taxId ?? null,
    billingContactName: client.billingContactName ?? null,
    phone: client.phone ?? null,
    billingEmail: client.billingEmail ?? null,
    addressLine1: client.addressLine1 ?? null,
    addressLine2: client.addressLine2 ?? null,
    city: client.city ?? null,
    stateRegion: client.stateRegion ?? null,
    postalCode: client.postalCode ?? null,
    country: client.country ?? null
  };
}

export type ServiceClientWritePayload = {
  name: string;
  legalName: string | null;
  taxId: string | null;
  billingContactName: string | null;
  phone: string | null;
  billingEmail: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateRegion: string | null;
  postalCode: string | null;
  country: string | null;
};

export function buildServiceClientWritePayload(form: ServiceClientFormState): ServiceClientWritePayload {
  return {
    name: form.name.trim(),
    legalName: normalizeOptionalField(form.legalName),
    taxId: normalizeOptionalField(form.taxId),
    billingContactName: normalizeOptionalField(form.billingContactName),
    phone: normalizeOptionalField(form.phone),
    billingEmail: normalizeOptionalField(form.billingEmail)?.toLowerCase() ?? null,
    addressLine1: normalizeOptionalField(form.addressLine1),
    addressLine2: normalizeOptionalField(form.addressLine2),
    city: normalizeOptionalField(form.city),
    stateRegion: normalizeOptionalField(form.stateRegion),
    postalCode: normalizeOptionalField(form.postalCode),
    country: normalizeOptionalField(form.country)
  };
}

/** Normalize a BFF/API write body so billing profile fields are not dropped. */
export function resolveServiceClientWritePayload(
  body: unknown
): { ok: true; payload: ServiceClientWritePayload } | { ok: false; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "Service client name is required." };
  }

  const record = body as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name.trim() : "";
  if (!name) {
    return { ok: false, message: "Service client name is required." };
  }

  return {
    ok: true,
    payload: buildServiceClientWritePayload({
      name,
      legalName: optionalString(record.legalName),
      taxId: optionalString(record.taxId),
      billingContactName: optionalString(record.billingContactName),
      phone: optionalString(record.phone),
      billingEmail: optionalString(record.billingEmail),
      addressLine1: optionalString(record.addressLine1),
      addressLine2: optionalString(record.addressLine2),
      city: optionalString(record.city),
      stateRegion: optionalString(record.stateRegion),
      postalCode: optionalString(record.postalCode),
      country: optionalString(record.country)
    })
  };
}

export function validateServiceClientName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return "El nombre del cliente es obligatorio.";
  }
  if (trimmed.length > 160) {
    return "El nombre debe tener 160 caracteres o menos.";
  }
  return undefined;
}

export function validateServiceClientForm(
  form: ServiceClientFormState
): Partial<Record<keyof ServiceClientFormState, string>> {
  const errors: Partial<Record<keyof ServiceClientFormState, string>> = {};
  const nameError = validateServiceClientName(form.name);
  if (nameError) {
    errors.name = nameError;
  }

  for (const [field, maxLength] of Object.entries(BILLING_FIELD_LIMITS) as Array<
    [keyof ServiceClientBillingFormState, number]
  >) {
    const value = form[field].trim();
    if (!value) {
      continue;
    }
    if (value.length > maxLength) {
      errors[field] = `${formatServiceClientFieldLabel(field)} debe tener ${maxLength} caracteres o menos.`;
    }
  }

  const billingEmail = form.billingEmail.trim();
  if (billingEmail && !EMAIL_PATTERN.test(billingEmail.toLowerCase())) {
    errors.billingEmail = "El correo de facturación debe ser una dirección válida.";
  }

  const phone = form.phone.trim();
  if (phone && !PHONE_PATTERN.test(phone)) {
    errors.phone = "El teléfono solo puede incluir dígitos y signos habituales.";
  }

  return errors;
}

export function formatServiceClientDate(value?: string | null) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-DO", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(parsed);
}

export function formatServiceClientAddressLines(
  client: Pick<
    ServiceClientBillingFields,
    "addressLine1" | "addressLine2" | "city" | "stateRegion" | "postalCode" | "country"
  >
) {
  const lines: string[] = [];
  if (client.addressLine1?.trim()) {
    lines.push(client.addressLine1.trim());
  }
  if (client.addressLine2?.trim()) {
    lines.push(client.addressLine2.trim());
  }
  const cityLine = formatCityStatePostal(client);
  if (cityLine) {
    lines.push(cityLine);
  }
  if (client.country?.trim()) {
    lines.push(client.country.trim());
  }
  return lines;
}

export function resolveServiceClientDisplayName(
  client: Pick<ServiceClientListRecord, "name" | "legalName">
) {
  return client.legalName?.trim() || client.name;
}

export function filterServiceClientsByQuery(clients: ServiceClientViewRecord[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return clients;
  }

  return clients.filter((client) => {
    const haystack = [
      client.name,
      client.legalName,
      client.billingContactName,
      client.phone,
      client.billingEmail,
      client.taxId,
      client.city
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  });
}

export function enrichServiceClientsWithLocationCounts(
  clients: ServiceClientListRecord[],
  locations: LocationCountSource[]
): ServiceClientViewRecord[] {
  return clients.map((client) => ({
    ...normalizeServiceClientListRecord(client),
    locationCount: locations.filter((location) =>
      isLocationUsableByClient(location, client.id)
    ).length
  }));
}

export function formatServiceClientFieldLabel(field: keyof ServiceClientFormState) {
  switch (field) {
    case "name":
      return "Nombre comercial";
    case "legalName":
      return "Nombre legal / razón social";
    case "taxId":
      return "Tax ID / RNC";
    case "billingContactName":
      return "Encargado / contacto";
    case "phone":
      return "Teléfono";
    case "billingEmail":
      return "Correo de facturación";
    case "addressLine1":
      return "Dirección línea 1";
    case "addressLine2":
      return "Dirección línea 2";
    case "city":
      return "Ciudad";
    case "stateRegion":
      return "Estado / región";
    case "postalCode":
      return "Código postal";
    case "country":
      return "País";
    default:
      return field;
  }
}

export const SERVICE_CLIENT_FIELD_CONFIG: Array<{
  key: keyof ServiceClientBillingFormState;
  label: string;
  type?: "email" | "tel" | "text";
  section: "identity" | "contact" | "address";
}> = [
  { key: "legalName", label: formatServiceClientFieldLabel("legalName"), section: "identity" },
  { key: "taxId", label: formatServiceClientFieldLabel("taxId"), section: "identity" },
  {
    key: "billingContactName",
    label: formatServiceClientFieldLabel("billingContactName"),
    section: "contact"
  },
  { key: "phone", label: formatServiceClientFieldLabel("phone"), type: "tel", section: "contact" },
  {
    key: "billingEmail",
    label: formatServiceClientFieldLabel("billingEmail"),
    type: "email",
    section: "contact"
  },
  { key: "addressLine1", label: formatServiceClientFieldLabel("addressLine1"), section: "address" },
  { key: "addressLine2", label: formatServiceClientFieldLabel("addressLine2"), section: "address" },
  { key: "city", label: formatServiceClientFieldLabel("city"), section: "address" },
  { key: "stateRegion", label: formatServiceClientFieldLabel("stateRegion"), section: "address" },
  { key: "postalCode", label: formatServiceClientFieldLabel("postalCode"), section: "address" },
  { key: "country", label: formatServiceClientFieldLabel("country"), section: "address" }
];

function formatCityStatePostal(
  client: Pick<ServiceClientBillingFields, "city" | "stateRegion" | "postalCode">
) {
  const city = client.city?.trim() ?? "";
  const stateRegion = client.stateRegion?.trim() ?? "";
  const postalCode = client.postalCode?.trim() ?? "";
  const cityState = [city, stateRegion].filter(Boolean).join(", ");
  return [cityState, postalCode].filter(Boolean).join(cityState && postalCode ? " " : "");
}

function normalizeOptionalField(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function optionalString(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }
  return value;
}

export type { CompanyRecord };
