"use client";

import { useState } from "react";

import {
  formatClientInvoiceDeliverySummary,
  invoiceEmailSendDisabledCopy,
  isValidInvoiceRecipientEmail,
  type ClientInvoiceListRecord,
} from "../lib/client-invoice-utils";

type SendClientInvoiceEmailButtonProps = {
  readonly invoice: ClientInvoiceListRecord;
  readonly onSent?: () => void;
};

export function SendClientInvoiceEmailButton({
  invoice,
  onSent,
}: SendClientInvoiceEmailButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const disabledCopy = invoiceEmailSendDisabledCopy(invoice.status);

  if (disabledCopy) {
    return <p className="text-xs text-slate-500">{disabledCopy}</p>;
  }

  async function handleSubmit() {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isValidInvoiceRecipientEmail(recipientEmail)) {
      setErrorMessage("Ingresa un email válido.");
      return;
    }

    setIsSubmitting(true);

    const response = await fetch(
      `/api/company-operations/client-invoices/${invoice.id}/send-email`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recipientEmail: recipientEmail.trim(),
          message: message.trim() || undefined,
        }),
      }
    );

    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
      recipientEmail?: string;
    };

    setIsSubmitting(false);

    if (!response.ok) {
      setErrorMessage(payload.message ?? "No se pudo enviar el email.");
      onSent?.();
      return;
    }

    setSuccessMessage(
      `Factura enviada a ${payload.recipientEmail ?? recipientEmail.trim()}.`
    );
    setRecipientEmail("");
    setMessage("");
    setIsOpen(false);
    onSent?.();
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          setErrorMessage(null);
          setSuccessMessage(null);
        }}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M3 4a2 2 0 00-2 2v1.656l5.163 3.108a.75.75 0 00.674 0L17 7.656V6a2 2 0 00-2-2H3z" />
          <path d="M3 8h14v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
        </svg>
        Enviar por email
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <h4 className="text-sm font-semibold text-slate-900">Enviar factura por email</h4>
      <p className="mt-1 text-xs text-slate-500">
        El envío es para el cliente de servicio. Esto no es recolección de pago.
      </p>

      <div className="mt-3 space-y-3">
        <div>
          <label
            className="block text-xs font-medium text-slate-600"
            htmlFor={`recipient-${invoice.id}`}
          >
            Email del destinatario
          </label>
          <input
            id={`recipient-${invoice.id}`}
            type="email"
            value={recipientEmail}
            onChange={(event) => setRecipientEmail(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="facturacion@cliente.ejemplo"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label
            className="block text-xs font-medium text-slate-600"
            htmlFor={`message-${invoice.id}`}
          >
            Nota opcional
          </label>
          <textarea
            id={`message-${invoice.id}`}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            disabled={isSubmitting}
          />
        </div>

        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
        {successMessage && <p className="text-sm text-emerald-700">{successMessage}</p>}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmitting ? "Enviando..." : "Enviar email"}
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            disabled={isSubmitting}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
        </div>
      </div>

      {(invoice.deliveries ?? []).length > 0 ? (
        <ul className="mt-4 space-y-2 border-t border-slate-200 pt-3 text-xs text-slate-600">
          {(invoice.deliveries ?? []).slice(0, 5).map((delivery) => (
            <li key={delivery.id}>
              {formatClientInvoiceDeliverySummary(delivery)}
              {delivery.errorMessage ? (
                <span className="mt-0.5 block text-red-600">{delivery.errorMessage}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
