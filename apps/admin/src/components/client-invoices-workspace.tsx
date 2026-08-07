"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ClientInvoiceDetailPanel } from "./client-invoice-detail-panel";
import { ClientInvoiceDraftEditor } from "./client-invoice-draft-editor";
import { ClientInvoiceStatusBadge } from "./client-invoice-status-badge";
import { CreateClientInvoiceForm } from "./create-client-invoice-form";
import { MaterialIcon } from "./ui/material-icon";
import { MsKpiStrip } from "./ms-kpi-strip";
import {
  CLIENT_INVOICE_STATUS_OPTIONS,
  clientInvoicesEmptyMessage,
  formatClientInvoiceDate,
  formatClientInvoiceMoney,
  formatClientInvoiceNumberLabel,
  type ClientInvoiceListRecord,
  type ClientInvoiceStatus,
  type CompanyRecord,
  type ServiceClientRecord
} from "../lib/client-invoice-utils";

type ClientInvoicesWorkspaceProps = {
  readonly companies: CompanyRecord[];
  readonly selectedCompany: CompanyRecord;
  readonly invoices: ClientInvoiceListRecord[];
  readonly total: number;
  readonly statusCounts: Record<ClientInvoiceStatus, number>;
  readonly issuedTotalMinor: number;
  readonly page: number;
  readonly pageSize: number;
  readonly serviceClients: ServiceClientRecord[];
  readonly initialQuery: string;
  readonly initialStatus: string;
  readonly initialServiceClientId: string;
  readonly issueBlockedReason?: string | null | undefined;
};

