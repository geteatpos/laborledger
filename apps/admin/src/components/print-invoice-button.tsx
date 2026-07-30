"use client";

import Link from "next/link";

import { invoicePrintHelperCopy } from "../lib/client-invoice-utils";

type PrintInvoiceButtonProps = {
  readonly invoiceId: string;
};

export function PrintInvoiceButton({ invoiceId }: PrintInvoiceButtonProps) {
  return (
    <div className="space-y-1">
      <Link
        href={`/client-invoices/${invoiceId}/print`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z"
            clipRule="evenodd"
          />
        </svg>
        Imprimir factura
      </Link>
      <p className="text-xs text-slate-500">{invoicePrintHelperCopy()}</p>
    </div>
  );
}
