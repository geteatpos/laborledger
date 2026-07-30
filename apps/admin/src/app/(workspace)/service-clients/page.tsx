import { redirect } from "next/navigation";

import { AdminShell } from "../../../components/admin-shell";
import { EmployeesModuleIntro } from "../../../components/employees-module-intro";
import { ReceptionSectionNav } from "../../../components/reception-section-nav";
import { ServiceClientsWorkspace } from "../../../components/service-clients-workspace";
import {
  CUSTOMERS_MODULE_DESCRIPTION,
  CUSTOMERS_MODULE_TITLE,
  CUSTOMERS_RELATIONSHIP_COPY
} from "../../../lib/operations-module-copy";
import type { LocationRecord } from "../../../lib/location-utils";
import {
  enrichServiceClientsWithLocationCounts,
  type ServiceClientListRecord
} from "../../../lib/service-client-utils";
import { formatChooseCompanyBlockedCopy } from "../../../lib/auth-utils";
import type { CompanyAccessContext } from "../../../lib/supervisor-scope-utils";
import {
  API_BASE_URL,
  apiGet,
  loadWorkspaceContext,
  WorkspaceApiError
} from "../../../lib/workspace-auth";

type ServiceClientsPageProps = {
  readonly searchParams?: Promise<{
    companyId?: string;
    status?: string;
    q?: string;
  }>;
};

function resolveStatusFilter(status?: string): "active" | "inactive" | "all" {
  if (status === "inactive" || status === "all") {
    return status;
  }

  return "active";
}

export default async function ServiceClientsPage({ searchParams }: ServiceClientsPageProps) {
  try {
    const query = (await searchParams) ?? {};
    const statusFilter = resolveStatusFilter(query.status);
    const includeArchived = statusFilter === "inactive" || statusFilter === "all";
    const workspace = await loadWorkspaceContext();

    if (workspace.blocked) {
      return (
        <AdminShell title={CUSTOMERS_MODULE_TITLE} description={CUSTOMERS_MODULE_DESCRIPTION}>
          <ReceptionSectionNav />
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {formatChooseCompanyBlockedCopy()}
          </p>
        </AdminShell>
      );
    }

    const { cookieHeader, selectedCompany, companies } = workspace;

    const accessContext = await apiGet<CompanyAccessContext>(
      `/company-operations/companies/${selectedCompany.id}/access-context`,
      cookieHeader
    );

    const [serviceClients, locations] = await Promise.all([
      apiGet<ServiceClientListRecord[]>(
        `/company-operations/companies/${selectedCompany.id}/service-clients?includeArchived=${includeArchived ? "true" : "false"}`,
        cookieHeader
      ),
      apiGet<LocationRecord[]>(
        `/company-operations/companies/${selectedCompany.id}/locations?includeArchived=true`,
        cookieHeader
      )
    ]);

    const visibleClients =
      statusFilter === "inactive"
        ? serviceClients.filter((client) => client.archivedAt)
        : statusFilter === "active"
          ? serviceClients.filter((client) => !client.archivedAt)
          : serviceClients;

    const clientViews = enrichServiceClientsWithLocationCounts(visibleClients, locations);

    return (
      <AdminShell
        title={CUSTOMERS_MODULE_TITLE}
        description={CUSTOMERS_MODULE_DESCRIPTION}
        actions={
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
            {clientViews.length} {clientViews.length === 1 ? "customer" : "customers"}
          </span>
        }
      >
        <ReceptionSectionNav />
        <EmployeesModuleIntro help={CUSTOMERS_RELATIONSHIP_COPY}>
          {CUSTOMERS_MODULE_DESCRIPTION}
        </EmployeesModuleIntro>
        <ServiceClientsWorkspace
          companies={companies}
          selectedCompany={selectedCompany}
          serviceClients={clientViews}
          locations={locations}
          initialQuery={query.q ?? ""}
          initialStatus={statusFilter}
          canManageCompany={accessContext.canManageCompany}
        />
      </AdminShell>
    );
  } catch (error) {
    if (error instanceof WorkspaceApiError && error.status === 401) {
      redirect("/login");
    }

    const apiUnreachable = error instanceof WorkspaceApiError && error.status === 0;

    return (
      <AdminShell title={CUSTOMERS_MODULE_TITLE} description={CUSTOMERS_MODULE_DESCRIPTION}>
        <ReceptionSectionNav />
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {apiUnreachable ? (
            <>
              The API at <code className="font-mono">{API_BASE_URL}</code> is not reachable. Start it with{" "}
              <code className="font-mono">pnpm dev</code> from the repo root.
            </>
          ) : (
            <>Check that the API is running and that your session is valid.</>
          )}
        </p>
      </AdminShell>
    );
  }
}