export function ClientInvoicesWorkspace({
  companies,
  selectedCompany,
  invoices = [],
  total,
  statusCounts,
  issuedTotalMinor,
  page,
  pageSize,
  serviceClients,
  initialQuery,
  initialStatus,
  initialServiceClientId,
  issueBlockedReason
}: ClientInvoicesWorkspaceProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    invoices[0]?.id ?? null
  );
  const [detail, setDetail] = useState<ClientInvoiceListRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const filteredInvoices = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return invoices;
    }

    return invoices.filter((invoice) => {
      const haystack = [invoice.invoiceNumber, invoice.serviceClient.name, invoice.id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [invoices, query]);

  useEffect(() => {
    if (!selectedInvoiceId && filteredInvoices[0]) {
      setSelectedInvoiceId(filteredInvoices[0].id);
    }
    if (
      selectedInvoiceId &&
      filteredInvoices.length > 0 &&
      !filteredInvoices.some((invoice) => invoice.id === selectedInvoiceId)
    ) {
      setSelectedInvoiceId(filteredInvoices[0]?.id ?? null);
    }
  }, [filteredInvoices, selectedInvoiceId]);

  useEffect(() => {
    if (!selectedInvoiceId) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);

    fetch(`/api/company-operations/client-invoices/${selectedInvoiceId}`)
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as ClientInvoiceListRecord & {
          message?: string;
        };
        if (cancelled) {
          return;
        }
        if (!response.ok) {
          setDetail(null);
          setDetailError(payload.message ?? "No se pudo cargar la factura.");
          return;
        }
        setDetail(payload);
      })
      .finally(() => {
        if (!cancelled) {
          setDetailLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedInvoiceId, reloadToken]);

  const emptyCopy = clientInvoicesEmptyMessage(total > 0);
  const draftCount = statusCounts.DRAFT;
  const issuedCount = statusCounts.ISSUED;
  const voidCount = statusCounts.VOID;
  const currencyCode = invoices[0]?.currencyCode ?? "USD";
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  const hasPrevPage = page > 1;
  const hasNextPage = page < pageCount;

  function exportCsv() {
    const header = [
      "Numero",
      "Estado",
      "Cliente",
      "Ordenes",
      "Total",
      "Moneda",
      "Creada",
      "Emitida"
    ];
    const rows = filteredInvoices.map((invoice) => [
      formatClientInvoiceNumberLabel(invoice),
      invoice.status,
      invoice.serviceClient.name,
      invoice.workOrderCount,
      (invoice.totalMinor / 100).toFixed(2),
      invoice.currencyCode,
      invoice.createdAt,
      invoice.issuedAt ?? ""
    ]);
    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((cell) => {
            const value = String(cell);
            return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
          })
          .join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `facturas-${selectedCompany.name.replace(/\s+/g, "-").toLowerCase()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function buildHref(overrides: {
    companyId?: string;
    status?: string;
    q?: string;
    serviceClientId?: string;
    page?: number;
  }) {
    const params = new URLSearchParams();
    params.set("companyId", overrides.companyId ?? selectedCompany.id);

    const status = overrides.status ?? initialStatus;
    if (status) {
      params.set("status", status);
    }

    const clientId = overrides.serviceClientId ?? initialServiceClientId;
    if (clientId) {
      params.set("serviceClientId", clientId);
    }

    const search = overrides.q ?? query;
    if (search.trim()) {
      params.set("q", search.trim());
    }

    const targetPage = overrides.page ?? 1;
    if (targetPage > 1) {
      params.set("page", String(targetPage));
    }

    return `/client-invoices?${params.toString()}`;
  }

  function handleUpdated() {
    setReloadToken((value) => value + 1);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-body-sm text-on-surface-variant">
            Facturas recientes y vista previa del comprobante oficial.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={exportCsv} className="stitch-btn-secondary">
            <MaterialIcon name="download" className="text-[18px]" />
            Exportar
          </button>
          <CreateClientInvoiceForm company={selectedCompany} serviceClients={serviceClients} />
        </div>
      </div>

      <MsKpiStrip
        items={[
          { label: "Facturas", value: String(total), tone: "accent" },
          {
            label: "Borradores",
            value: String(draftCount),
            tone: draftCount > 0 ? "warning" : "default"
          },
          { label: "Emitidas", value: String(issuedCount) },
          {
            label: "Total emitido",
            value: formatClientInvoiceMoney(issuedTotalMinor, currencyCode),
            ...(voidCount > 0 ? { hint: `${voidCount} anuladas` } : {})
          }
        ]}
      />

      <div className="stitch-filter-panel space-y-4">
        {companies.length > 1 ? (
          <div>
            <p className="stitch-label mb-2">Empresa</p>
            <div className="flex flex-wrap gap-2">
              {companies.map((company) => (
                <Link
                  key={company.id}
                  href={buildHref({ companyId: company.id })}
                  className={
                    company.id === selectedCompany.id
                      ? "stitch-chip-active"
                      : "stitch-chip-inactive"
                  }
                >
                  {company.name}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_auto]">
          <form
            className="relative"
            onSubmit={(event) => {
              event.preventDefault();
              window.location.href = buildHref({ q: query });
            }}
          >
            <MaterialIcon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-outline"
            />
            <input
              id="invoice-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar factura, cliente, VIN…"
              className="stitch-input pl-10"
            />
          </form>
          <div className="flex flex-wrap gap-2">
            <Link
              href={buildHref({ status: "" })}
              className={!initialStatus ? "stitch-chip-active" : "stitch-chip-inactive"}
            >
              Todas
            </Link>
            {CLIENT_INVOICE_STATUS_OPTIONS.map((status) => (
              <Link
                key={status}
                href={buildHref({ status })}
                className={initialStatus === status ? "stitch-chip-active" : "stitch-chip-inactive"}
              >
                {status === "DRAFT" ? "Borrador" : status === "ISSUED" ? "Emitida" : "Anulada"}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="stitch-label mb-2">Cliente</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={buildHref({ serviceClientId: "" })}
              className={!initialServiceClientId ? "stitch-chip-active" : "stitch-chip-inactive"}
            >
              Todos
            </Link>
            {serviceClients
              .filter((client) => !client.archivedAt)
              .map((client) => (
                <Link
                  key={client.id}
                  href={buildHref({ serviceClientId: client.id })}
                  className={
                    initialServiceClientId === client.id
                      ? "stitch-chip-active"
                      : "stitch-chip-inactive"
                  }
                >
                  {client.name}
                </Link>
              ))}
          </div>
        </div>
      </div>

      {filteredInvoices.length === 0 ? (
        <div className="stitch-empty-state">
          <div className="stitch-empty-state-icon">
            <MaterialIcon name="receipt_long" className="text-[40px]" />
          </div>
          <p className="stitch-empty-state-title">{emptyCopy.title}</p>
          <p className="stitch-empty-state-description">{emptyCopy.description}</p>
        </div>
      ) : (
        <div className="grid gap-0 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-subtle lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="flex max-h-[78vh] flex-col border-b border-outline-variant lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
              <h2 className="text-sm font-semibold text-on-surface">Facturas recientes</h2>
              <span className="text-xs text-on-surface-variant">{filteredInvoices.length}</span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-2">
              {filteredInvoices.map((invoice) => {
                const active = invoice.id === selectedInvoiceId;
                return (
                  <button
                    key={invoice.id}
                    type="button"
                    onClick={() => setSelectedInvoiceId(invoice.id)}
                    className={`w-full rounded-xl border p-4 text-left transition-all ${
                      active
                        ? "border-secondary bg-secondary-container/10 shadow-subtle"
                        : "border-transparent hover:bg-surface-container-low"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold text-on-surface">
                        {formatClientInvoiceNumberLabel(invoice)}
                      </p>
                      <ClientInvoiceStatusBadge status={invoice.status} />
                    </div>
                    <p className="mt-1 text-xs text-on-surface-variant">{invoice.serviceClient.name}</p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-xs text-outline">
                        {formatClientInvoiceDate(invoice.issuedAt ?? invoice.createdAt)}
                      </span>
                      <span
                        className={`text-sm font-bold ${
                          active ? "text-secondary" : "text-on-surface"
                        }`}
                      >
                        {formatClientInvoiceMoney(invoice.totalMinor, invoice.currencyCode)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            {pageCount > 1 ? (
              <div className="flex items-center justify-between gap-2 border-t border-outline-variant px-4 py-3">
                <Link
                  href={buildHref({ page: page - 1 })}
                  aria-disabled={!hasPrevPage}
                  className={`stitch-chip-inactive ${!hasPrevPage ? "pointer-events-none opacity-40" : ""}`}
                >
                  Anterior
                </Link>
                <span className="text-xs text-on-surface-variant">
                  Página {page} de {pageCount}
                </span>
                <Link
                  href={buildHref({ page: page + 1 })}
                  aria-disabled={!hasNextPage}
                  className={`stitch-chip-inactive ${!hasNextPage ? "pointer-events-none opacity-40" : ""}`}
                >
                  Siguiente
                </Link>
              </div>
            ) : null}
          </aside>

          <section className="flex min-h-[420px] max-h-[78vh] flex-col bg-surface-container-low/40">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant bg-surface-container-lowest px-5 py-3">
              <div>
                <h2 className="text-sm font-semibold text-on-surface">Vista previa de factura</h2>
                <p className="text-xs text-on-surface-variant">
                  Visualización del documento contable
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              {detailLoading ? (
                <div className="flex h-48 items-center justify-center gap-3 text-on-surface-variant">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-on-surface-variant/30 border-t-on-surface-variant" />
                  Cargando factura…
                </div>
              ) : null}
              {detailError ? <p className="stitch-alert-error">{detailError}</p> : null}
              {detail && !detailLoading ? (
                detail.status === "DRAFT" ? (
                  <ClientInvoiceDraftEditor
                    invoice={detail}
                    companyId={selectedCompany.id}
                    companyName={selectedCompany.name}
                    serviceClients={serviceClients}
                    onUpdated={handleUpdated}
                    issueBlockedReason={issueBlockedReason}
                  />
                ) : (
                  <ClientInvoiceDetailPanel
                    invoice={detail}
                    companyName={selectedCompany.name}
                    onUpdated={handleUpdated}
                    issueBlockedReason={issueBlockedReason}
                    layout="preview"
                  />
                )
              ) : null}
              {!detail && !detailLoading && !detailError ? (
                <div className="flex h-48 flex-col items-center justify-center text-center text-on-surface-variant">
                  <MaterialIcon name="receipt_long" className="mb-2 text-[36px] opacity-50" />
                  <p className="text-sm">Selecciona una factura para previsualizarla.</p>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
