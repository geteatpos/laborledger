import {
  clientInvoiceDisclaimer,
  formatInvoiceAddressLines,
  formatInvoicePaymentTerms,
  formatClientInvoiceDate,
  formatClientInvoiceMoney,
  formatClientInvoiceNumberLabel,
  formatClientInvoiceStatusLabel,
  formatClientInvoiceVehicleDetails,
  pickClientInvoiceVehicle,
  resolveInvoiceBillToName,
  resolveInvoiceIssuerSnapshot,
  type ClientInvoiceListRecord
} from "../lib/client-invoice-utils";
import { ClientInvoiceStatusBadge } from "./client-invoice-status-badge";
import { MaterialIcon } from "./ui/material-icon";

type ClientInvoicePrintViewProps = {
  readonly invoice: ClientInvoiceListRecord;
  readonly companyName: string;
};

export function ClientInvoicePrintView({ invoice, companyName }: ClientInvoicePrintViewProps) {
  const issuer = resolveInvoiceIssuerSnapshot(invoice, companyName);
  const issuerName = issuer.legalName?.trim() || issuer.name?.trim() || companyName;
  const issuerAddressLines = formatInvoiceAddressLines(issuer);
  const billToName = resolveInvoiceBillToName(invoice);
  const billToAddressLines = invoice.billToSnapshot ? formatInvoiceAddressLines(invoice.billToSnapshot) : [];
  const balanceMinor = typeof invoice.balanceMinor === "number" ? invoice.balanceMinor : invoice.totalMinor;
  const amountPaidMinor = typeof invoice.amountPaidMinor === "number" ? invoice.amountPaidMinor : 0;
  const paymentInstructions =
    issuer.paymentInstructions?.trim() || "No hay instrucciones de pago registradas.";
  const invoiceVehicle = pickClientInvoiceVehicle(invoice.lines);
  const vehicleDetails = invoiceVehicle ? formatClientInvoiceVehicleDetails(invoiceVehicle) : [];

  return (
    <article className="mx-auto max-w-3xl bg-surface-container-lowest p-6 text-on-surface md:p-8 print:max-w-none print:p-0 print:text-black">
      <header className="flex flex-col gap-6 border-b border-outline-variant pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary">
            <MaterialIcon name="directions_car" className="text-[26px]" filled />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-secondary">
              Management System
            </p>
            <p className="mt-1 text-sm font-semibold text-on-surface">{issuerName}</p>
            {issuerAddressLines.map((line) => (
              <p key={line} className="mt-0.5 text-xs text-on-surface-variant">
                {line}
              </p>
            ))}
            <p className="mt-0.5 text-xs text-on-surface-variant">Tel: {issuer.phone?.trim() || "—"}</p>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              Correo: {issuer.billingEmail?.trim() || "—"}
            </p>
            <p className="mt-0.5 text-xs text-on-surface-variant">Tax ID: {issuer.taxId?.trim() || "—"}</p>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
            Factura electrónica
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-on-surface">
            {formatClientInvoiceNumberLabel(invoice)}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 sm:justify-end">
            <ClientInvoiceStatusBadge status={invoice.status} />
            <span className="text-xs text-on-surface-variant">
              {formatClientInvoiceStatusLabel(invoice.status)}
            </span>
          </div>
        </div>
      </header>

      <section className="mt-6 grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl bg-surface-container-low/70 p-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
            Facturar a
          </h2>
          <p className="mt-2 text-base font-semibold text-on-surface">{billToName}</p>
          {billToAddressLines.map((line) => (
            <p key={line} className="mt-0.5 text-xs text-on-surface-variant">
              {line}
            </p>
          ))}
          <p className="mt-1 text-xs text-on-surface-variant">
            Tax ID: {invoice.billToSnapshot?.taxId?.trim() || "—"}
          </p>
          {invoice.billToSnapshot?.phone?.trim() ? (
            <p className="mt-0.5 text-xs text-on-surface-variant">Tel: {invoice.billToSnapshot.phone}</p>
          ) : null}
        </div>
        <div className="rounded-xl bg-surface-container-low/70 p-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
            Fechas
          </h2>
          <dl className="mt-2 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-on-surface-variant">Fecha</dt>
              <dd className="font-medium text-on-surface">{formatClientInvoiceDate(invoice.createdAt)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-on-surface-variant">Emitida</dt>
              <dd className="font-medium text-on-surface">
                {invoice.issuedAt ? formatClientInvoiceDate(invoice.issuedAt) : "Pendiente"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-on-surface-variant">Vencimiento</dt>
              <dd className="font-medium text-on-surface">{formatClientInvoiceDate(invoice.dueDate)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-on-surface-variant">Términos</dt>
              <dd className="font-medium text-on-surface">
                {formatInvoicePaymentTerms(invoice.paymentTermsDays)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-on-surface-variant">Moneda</dt>
              <dd className="font-medium text-on-surface">{invoice.currencyCode}</dd>
            </div>
            {invoice.issuedByUser?.fullName ? (
              <div className="flex justify-between gap-3">
                <dt className="text-on-surface-variant">Emitida por</dt>
                <dd className="font-medium text-on-surface">{invoice.issuedByUser.fullName}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </section>

      {invoiceVehicle ? (
        <section className="mt-6 rounded-xl bg-surface-container-low/70 p-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
            Vehículo
          </h2>
          {invoiceVehicle.workOrderNumberSnapshot ? (
            <p className="mt-2 text-xs text-on-surface-variant">
              Orden: {invoiceVehicle.workOrderNumberSnapshot}
            </p>
          ) : null}
          {vehicleDetails.length > 0 ? (
            <ul className="mt-2 space-y-0.5 text-sm text-on-surface">
              {vehicleDetails.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
          Detalle de servicios
        </h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-outline-variant">
          <table className="w-full text-sm">
            <thead className="bg-surface-container-low text-left">
              <tr>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  Descripción
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  Cant.
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  Precio
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  Importe
                </th>
              </tr>
            </thead>
            <tbody>
              {(invoice.lines ?? []).map((line) => (
                <tr key={line.id} className="border-t border-outline-variant/50 align-top">
                  <td className="px-4 py-3 font-medium text-on-surface">
                    <p>{line.serviceNameSnapshot}</p>
                    {line.description?.trim() ? (
                      <p className="mt-0.5 text-xs font-normal text-on-surface-variant">
                        {line.description.trim()}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right text-on-surface-variant">{line.quantity}</td>
                  <td className="px-4 py-3 text-right text-on-surface-variant">
                    {formatClientInvoiceMoney(line.unitPriceMinor, line.currencyCode)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-on-surface">
                    {formatClientInvoiceMoney(line.lineTotalMinor, line.currencyCode)}
                  </td>
                </tr>
              ))}
              {(invoice.lines ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-on-surface-variant">
                    Sin líneas de servicio
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 flex justify-end">
        <div className="w-full max-w-sm space-y-2 rounded-xl bg-primary-container px-4 py-4 text-on-primary">
          <div className="flex justify-between text-sm text-on-primary/75">
            <span>Subtotal</span>
            <span>{formatClientInvoiceMoney(invoice.subtotalMinor, invoice.currencyCode)}</span>
          </div>
          <div className="flex justify-between text-sm text-on-primary/75">
            <span>Impuesto</span>
            <span>{formatClientInvoiceMoney(invoice.taxMinor, invoice.currencyCode)}</span>
          </div>
          <div className="flex justify-between border-t border-on-primary/20 pt-2 text-lg font-bold">
            <span>Total</span>
            <span>{formatClientInvoiceMoney(invoice.totalMinor, invoice.currencyCode)}</span>
          </div>
          <div className="flex justify-between text-sm text-on-primary/75">
            <span>Pagado</span>
            <span>{formatClientInvoiceMoney(amountPaidMinor, invoice.currencyCode)}</span>
          </div>
          <div className="flex justify-between border-t border-on-primary/20 pt-2 text-lg font-bold">
            <span>Balance</span>
            <span>{formatClientInvoiceMoney(balanceMinor, invoice.currencyCode)}</span>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-outline-variant p-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
          Instrucciones de pago
        </h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-on-surface-variant">
          {paymentInstructions}
        </p>
      </section>

      <section className="mt-6 rounded-xl border border-dashed border-outline-variant p-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
          Notas
        </h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-on-surface-variant">
          {invoice.notes?.trim() || "Sin notas."}
        </p>
      </section>

      {invoice.voidedAt ? (
        <p className="mt-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">
          Anulada {formatClientInvoiceDate(invoice.voidedAt)}
          {invoice.voidReason ? ` · ${invoice.voidReason}` : ""}
        </p>
      ) : null}

      <footer className="mt-8 border-t border-outline-variant pt-4 text-[11px] leading-relaxed text-on-surface-variant print:text-black/60">
        {clientInvoiceDisclaimer()}
      </footer>
    </article>
  );
}
