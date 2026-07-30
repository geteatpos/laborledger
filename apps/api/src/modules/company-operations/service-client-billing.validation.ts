import { BadRequestException } from "@nestjs/common";

const FIELD_LIMITS = {
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

export type ServiceClientBillingFieldName = keyof typeof FIELD_LIMITS;

export type ServiceClientBillingInput = Partial<{
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
}>;

export type NormalizedServiceClientBilling = {
  [K in ServiceClientBillingFieldName]?: string | null;
};

export type ServiceClientWriteInput = ServiceClientBillingInput & {
  name: string;
};

export function normalizeServiceClientName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new BadRequestException("Service client name is required.");
  }
  if (trimmed.length > 160) {
    throw new BadRequestException("Service client name must be 160 characters or fewer.");
  }
  return trimmed;
}

export function buildServiceClientBillingData(
  input: ServiceClientBillingInput,
  options: { requireAtLeastOne?: boolean } = {}
): NormalizedServiceClientBilling {
  const data: NormalizedServiceClientBilling = {};

  for (const field of Object.keys(FIELD_LIMITS) as ServiceClientBillingFieldName[]) {
    if (input[field] === undefined) {
      continue;
    }

    data[field] = normalizeBillingField(field, input[field]);
  }

  if (options.requireAtLeastOne && Object.keys(data).length === 0) {
    throw new BadRequestException("At least one billing field is required.");
  }

  return data;
}

export function buildServiceClientWriteData(input: ServiceClientWriteInput) {
  const name = normalizeServiceClientName(input.name);
  const billing = buildServiceClientBillingData(input);

  return {
    name,
    legalName: billing.legalName ?? null,
    taxId: billing.taxId ?? null,
    billingContactName: billing.billingContactName ?? null,
    phone: billing.phone ?? null,
    billingEmail: billing.billingEmail ?? null,
    addressLine1: billing.addressLine1 ?? null,
    addressLine2: billing.addressLine2 ?? null,
    city: billing.city ?? null,
    stateRegion: billing.stateRegion ?? null,
    postalCode: billing.postalCode ?? null,
    country: billing.country ?? null
  };
}

function normalizeBillingField(
  field: ServiceClientBillingFieldName,
  value: string | null | undefined
) {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const maxLength = FIELD_LIMITS[field];
  if (trimmed.length > maxLength) {
    throw new BadRequestException(
      `${formatBillingFieldLabel(field)} must be ${maxLength} characters or fewer.`
    );
  }

  if (field === "billingEmail") {
    const normalizedEmail = trimmed.toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      throw new BadRequestException("Billing email must be a valid email address.");
    }
    return normalizedEmail;
  }

  if (field === "phone" && !PHONE_PATTERN.test(trimmed)) {
    throw new BadRequestException("Phone may contain only digits and common phone punctuation.");
  }

  return trimmed;
}

function formatBillingFieldLabel(field: ServiceClientBillingFieldName) {
  switch (field) {
    case "legalName":
      return "Legal name";
    case "taxId":
      return "Tax ID";
    case "billingContactName":
      return "Billing contact";
    case "billingEmail":
      return "Billing email";
    case "addressLine1":
      return "Address line 1";
    case "addressLine2":
      return "Address line 2";
    case "stateRegion":
      return "State / region";
    case "postalCode":
      return "Postal code";
    default:
      return field.charAt(0).toUpperCase() + field.slice(1);
  }
}
