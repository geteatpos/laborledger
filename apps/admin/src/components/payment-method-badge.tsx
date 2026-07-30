import { formatPaymentMethodLabel, type PaymentMethod } from "../lib/client-invoice-utils";

type PaymentMethodBadgeProps = {
  readonly method: PaymentMethod;
};

export function PaymentMethodBadge({ method }: PaymentMethodBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2 py-0.5 text-xs font-medium text-on-surface-variant">
      {method === "CASH" && "💵"}
      {method === "BANK_TRANSFER" && "🏦"}
      {method === "CARD" && "💳"}
      {formatPaymentMethodLabel(method)}
    </span>
  );
}
