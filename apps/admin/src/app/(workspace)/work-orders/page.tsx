import { redirect } from "next/navigation";

import { AdminShell } from "../../../components/admin-shell";
import { EmployeesModuleIntro } from "../../../components/employees-module-intro";
import { JobsSectionNav } from "../../../components/jobs-section-nav";
import { WorkOrdersWorkspace } from "../../../components/work-orders-workspace";
import type { EmployeeRecord } from "../../../lib/employee-utils";
import type { LocationRecord, ServiceClientRecord } from "../../../lib/location-utils";
import {
  WORK_ORDERS_MODULE_DESCRIPTION,
  WORK_ORDERS_MODULE_TITLE,
  WORK_ORDERS_RECEPTION_HELPER
} from "../../../lib/operations-module-copy";
import type { ServiceCatalogListRecord } from "../../../lib/service-catalog-utils";
import { formatChooseCompanyBlockedCopy } from "../../../lib/auth-utils";
import {
  buildWorkOrderListQuery,
  WORK_ORDER_STATUS_OPTIONS,
  type WorkOrderListRecord,
  type WorkOrderStatus
} from "../../../lib/work-order-utils";
import type { VehicleListRecord } from "../../../lib/vehicle-utils";
import {
  API_BASE_URL,
  apiGet,
  loadWorkspaceContext,
  WorkspaceApiError
} from "../../../lib/workspace-auth";

type WorkOrdersPageProps = {
  readonly searchParams?: Promise<{
    companyId?: string;
    status?: string;
    q?: string;
    serviceClientId?: string;
    locationId?: string;
  }>;
};

function resolveStatusFilter(status?: string): WorkOrderStatus | "" {
  if (status && WORK_ORDER_STATUS_OPTIONS.includes(status as WorkOrderStatus)) {
    return status as WorkOrderStatus;
  }

  return "";
}

export default async function WorkOrdersPage({ searchParams }: WorkOrdersPageProps) {
  try {
    const query = (await searchParams) ?? {};
    const statusFilter = resolveStatusFilter(query.status);
    const workspace = await loadWorkspaceContext();

    if (workspace.blocked) {
      return (
        <AdminShell title={WORK_ORDERS_MODULE_TITLE} description={WORK_ORDERS_MODULE_DESCRIPTION}>
          <JobsSectionNav />
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {formatChooseCompanyBlockedCopy()}
          </p>
        </AdminShell>
      );
    }

    const { cookieHeader, selectedCompany, companies } = workspace;

    const listQuery = buildWorkOrderListQuery({
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(query.serviceClientId ? { serviceClientId: query.serviceClientId } : {}),
      ...(query.locationId ? { locationId: query.locationId } : {}),
      ...(query.q?.trim() ? { q: query.q.trim() } : {})
    });

    const [workOrders, vehicles, catalogItems, serviceClients, locations, employees] = await Promise.all([
      apiGet<WorkOrderListRecord[]>(
        `/company-operations/companies/${selectedCompany.id}/work-orders${listQuery}`,
        cookieHeader
      ),
      apiGet<VehicleListRecord[]>(
        `/company-operations/companies/${selectedCompany.id}/vehicles`,
        cookieHeader
      ),
      apiGet<ServiceCatalogListRecord[]>(
        `/company-operations/companies/${selectedCompany.id}/service-catalog?includeArchived=false`,
        cookieHeader
      ),
      apiGet<ServiceClientRecord[]>(
        `/company-operations/companies/${selectedCompany.id}/service-clients?includeArchived=true`,
        cookieHeader
      ),
      apiGet<LocationRecord[]>(
        `/company-operations/companies/${selectedCompany.id}/locations?includeArchived=true`,
        cookieHeader
      ),
      apiGet<EmployeeRecord[]>(
        `/company-operations/companies/${selectedCompany.id}/employees?includeArchived=false`,
        cookieHeader
      )
    ]);

    return (
      <AdminShell
        title={WORK_ORDERS_MODULE_TITLE}
        description={WORK_ORDERS_MODULE_DESCRIPTION}
        actions={
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
            {workOrders.length} {workOrders.length === 1 ? "work order" : "work orders"}
          </span>
        }
      >
        <JobsSectionNav />
        <EmployeesModuleIntro help={WORK_ORDERS_RECEPTION_HELPER}>
          {WORK_ORDERS_MODULE_DESCRIPTION}
        </EmployeesModuleIntro>
        <WorkOrdersWorkspace
          companies={companies}
          selectedCompany={selectedCompany}
          workOrders={workOrders}
          vehicles={vehicles}
          catalogItems={catalogItems}
          serviceClients={serviceClients}
          locations={locations}
          employees={employees}
          initialQuery={query.q ?? ""}
          initialStatus={statusFilter}
          initialServiceClientId={query.serviceClientId ?? ""}
          initialLocationId={query.locationId ?? ""}
        />
      </AdminShell>
    );
  } catch (error) {
    if (error instanceof WorkspaceApiError && error.status === 401) {
      redirect("/login");
    }

    const apiUnreachable = error instanceof WorkspaceApiError && error.status === 0;

    return (
      <AdminShell title={WORK_ORDERS_MODULE_TITLE} description={WORK_ORDERS_MODULE_DESCRIPTION}>
        <JobsSectionNav />
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
