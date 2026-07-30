import type { ClientInvoiceStatus } from "../lib/client-invoice-utils";

type ClientInvoiceStatusBadgeProps = {
  readonly status: ClientInvoiceStatus;
  readonly showLabel?: boolean;
};

const STATUS_STYLES: Record<ClientInvoiceStatus, { className: string; label: string }> = {
  DRAFT: {
    className: "stitch-badge-neutral",
    label: "Borrador"
  },
  ISSUED: {
    className: "stitch-badge-info",
    label: "Emitida"
  },
  VOID: {
    className: "stitch-badge-danger",
    label: "Anulada"
  }
};

export function ClientInvoiceStatusBadge({ status, showLabel = true }: ClientInvoiceStatusBadgeProps) {
  const { className, label } = STATUS_STYLES[status] ?? STATUS_STYLES.DRAFT;
  if (!showLabel) {
    return <span className={className}>●</span>;
  }
  return <span className={className}>{label}</span>;
}

export function ClientInvoiceDocumentBadge({ status }: { readonly status: ClientInvoiceStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
      status === "DRAFT"
        ? "bg-surface-container text-on-surface-variant"
        : status === "ISSUED"
        ? "bg-primary-fixed text-secondary"
        : "bg-error-container text-on-error-container"
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${
        status === "DRAFT"
          ? "bg-on-surface-variant"
          : status === "ISSUED"
          ? "bg-secondary"
          : "bg-on-error-container"
      }`} />
      {status === "DRAFT" ? "Borrador" : status === "ISSUED" ? "Emitida" : "Anulada"}
    </span>
  );
}
