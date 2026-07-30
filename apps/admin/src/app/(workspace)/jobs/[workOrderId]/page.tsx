import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminShell } from "../../../../components/admin-shell";
import { JobsSectionNav } from "../../../../components/jobs-section-nav";
import { WorkOrderDetailContent } from "../../../../components/work-order-detail-content";
import { WorkOrderStatusBadge } from "../../../../components/work-order-status-badge";
import { formatChooseCompanyBlockedCopy } from "../../../../lib/auth-utils";
import type { EmployeeRecord } from "../../../../lib/employee-utils";
import { JOBS_MODULE_DESCRIPTION } from "../../../../lib/operations-module-copy";
import { jobsRoute } from "../../../../lib/jobs-utils";
import type { ServiceCatalogListRecord } from "../../../../lib/service-catalog-utils";
import type { CompanyAccessContext } from "../../../../lib/supervisor-scope-utils";
import type { WorkOrderListRecord } from "../../../../lib/work-order-utils";
import { apiGet, loadWorkspaceContext, WorkspaceApiError } from "../../../../lib/workspace-auth";

type JobDetailPageProps = {
  readonly params: Promise<{ workOrderId: string }>;
};

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { workOrderId } = await params;

  try {
    const workspace = await loadWorkspaceContext();

    if (workspace.blocked) {
      return (
        <AdminShell title="Job detail" description="Company job details">
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {formatChooseCompanyBlockedCopy()}
          </p>
        </AdminShell>
      );
    }

    const { cookieHeader, session, selectedCompany } = workspace;

    const accessContext = await apiGet<CompanyAccessContext>(
      `/company-operations/companies/${selectedCompany.id}/access-context`,
      cookieHeader
    );

    const [workOrder, employees, catalogItems] = await Promise.all([
      apiGet<WorkOrderListRecord>(`/company-operations/work-orders/${workOrderId}`, cookieHeader),
      accessContext.canManageCompany
        ? apiGet<EmployeeRecord[]>(
            `/company-operations/companies/${selectedCompany.id}/employees?includeArchived=false`,
            cookieHeader
          )
        : Promise.resolve([] as EmployeeRecord[]),
      accessContext.canManageCompany
        ? apiGet<ServiceCatalogListRecord[]>(
            `/company-operations/companies/${selectedCompany.id}/service-catalog`,
            cookieHeader
          )
        : Promise.resolve([] as ServiceCatalogListRecord[])
    ]);

    if (workOrder.companyId !== selectedCompany.id) {
      notFound();
    }

    return (
      <AdminShell
        title={workOrder.workOrderNumber}
        description={JOBS_MODULE_DESCRIPTION}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <WorkOrderStatusBadge status={workOrder.status} />
            <Link
              href={jobsRoute()}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back to jobs
            </Link>
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
              {session.user.email}
            </span>
          </div>
        }
      >
        <JobsSectionNav />
        <WorkOrderDetailContent
          workOrder={workOrder}
          companyName={selectedCompany.name}
          employees={employees}
          catalogItems={catalogItems}
          canManageAssignments={accessContext.canManageCompany}
        />
      </AdminShell>
    );
  } catch (error) {
    if (error instanceof WorkspaceApiError && (error.status === 403 || error.status === 404)) {
      notFound();
    }

    return (
      <AdminShell title="Job detail" description="Company job details">
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Unable to load this job right now.
        </p>
        <Link href={jobsRoute()} className="mt-4 inline-block text-sm font-medium text-brand-700 hover:underline">
          Back to jobs
        </Link>
      </AdminShell>
    );
  }
}
