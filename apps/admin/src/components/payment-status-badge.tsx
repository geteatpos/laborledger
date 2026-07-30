import type { PaymentStatus } from "../lib/client-invoice-utils";

type PaymentStatusBadgeProps = {
  readonly status: PaymentStatus | "FAILED";
};

const STATUS_STYLES: Record<PaymentStatus | "FAILED", { className: string; label: string }> = {
  PENDING: {
    className: "stitch-badge-warning",
    label: "Pendiente"
  },
  POSTED: {
    className: "stitch-badge-success",
    label: "Pagada"
  },
  VOIDED: {
    className: "stitch-badge-neutral",
    label: "Anulada"
  },
  FAILED: {
    className: "stitch-badge-danger",
    label: "Fallida"
  }
};

export function PaymentStatusBadge({ status }: PaymentStatusBadgeProps) {
  const style = STATUS_STYLES[status];
  if (!style) {
    return <span className="stitch-badge-warning">{status}</span>;
  }
  return <span className={style.className}>{style.label}</span>;
}
