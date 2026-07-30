"use client";

import {
  formatClientInvoiceDate,
  formatClientInvoiceMoney,
  formatPaymentMethodLabel,
  type ClientInvoicePaymentRecord
} from "../lib/client-invoice-utils";
import { PaymentStatusBadge } from "./payment-status-badge";

type ClientInvoicePaymentHistoryProps = {
  readonly payments: ClientInvoicePaymentRecord[];
  readonly _currencyCode: string;
};

export function ClientInvoicePaymentHistory({
  payments,
  _currencyCode
}: ClientInvoicePaymentHistoryProps) {
  if (!payments || payments.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-on-surface-variant">
        Sin pagos registrados
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {payments.map((payment) => (
        <li
          key={payment.id}
          className={`rounded-lg border p-3 ${
            payment.status === "VOIDED"
              ? "border-outline-variant/50 bg-surface-container-low/30 opacity-60"
              : "border-outline-variant bg-surface-container-low"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <PaymentStatusBadge status={payment.status} />
              <span className="text-xs font-medium text-on-surface">
                {formatPaymentMethodLabel(payment.method)}
              </span>
              {payment.reference ? (
                <span className="text-xs text-on-surface-variant">
                  · Ref: {payment.reference}
                </span>
              ) : null}
            </div>
            <span className="text-sm font-bold text-on-surface">
              {formatClientInvoiceMoney(payment.amountMinor, payment.currencyCode)}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-on-surface-variant">
            <span>
              {formatClientInvoiceDate(payment.paymentDate)}
              {payment.recordedByUser?.fullName ? (
                <> · {payment.recordedByUser.fullName}</>
              ) : null}
            </span>
            {payment.status === "VOIDED" && payment.voidedAt ? (
              <span className="text-error">
                Anulada {formatClientInvoiceDate(payment.voidedAt)}
                {payment.voidReason ? `: ${payment.voidReason}` : ""}
              </span>
            ) : null}
          </div>
          {payment.notes ? (
            <p className="mt-1.5 text-xs italic text-on-surface-variant">{payment.notes}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
