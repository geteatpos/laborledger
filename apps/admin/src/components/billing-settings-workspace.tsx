"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";

import {
  billingDashboardProfile,
  billingSettingsApiPath,
  billingSettingsToFormState,
  buildBillingSettingsUpdatePayload,
  getBillingCompletenessIssues,
  getDaysPastDue,
  getInvoiceBalanceMinor,
  isInvoiceDueSoon,
  validateBillingSettingsForm,
  type BillingDashboardData,
  type BillingSettingsFormState,
  type CompanyDebtorRecord,
  type OutstandingInvoiceRecord
} from "../lib/billing-dashboard-utils";
import {
  formatClientInvoiceDate,
  formatClientInvoiceMoney,
  formatClientInvoiceNumberLabel,
  type ClientInvoiceListRecord,
  type CompanyRecord
} from "../lib/client-invoice-utils";
import {
  buildCompanyProfileUpdatePayload,
  companyProfileApiPath,
  formatCompanyAddressLines,
  validateCompanyProfileForm
} from "../lib/company-profile-utils";
import { MaterialIcon } from "./ui/material-icon";

type BillingSettingsWorkspaceProps = {
  readonly companies: CompanyRecord[];
  readonly selectedCompany: CompanyRecord;
  readonly data: BillingDashboardData;
  readonly invoices: ClientInvoiceListRecord[];
};

const FIELD_LABELS: Partial<Record<keyof BillingSettingsFormState, string>> = {
  legalName: "Nombre legal",
  phone: "Teléfono",
  billingEmail: "Correo de facturación",
  primaryContactName: "Contacto principal",
  addressLine1: "Dirección línea 1",
  addressLine2: "Dirección línea 2",
  city: "Ciudad",
  stateRegion: "Estado / región",
  postalCode: "Código postal",
  country: "País",
  invoicePrefix: "Prefijo",
  paymentTermsDays: "Términos de pago (días)",
  defaultNotes: "Instrucciones de pago",
  taxId: "Tax ID / EIN",
  logoUrl: "Logo",
  timezone: "Zona horaria"
};

