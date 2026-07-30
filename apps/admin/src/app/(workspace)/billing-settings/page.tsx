import { redirect } from "next/navigation";

import { AdminShell } from "../../../components/admin-shell";
import { BillingSettingsWorkspace } from "../../../components/billing-settings-workspace";
import { BillingSectionNav } from "../../../components/billing-section-nav";
import { formatChooseCompanyBlockedCopy } from "../../../lib/auth-utils";
import {
  BILLING_SETTINGS_PAGE_DESCRIPTION,
  BILLING_SETTINGS_PAGE_TITLE,
  type BillingSummaryRecord,
  type CompanyBillingSettingsRecord,
  type CompanyDebtorRecord,
  type OutstandingInvoiceRecord
} from "../../../lib/billing-dashboard-utils";
import { buildClientInvoiceListQuery, type ClientInvoiceListRecord } from "../../../lib/client-invoice-utils";
import {
  apiGet,
  loadWorkspaceContext,
  WorkspaceApiError
} from "../../../lib/workspace-auth";

type BillingSettingsPageProps = {
  readonly searchParams?: Promise<{ companyId?: string }>;
};

export default async function BillingSettingsPage({ searchParams }: BillingSettingsPageProps) {
  try {
    const query = (await searchParams) ?? {};
    const workspace = await loadWorkspaceContext();

    if (workspace.blocked) {
      return (
        <AdminShell title={BILLING_SETTINGS_PAGE_TITLE} description={BILLING_SETTINGS_PAGE_DESCRIPTION}>
          <p className="stitch-alert-warning">{formatChooseCompanyBlockedCopy()}</p>
        </AdminShell>
      );
    }

    const { cookieHeader, companies } = workspace;
    const selectedCompany = companies.find((company) => company.id === query.companyId) ?? workspace.selectedCompany;
    const invoiceQuery = buildClientInvoiceListQuery({});

    const [settings, summary, outstandingInvoices, debtors, invoices] = await Promise.all([
      apiGet<CompanyBillingSettingsRecord>(
        `/company-operations/companies/${selectedCompany.id}/billing-settings`,
        cookieHeader
      ),
      apiGet<BillingSummaryRecord>(
        `/company-operations/companies/${selectedCompany.id}/billing-summary`,
        cookieHeader
      ),
      apiGet<OutstandingInvoiceRecord[]>(
        `/company-operations/companies/${selectedCompany.id}/outstanding-invoices`,
        cookieHeader
      ),
      apiGet<CompanyDebtorRecord[]>(
        `/company-operations/companies/${selectedCompany.id}/debtors`,
        cookieHeader
      ),
      apiGet<ClientInvoiceListRecord[]>(
        `/company-operations/companies/${selectedCompany.id}/client-invoices${invoiceQuery}`,
        cookieHeader
      )
    ]);

    return (
      <AdminShell
        title={BILLING_SETTINGS_PAGE_TITLE}
        description={BILLING_SETTINGS_PAGE_DESCRIPTION}
        actions={<span className="stitch-chip-inactive">{selectedCompany.name}</span>}
      >
        <BillingSectionNav />
        <BillingSettingsWorkspace
          companies={companies}
          selectedCompany={selectedCompany}
          data={{ settings, summary, outstandingInvoices, debtors }}
          invoices={invoices}
        />
      </AdminShell>
    );
  } catch (error) {
    if (error instanceof WorkspaceApiError && error.status === 401) {
      redirect("/login");
    }

    const apiUnreachable = error instanceof WorkspaceApiError && error.status === 0;

    return (
      <AdminShell title={BILLING_SETTINGS_PAGE_TITLE} description={BILLING_SETTINGS_PAGE_DESCRIPTION}>
        <p className="stitch-alert-error">
          {apiUnreachable
            ? "Unable to reach the API. Start the API service and refresh this page."
            : "Unable to load billing settings right now."}
        </p>
      </AdminShell>
    );
  }
}
