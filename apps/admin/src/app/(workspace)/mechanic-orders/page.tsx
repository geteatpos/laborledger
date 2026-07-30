import { AdminShell } from "../../../components/admin-shell";
import { MechanicOrdersWorkspace } from "../../../components/mechanic-orders-workspace";
import { apiGet, loadWorkspaceContext, WorkspaceApiError } from "../../../lib/workspace-auth";
import { formatChooseCompanyBlockedCopy } from "../../../lib/auth-utils";
import type { CompanyAccessContext } from "../../../lib/supervisor-scope-utils";

type MechanicOrdersPageProps = {
  readonly searchParams?: Promise<{
    status?: string;
  }>;
};

type MechanicOrderRow = {
  id: string;
  workOrderNumber: string;
  status: string;
  createdAt: string;
  vehicle: {
    id: string;
    vin: string;
    year: number | null;
    make: string | null;
    model: string | null;
    plate: string | null;
    color: string | null;
  };
  mechanicParts: Array<{ id: string }>;
  mechanicApproval: {
    status: string;
    note: string | null;
    contactMethod: string | null;
    decidedAt: string | null;
    createdAt: string;
    supervisor: { id: string; fullName: string | null; email: string } | null;
  } | null;
};

type MechanicOrdersListResponse = MechanicOrderRow[];

function resolveStatus(status?: string): "PENDING" | "APPROVED" | "REJECTED" | "ALL" {
  if (status === "APPROVED") return "APPROVED";
  if (status === "REJECTED") return "REJECTED";
  if (status === "ALL") return "ALL";
  return "PENDING";
}

export default async function MechanicOrdersPage({ searchParams }: MechanicOrdersPageProps) {
  const query = (await searchParams) ?? {};
  const statusFilter = resolveStatus(query.status);

  try {
    const workspace = await loadWorkspaceContext();

    if (workspace.blocked) {
      return (
        <AdminShell title="Mechanic Orders" description="Work orders the team flagged for mechanic review.">
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {formatChooseCompanyBlockedCopy()}
          </p>
        </AdminShell>
      );
    }

    const { cookieHeader, selectedCompany } = workspace;

    const [accessContext, response] = await Promise.all([
      apiGet<CompanyAccessContext>(
        `/company-operations/companies/${selectedCompany.id}/access-context`,
        cookieHeader
      ),
      apiGet<MechanicOrdersListResponse>(
        `/company-operations/${encodeURIComponent(selectedCompany.id)}/mechanic-orders?status=${encodeURIComponent(statusFilter)}`,
        cookieHeader
      ).catch((error: unknown) => {
        if (error instanceof WorkspaceApiError) {
          console.error(
            `[mechanic-orders] apiGet failed: status=${error.status} message=${error.message}`
          );
          return [] as MechanicOrdersListResponse;
        }
        console.error(`[mechanic-orders] non-WorkspaceApiError:`, error);
        throw error;
      })
    ]);

    // API returns a flat array (not `{ orders: [...] }`). Normalize defensively.
    const orders = Array.isArray(response) ? response : [];

    return (
      <AdminShell
        title="Mechanic Orders"
        description="Work orders the team flagged for mechanic review. Approve or reject with a contact note."
      >
        <MechanicOrdersWorkspace
          companyId={selectedCompany.id}
          statusFilter={statusFilter}
          orders={orders}
          accessLevel={accessContext.accessLevel}
        />
      </AdminShell>
    );
  } catch (error) {
    if (error instanceof WorkspaceApiError && error.status === 403) {
      return (
        <AdminShell title="Mechanic Orders" description="Work orders the team flagged for mechanic review.">
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            You do not have access to mechanic orders for this company.
          </p>
        </AdminShell>
      );
    }

    return (
      <AdminShell title="Mechanic Orders" description="Work orders the team flagged for mechanic review.">
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Unable to load mechanic orders right now. Check that the API is running and try again.
        </p>
      </AdminShell>
    );
  }
}
