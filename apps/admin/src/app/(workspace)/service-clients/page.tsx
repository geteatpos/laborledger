import { redirect } from "next/navigation";

import { AdminShell } from "../../../components/admin-shell";
import { DashboardMetricCard } from "../../../components/dashboard-metric-card";
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

function isWithinLast30Days(dateString: string): boolean {
  const date = new Date(dateString);
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return date >= thirtyDaysAgo;
}

function computeCustomerStats(clients: ServiceClientListRecord[]) {
  const total = clients.length;
  const active = clients.filter((c) => !c.archivedAt).length;
  const newLeads = clients.filter((c) => isWithinLast30Days(c.createdAt)).length;
  const retentionRate = total > 0 ? ((active / total) * 100).toFixed(1) : "0.0";
  return { total, active, newLeads, retentionRate };
}

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
    const stats = computeCustomerStats(serviceClients);

    return (
      <AdminShell
        title={CUSTOMERS_MODULE_TITLE}
        description={CUSTOMERS_MODULE_DESCRIPTION}
        actions={
          <span className="stitch-card px-3 py-1.5 text-sm font-medium text-on-surface">
            {clientViews.length} {clientViews.length === 1 ? "customer" : "customers"}
          </span>
        }
      >
        <ReceptionSectionNav />
        <EmployeesModuleIntro help={CUSTOMERS_RELATIONSHIP_COPY}>
          {CUSTOMERS_MODULE_DESCRIPTION}
        </EmployeesModuleIntro>

        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <DashboardMetricCard label="Total Customers" value={String(stats.total)} />
          <DashboardMetricCard
            label="Active this month"
            value={String(stats.active)}
            tone="accent"
          />
          <DashboardMetricCard label="New Leads" value={String(stats.newLeads)} tone="accent" />
          <DashboardMetricCard label="Retention Rate" value={`${stats.retentionRate}%`} />
        </div>

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
