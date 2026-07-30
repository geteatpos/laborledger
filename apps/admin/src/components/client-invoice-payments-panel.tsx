"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  resolvePaymentMethod,
  resolvePaymentStatus,
  type ClientInvoicePaymentRecord,
  type ClientInvoiceListRecord
} from "../lib/client-invoice-utils";
import { ClientInvoicePaymentHistory } from "./client-invoice-payment-history";
import { MarkAsPaidDialog } from "./client-invoice-payment-dialog";
import { MaterialIcon } from "./ui/material-icon";
import { PaymentMethodBadge } from "./payment-method-badge";

type ClientInvoicePaymentsPanelProps = {
  readonly invoice: ClientInvoiceListRecord;
  readonly onUpdated?: (() => void) | undefined;
};

export function ClientInvoicePaymentsPanel({
  invoice,
  onUpdated
}: ClientInvoicePaymentsPanelProps) {
  const router = useRouter();
  const [payments, setPayments] = useState<ClientInvoicePaymentRecord[]>(
    invoice.payments ?? []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stripeError, setStripeError] = useState<string | null>(null);

  const paymentStatus = resolvePaymentStatus(payments);
  const paymentMethod = resolvePaymentMethod(payments);
  const hasPostedPayment = payments.some((p) => p.status === "POSTED");
  const hasPendingPayment = payments.some((p) => p.status === "PENDING");

  useEffect(() => {
    if (invoice.status !== "ISSUED") return;

    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);

    fetch(`/api/company-operations/client-invoices/${invoice.id}/payments`)
      .then(async (response) => {
        if (cancelled) return;
        const payload = (await response.json().catch(() => [])) as
          | ClientInvoicePaymentRecord[]
          | { message?: string };
        if (!response.ok) {
          setErrorMessage(
            Array.isArray(payload)
              ? "No se pudieron cargar los pagos."
              : (payload.message ?? "No se pudieron cargar los pagos.")
          );
          return;
        }
        setPayments(Array.isArray(payload) ? payload : []);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [invoice.id, invoice.status]);

  async function handleStripeCheckout() {
    setStripeError(null);
    const confirmed = window.confirm(
      "¿Iniciar proceso de pago con Stripe? Esto te redirigirá a la página de pago."
    );
    if (!confirmed) return;

    try {
      const response = await fetch(
        `/api/company-operations/client-invoices/${invoice.id}/stripe-checkout`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            successUrl: window.location.href,
            cancelUrl: window.location.href
          })
        }
      );

      const payload = (await response.json().catch(() => ({}))) as { message?: string };

      if (!response.ok) {
        setStripeError(
          payload.message ?? "Stripe no está configurado o no está disponible."
        );
        return;
      }
    } catch {
      setStripeError("Stripe no está configurado o no está disponible.");
    }
  }

  function handlePaid() {
    onUpdated?.();
    router.refresh();
  }

  function _handleVoided() {
    onUpdated?.();
    router.refresh();
  }

  if (invoice.status !== "ISSUED") {
    return null;
  }

  return (
    <section className="mt-6 rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MaterialIcon name="payments" className="text-[18px] text-secondary" />
          <h3 className="text-sm font-semibold text-on-surface">Pagos</h3>
          {isLoading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-surface-variant/30 border-t-on-surface-variant" />
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {paymentMethod ? (
            <PaymentMethodBadge method={paymentMethod} />
          ) : null}
          {paymentStatus === "PENDING" && !hasPostedPayment ? (
            <span className="stitch-badge-warning">Pendiente</span>
          ) : paymentStatus === "PAID" || hasPostedPayment ? (
            <span className="stitch-badge-success">Pagada</span>
          ) : null}
        </div>
      </div>

      {stripeError ? (
        <div className="mt-3 rounded-lg border border-error/30 bg-error-container/20 p-3">
          <p className="text-xs text-error">{stripeError}</p>
        </div>
      ) : null}

      {errorMessage ? (
        <p className="mt-3 text-sm text-error">{errorMessage}</p>
      ) : null}

      <div className="mt-4">
        <ClientInvoicePaymentHistory
          payments={payments}
          _currencyCode={invoice.currencyCode}
        />
      </div>

      {!hasPostedPayment ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-outline-variant pt-4">
          <MarkAsPaidDialog invoice={invoice} onPaid={handlePaid} />
          <button
            type="button"
            onClick={handleStripeCheckout}
            className="stitch-btn-secondary px-3 py-1.5 text-xs"
          >
            <MaterialIcon name="credit_card" className="text-[16px]" />
            Pagar con Stripe
          </button>
        </div>
      ) : null}

      {hasPostedPayment && !hasPendingPayment ? (
        <div className="mt-4 border-t border-outline-variant pt-4">
          <p className="text-xs text-success">
            ✓ Factura pagada completamente
          </p>
        </div>
      ) : null}

      {hasPendingPayment ? (
        <div className="mt-4 border-t border-outline-variant pt-4">
          <p className="text-xs text-warning">
            Hay un pago pendiente que aún no ha sido procesado.
          </p>
        </div>
      ) : null}
    </section>
  );
}