export function BillingSettingsWorkspace({
  companies,
  selectedCompany,
  data,
  invoices
}: BillingSettingsWorkspaceProps) {
  const router = useRouter();
  const [form, setForm] = useState<BillingSettingsFormState>(() => billingSettingsToFormState(data.settings));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof BillingSettingsFormState, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [debtorsOpen, setDebtorsOpen] = useState(false);

  const completenessIssues = useMemo(
    () => getBillingCompletenessIssues({ company: selectedCompany, settings: data.settings }),
    [data.settings, selectedCompany]
  );
  const profile = billingDashboardProfile(data.settings);
  const addressLines = formatCompanyAddressLines(profile);
  const dueSoonInvoices = data.outstandingInvoices.filter((invoice) => isInvoiceDueSoon(invoice));
  const dueSoonBalanceMinor = dueSoonInvoices.reduce(
    (sum, invoice) => sum + getInvoiceBalanceMinor(invoice),
    0
  );
  const currencyCode = data.settings.currencyCode || invoices[0]?.currencyCode || "USD";

  function updateField(key: keyof BillingSettingsFormState, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    const profileErrors = validateCompanyProfileForm(form);
    const settingsErrors = validateBillingSettingsForm(form);
    const errors = { ...profileErrors, ...settingsErrors };

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    const [profileResponse, settingsResponse] = await Promise.all([
      fetch(companyProfileApiPath(selectedCompany.id), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildCompanyProfileUpdatePayload(form))
      }),
      fetch(billingSettingsApiPath(selectedCompany.id), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildBillingSettingsUpdatePayload(form))
      })
    ]);

    const profilePayload = (await profileResponse.json().catch(() => ({}))) as { message?: string };
    const settingsPayload = (await settingsResponse.json().catch(() => ({}))) as { message?: string };
    setIsSubmitting(false);

    if (!profileResponse.ok || !settingsResponse.ok) {
      setSubmitError(
        profilePayload.message ?? settingsPayload.message ?? "No se pudo guardar configuración de facturación."
      );
      return;
    }

    setSuccessMessage("Configuración de facturación guardada.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="stitch-label inline-flex items-center gap-1.5">
            <MaterialIcon name="receipt_long" className="text-[16px]" />
            Empresa activa
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-on-surface">{selectedCompany.name}</h2>
          <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">
            Los datos se cargan por empresa seleccionada y no se mezclan entre compañías.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {companies.map((company) => (
            <Link
              key={company.id}
              href={`/billing-settings?companyId=${encodeURIComponent(company.id)}`}
              className={company.id === selectedCompany.id ? "stitch-chip-active" : "stitch-chip-inactive"}
            >
              {company.name}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon="account_balance_wallet"
          label="Outstanding"
          value={formatClientInvoiceMoney(data.summary.outstandingBalanceMinor, currencyCode)}
          hint={`${data.summary.outstandingInvoiceCount} facturas abiertas`}
        />
        <MetricCard
          icon="warning"
          label="Overdue"
          value={formatClientInvoiceMoney(data.summary.overdueBalanceMinor, currencyCode)}
          hint={`${data.summary.overdueInvoiceCount} vencidas`}
          tone={data.summary.overdueInvoiceCount > 0 ? "danger" : "default"}
        />
        <MetricCard
          icon="event_upcoming"
          label="Due soon"
          value={formatClientInvoiceMoney(dueSoonBalanceMinor, currencyCode)}
          hint={`${dueSoonInvoices.length} vencen en 7 días`}
          tone={dueSoonInvoices.length > 0 ? "warning" : "default"}
        />
        <button
          type="button"
          onClick={() => setDebtorsOpen(true)}
          className={`rounded-xl border p-4 text-left shadow-subtle transition hover:-translate-y-0.5 hover:shadow-card ${
            data.summary.overdueInvoiceCount > 0
              ? "border-error bg-error-container/20"
              : "border-outline-variant bg-surface-container-lowest"
          }`}
        >
          <span className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
              Badge vencidas
            </span>
            {data.summary.overdueInvoiceCount > 0 ? (
              <span className="rounded-full bg-error px-2 py-0.5 text-xs font-bold text-white">
                {data.summary.overdueInvoiceCount}
              </span>
            ) : (
              <span className="stitch-chip-inactive">0</span>
            )}
          </span>
          <span className="mt-3 block text-lg font-bold text-on-surface">Clientes que deben</span>
          <span className="mt-1 block text-sm text-on-surface-variant">Abrir detalle de deudores</span>
        </button>
      </div>

      {completenessIssues.length > 0 ? (
        <section className="stitch-alert-error">
          <p className="font-semibold">Bloqueo al emitir factura: perfil incompleto.</p>
          <p className="mt-1">Completa: {completenessIssues.map((issue) => issue.label).join(", ")}.</p>
        </section>
      ) : (
        <section className="stitch-alert-success">
          Perfil de facturación completo. Las facturas se pueden emitir para esta empresa.
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <section className="stitch-card">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h2 className="text-base font-semibold text-on-surface">Formulario por empresa</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                Guarda datos de emisor, términos, numeración e instrucciones de pago.
              </p>
            </div>

            <FieldGroup title="Identidad y contacto" icon="business">
              <div className="grid gap-4 md:grid-cols-2">
                <ReadOnlyField label="Nombre comercial" value={selectedCompany.name} />
                <BillingField field="legalName" value={form.legalName} onChange={updateField} error={fieldErrors.legalName} />
                <BillingField field="phone" type="tel" value={form.phone} onChange={updateField} error={fieldErrors.phone} />
                <BillingField field="billingEmail" type="email" value={form.billingEmail} onChange={updateField} error={fieldErrors.billingEmail} />
                <BillingField field="primaryContactName" value={form.primaryContactName} onChange={updateField} error={fieldErrors.primaryContactName} />
                <ReadOnlyField label="Moneda" value={data.settings.currencyCode} />
              </div>
            </FieldGroup>

            <FieldGroup title="Dirección" icon="location_on">
              <div className="grid gap-4 md:grid-cols-2">
                <BillingField field="addressLine1" value={form.addressLine1} onChange={updateField} error={fieldErrors.addressLine1} />
                <BillingField field="addressLine2" value={form.addressLine2} onChange={updateField} error={fieldErrors.addressLine2} />
                <BillingField field="city" value={form.city} onChange={updateField} error={fieldErrors.city} />
                <BillingField field="stateRegion" value={form.stateRegion} onChange={updateField} error={fieldErrors.stateRegion} />
                <BillingField field="postalCode" value={form.postalCode} onChange={updateField} error={fieldErrors.postalCode} />
                <BillingField field="country" value={form.country} onChange={updateField} error={fieldErrors.country} />
              </div>
            </FieldGroup>

            <FieldGroup title="Factura y cobro" icon="payments">
              <div className="grid gap-4 md:grid-cols-2">
                <BillingField field="invoicePrefix" value={form.invoicePrefix} onChange={updateField} error={fieldErrors.invoicePrefix} />
                <BillingField field="paymentTermsDays" type="number" value={form.paymentTermsDays} onChange={updateField} error={fieldErrors.paymentTermsDays} />
                <ReadOnlyField label="Numeración" value={`${form.invoicePrefix || "INV"}-000001…`} />
                <ReadOnlyField label="Zona horaria" value="No expuesta por endpoint actual" />
                <ReadOnlyField label="Tax ID / EIN (opcional)" value="No expuesto por endpoint actual" />
                <ReadOnlyField label="Logo (opcional)" value="No expuesto por endpoint actual" />
              </div>
              <div className="mt-4">
                <label className="stitch-label mb-1.5 block" htmlFor="billing-default-notes">
                  Instrucciones de pago
                </label>
                <textarea
                  id="billing-default-notes"
                  value={form.defaultNotes}
                  onChange={(event) => updateField("defaultNotes", event.target.value)}
                  rows={4}
                  className="stitch-input"
                  placeholder="Ej. Favor de pagar por ACH dentro del término indicado…"
                />
                {fieldErrors.defaultNotes ? <p className="mt-1 text-xs text-error">{fieldErrors.defaultNotes}</p> : null}
              </div>
            </FieldGroup>

            {submitError ? <p className="stitch-alert-error">{submitError}</p> : null}
            {successMessage ? <p className="stitch-alert-success">{successMessage}</p> : null}

            <button type="submit" disabled={isSubmitting} className="stitch-btn-primary disabled:opacity-60">
              <MaterialIcon name="save" className="text-[18px]" />
              {isSubmitting ? "Guardando…" : "Guardar billing settings"}
            </button>
          </form>
        </section>

        <aside className="space-y-6">
          <section className="stitch-card">
            <h2 className="text-base font-semibold text-on-surface">Vista de facturas de la empresa</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Solo facturas de {selectedCompany.name}. Cambia empresa arriba para refrescar el conjunto.
            </p>
            <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {invoices.length === 0 ? (
                <p className="rounded-xl border border-dashed border-outline-variant p-4 text-sm text-on-surface-variant">
                  No hay facturas para esta empresa.
                </p>
              ) : (
                invoices.map((invoice) => (
                  <InvoiceRow key={invoice.id} invoice={invoice as OutstandingInvoiceRecord} />
                ))
              )}
            </div>
          </section>

          <section className="stitch-card">
            <h2 className="text-base font-semibold text-on-surface">Perfil en factura</h2>
            <div className="mt-4 rounded-xl border border-outline-variant bg-surface-container-low p-4">
              <p className="font-semibold text-on-surface">{profile.legalName || selectedCompany.name}</p>
              <p className="text-sm text-on-surface-variant">{selectedCompany.name}</p>
              <p className="mt-3 whitespace-pre-line text-sm text-on-surface-variant">
                {addressLines.length > 0 ? addressLines.join("\n") : "Sin dirección configurada."}
              </p>
              <dl className="mt-4 space-y-2 text-sm">
                <PreviewRow label="Teléfono" value={profile.phone} />
                <PreviewRow label="Correo" value={profile.billingEmail} />
                <PreviewRow label="Términos" value={`${data.settings.paymentTermsDays} días`} />
                <PreviewRow label="Prefijo" value={data.settings.invoicePrefix} />
              </dl>
            </div>
          </section>
        </aside>
      </div>

      {debtorsOpen ? (
        <DebtorsModal
          debtors={data.debtors}
          currencyCode={currencyCode}
          onClose={() => setDebtorsOpen(false)}
        />
      ) : null}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
  tone = "default"
}: {
  readonly icon: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
  readonly tone?: "default" | "danger" | "warning";
}) {
  const iconClass = tone === "danger" ? "bg-error-container text-error" : tone === "warning" ? "bg-tertiary-container text-on-tertiary-container" : "bg-primary-container text-on-primary-container";
  return (
    <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-subtle">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">{label}</span>
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconClass}`}>
          <MaterialIcon name={icon} className="text-[20px]" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold text-on-surface">{value}</p>
      <p className="mt-1 text-sm text-on-surface-variant">{hint}</p>
    </section>
  );
}

function FieldGroup({ title, icon, children }: { readonly title: string; readonly icon: string; readonly children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <h3 className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-on-surface">
        <MaterialIcon name={icon} className="text-[18px] text-secondary" />
        {title}
      </h3>
      {children}
    </section>
  );
}

function BillingField({
  field,
  value,
  onChange,
  error,
  type = "text"
}: {
  readonly field: keyof BillingSettingsFormState;
  readonly value: string;
  readonly onChange: (field: keyof BillingSettingsFormState, value: string) => void;
  readonly error?: string | undefined;
  readonly type?: string;
}) {
  const id = `billing-${field}`;
  return (
    <div>
      <label className="stitch-label mb-1.5 block" htmlFor={id}>
        {FIELD_LABELS[field] ?? field}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(field, event.target.value)}
        className="stitch-input"
      />
      {error ? <p className="mt-1 text-xs text-error">{error}</p> : null}
    </div>
  );
}

function ReadOnlyField({ label, value }: { readonly label: string; readonly value: string | null | undefined }) {
  return (
    <div>
      <p className="stitch-label mb-1.5">{label}</p>
      <p className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface-variant">
        {value || "—"}
      </p>
    </div>
  );
}

function InvoiceRow({ invoice }: { readonly invoice: OutstandingInvoiceRecord }) {
  const overdue = Boolean(invoice.isOverdue);
  return (
    <Link
      href={`/client-invoices?companyId=${encodeURIComponent(invoice.companyId ?? "")}&serviceClientId=${encodeURIComponent(invoice.serviceClient.id)}`}
      className="block rounded-xl border border-outline-variant bg-surface-container-lowest p-3 transition hover:border-secondary/50 hover:shadow-subtle"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-on-surface">{formatClientInvoiceNumberLabel(invoice)}</p>
          <p className="text-xs text-on-surface-variant">{invoice.serviceClient.name}</p>
        </div>
        {overdue ? <span className="rounded-full bg-error px-2 py-0.5 text-xs font-bold text-white">Vencida</span> : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-on-surface-variant">Vence {formatClientInvoiceDate(invoice.dueDate)}</span>
        <span className="font-bold text-on-surface">{formatClientInvoiceMoney(getInvoiceBalanceMinor(invoice), invoice.currencyCode)}</span>
      </div>
    </Link>
  );
}

function DebtorsModal({
  debtors,
  currencyCode,
  onClose
}: {
  readonly debtors: CompanyDebtorRecord[];
  readonly currencyCode: string;
  readonly onClose: () => void;
}) {
  return (
    <>
      <button type="button" aria-label="Cerrar deudores" className="fixed inset-0 z-40 bg-on-surface/35" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-3xl flex-col overflow-hidden bg-surface-container-lowest shadow-[0_20px_60px_rgba(11,28,48,0.28)]">
        <div className="flex items-center justify-between gap-3 border-b border-outline-variant px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-on-surface">Clientes que deben</h2>
            <p className="text-sm text-on-surface-variant">Cliente, contacto, totales, facturas y días de atraso.</p>
          </div>
          <button type="button" onClick={onClose} className="stitch-btn-secondary px-3 py-1.5 text-xs">
            Cerrar
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-5">
          {debtors.length === 0 ? (
            <p className="stitch-empty-state-description rounded-xl border border-dashed border-outline-variant p-5 text-center">
              No hay clientes con saldo pendiente.
            </p>
          ) : (
            debtors.map((debtor) => <DebtorCard key={debtor.serviceClient.id} debtor={debtor} currencyCode={currencyCode} />)
          )}
        </div>
      </aside>
    </>
  );
}

function DebtorCard({ debtor, currencyCode }: { readonly debtor: CompanyDebtorRecord; readonly currencyCode: string }) {
  const maxDaysPastDue = debtor.invoices.reduce(
    (max, invoice) => Math.max(max, getDaysPastDue(invoice)),
    0
  );
  return (
    <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-subtle">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-base font-semibold text-on-surface">{debtor.serviceClient.name}</h3>
          <dl className="mt-2 grid gap-1 text-sm text-on-surface-variant sm:grid-cols-2">
            <PreviewRow label="Teléfono" value={debtor.serviceClient.phone ?? "No registrado"} />
            <PreviewRow label="Correo" value={debtor.serviceClient.email ?? "No registrado"} />
          </dl>
        </div>
        <div className="rounded-lg bg-surface-container-low p-3 text-sm">
          <p className="font-semibold text-on-surface">
            Pendiente {formatClientInvoiceMoney(debtor.outstandingBalanceMinor, currencyCode)}
          </p>
          <p className="text-error">
            Vencido {formatClientInvoiceMoney(debtor.overdueBalanceMinor, currencyCode)} · {maxDaysPastDue} días
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {debtor.invoices.map((invoice) => (
          <Link
            key={invoice.id}
            href={`/client-invoices?companyId=${encodeURIComponent(invoice.companyId ?? "")}&serviceClientId=${encodeURIComponent(debtor.serviceClient.id)}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-outline-variant px-3 py-2 text-sm hover:border-secondary/50"
          >
            <span className="font-medium text-on-surface">{formatClientInvoiceNumberLabel(invoice)}</span>
            <span className="text-on-surface-variant">Vence {formatClientInvoiceDate(invoice.dueDate)}</span>
            <span className="font-semibold text-on-surface">
              {formatClientInvoiceMoney(getInvoiceBalanceMinor(invoice), invoice.currencyCode)}
            </span>
            {invoice.isOverdue ? <span className="rounded-full bg-error px-2 py-0.5 text-xs font-bold text-white">{getDaysPastDue(invoice)} días</span> : null}
          </Link>
        ))}
      </div>
    </section>
  );
}

function PreviewRow({ label, value }: { readonly label: string; readonly value?: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className="font-medium text-on-surface">{value || "—"}</dd>
    </div>
  );
}
