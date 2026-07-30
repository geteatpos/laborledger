import { redirect } from "next/navigation";

import { AdminShell } from "../../../components/admin-shell";
import { ClientInvoicesWorkspace } from "../../../components/client-invoices-workspace";
import {
  buildClientInvoiceListQuery,
  type ClientInvoiceListRecord,
  type ClientInvoiceStatus
} from "../../../lib/client-invoice-utils";
import {
  CLIENT_INVOICES_MODULE_DESCRIPTION,
  CLIENT_INVOICES_MODULE_TITLE
} from "../../../lib/billing-module-copy";
import {
  getBillingCompletenessIssues,
  type CompanyBillingSettingsRecord
} from "../../../lib/billing-dashboard-utils";
import type { ServiceClientRecord } from "../../../lib/location-utils";
import { formatChooseCompanyBlockedCopy } from "../../../lib/auth-utils";
import {
  apiGet,
  loadWorkspaceContext,
  WorkspaceApiError
} from "../../../lib/workspace-auth";

type ClientInvoicesPageProps = {
  readonly searchParams?: Promise<{
    companyId?: string;
    status?: string;
    q?: string;
    serviceClientId?: string;
  }>;
};

function resolveStatusFilter(status?: string): ClientInvoiceStatus | "" {
  if (status === "DRAFT" || status === "ISSUED" || status === "VOID") {
    return status;
  }

  return "";
}

export default async function ClientInvoicesPage({ searchParams }: ClientInvoicesPageProps) {
  try {
    const query = (await searchParams) ?? {};
    const statusFilter = resolveStatusFilter(query.status);
    const workspace = await loadWorkspaceContext();

    if (workspace.blocked) {
      return (
        <AdminShell
          title={CLIENT_INVOICES_MODULE_TITLE}
          description={CLIENT_INVOICES_MODULE_DESCRIPTION}
        >
          <p className="stitch-alert-warning">
            {formatChooseCompanyBlockedCopy()}
          </p>
        </AdminShell>
      );
    }

    const { cookieHeader, selectedCompany, companies } = workspace;

    const listQuery = buildClientInvoiceListQuery({
      ...(query.serviceClientId ? { serviceClientId: query.serviceClientId } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(query.q?.trim() ? { q: query.q.trim() } : {})
    });

    const [invoices, serviceClients, billingSettings] = await Promise.all([
      apiGet<ClientInvoiceListRecord[]>(
        `/company-operations/companies/${selectedCompany.id}/client-invoices${listQuery}`,
        cookieHeader
      ),
      apiGet<ServiceClientRecord[]>(
        `/company-operations/companies/${selectedCompany.id}/service-clients`,
        cookieHeader
      ),
      apiGet<CompanyBillingSettingsRecord>(
        `/company-operations/companies/${selectedCompany.id}/billing-settings`,
        cookieHeader
      )
    ]);
    const billingCompletenessIssues = getBillingCompletenessIssues({
      company: selectedCompany,
      settings: billingSettings
    });
    const issueBlockedReason = billingCompletenessIssues.length
      ? `Completa Billing Settings antes de emitir: ${billingCompletenessIssues
          .map((issue) => issue.label)
          .join(", ")}.`
      : null;

    return (
      <AdminShell
        title={CLIENT_INVOICES_MODULE_TITLE}
        description={CLIENT_INVOICES_MODULE_DESCRIPTION}
        actions={
          <span className="stitch-chip-inactive">
            {invoices.length} {invoices.length === 1 ? "factura" : "facturas"}
          </span>
        }
      >
        <ClientInvoicesWorkspace
          companies={companies}
          selectedCompany={selectedCompany}
          invoices={invoices}
          serviceClients={serviceClients}
          initialQuery={query.q ?? ""}
          initialStatus={statusFilter}
          initialServiceClientId={query.serviceClientId ?? ""}
          issueBlockedReason={issueBlockedReason}
        />
      </AdminShell>
    );
  } catch (error) {
    if (error instanceof WorkspaceApiError && error.status === 401) {
      redirect("/login");
    }

    const apiUnreachable = error instanceof WorkspaceApiError && error.status === 0;

    return (
      <AdminShell
        title={CLIENT_INVOICES_MODULE_TITLE}
        description={CLIENT_INVOICES_MODULE_DESCRIPTION}
      >
        <p className="stitch-alert-error">
          {apiUnreachable
            ? "Unable to reach the API. Start the API service and refresh this page."
            : "Unable to load client invoices right now."}
        </p>
      </AdminShell>
    );
  }
}
