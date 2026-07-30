import { ClientInvoiceStatus } from "@prisma/client";

export const CLIENT_INVOICE_PDF_DISCLAIMER =
  "LaborLedger operational invoice. LaborLedger does not process payments, taxes, payroll, or accounting entries for this invoice.";

export function formatPdfMoney(minorUnits: number, currencyCode: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode
  }).format(minorUnits / 100);
}

export function formatPdfDate(value?: Date | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(value);
}

export function formatPdfStatusLabel(status: ClientInvoiceStatus) {
  if (status === ClientInvoiceStatus.DRAFT) {
    return "Draft";
  }

  if (status === ClientInvoiceStatus.ISSUED) {
    return "Issued";
  }

  return "Void";
}

export function formatPdfInvoiceNumberLabel(invoiceNumber: string | null, clientInvoiceId: string) {
  if (invoiceNumber) {
    return invoiceNumber;
  }

  return `Draft ${clientInvoiceId.slice(0, 8)}`;
}

export function formatPdfLineSummary(input: {
  workOrderNumberSnapshot?: string | null;
  vinSnapshot?: string | null;
  vehicleLabelSnapshot?: string | null;
}) {
  const workOrder = input.workOrderNumberSnapshot?.trim() || "—";
  const vehicle = input.vehicleLabelSnapshot?.trim() || input.vinSnapshot?.trim() || "—";
  return `${workOrder} · ${vehicle}`;
}

export function formatPdfVehicleDetailLines(input: {
  makeSnapshot?: string | null;
  vinSnapshot?: string | null;
  plateSnapshot?: string | null;
  colorSnapshot?: string | null;
  vehicleLabelSnapshot?: string | null;
  yearSnapshot?: number | null;
}) {
  const lines: string[] = [];

  const label = input.vehicleLabelSnapshot?.trim();
  if (label) {
    lines.push(label);
  }

  if (input.makeSnapshot?.trim() && !label) {
    lines.push(`Make: ${input.makeSnapshot.trim()}`);
  }

  if (input.colorSnapshot?.trim()) {
    lines.push(`Color: ${input.colorSnapshot.trim()}`);
  }

  if (input.vinSnapshot?.trim()) {
    lines.push(`VIN: ${input.vinSnapshot.trim()}`);
  }

  if (input.plateSnapshot?.trim()) {
    lines.push(`Plate: ${input.plateSnapshot.trim()}`);
  }

  return lines;
}

export function pickPdfInvoiceVehicle(lines: Array<{
  vinSnapshot?: string | null;
  makeSnapshot?: string | null;
  plateSnapshot?: string | null;
  colorSnapshot?: string | null;
  vehicleLabelSnapshot?: string | null;
  workOrderNumberSnapshot?: string | null;
}>) {
  const withVehicle = lines.find(
    (line) =>
      Boolean(line.vinSnapshot?.trim()) ||
      Boolean(line.vehicleLabelSnapshot?.trim()) ||
      Boolean(line.plateSnapshot?.trim())
  );

  if (!withVehicle) {
    return null;
  }

  return {
    workOrderNumberSnapshot: withVehicle.workOrderNumberSnapshot ?? null,
    vinSnapshot: withVehicle.vinSnapshot ?? null,
    makeSnapshot: withVehicle.makeSnapshot ?? null,
    plateSnapshot: withVehicle.plateSnapshot ?? null,
    colorSnapshot: withVehicle.colorSnapshot ?? null,
    vehicleLabelSnapshot: withVehicle.vehicleLabelSnapshot ?? null
  };
}
