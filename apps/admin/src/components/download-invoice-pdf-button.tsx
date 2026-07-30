"use client";

import { useState } from "react";

import {
  buildClientInvoicePdfPath,
  clientInvoicePdfButtonLabel,
  type ClientInvoiceListRecord,
} from "../lib/client-invoice-utils";

type DownloadInvoicePdfButtonProps = {
  readonly invoice: ClientInvoiceListRecord;
};

export function DownloadInvoicePdfButton({ invoice }: DownloadInvoicePdfButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleDownload() {
    setIsDownloading(true);
    setErrorMessage(null);

    const response = await fetch(buildClientInvoicePdfPath(invoice.id));

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      setErrorMessage(payload.message ?? "No se pudo descargar el PDF.");
      setIsDownloading(false);
      return;
    }

    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") ?? "";
    const filenameMatch = disposition.match(/filename="([^"]+)"/u);
    const filename = filenameMatch?.[1] ?? "factura.pdf";
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    setIsDownloading(false);
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => void handleDownload()}
        disabled={isDownloading}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
          <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
        </svg>
        {isDownloading ? "Preparando PDF..." : clientInvoicePdfButtonLabel(invoice.status)}
      </button>
      {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
    </div>
  );
}
