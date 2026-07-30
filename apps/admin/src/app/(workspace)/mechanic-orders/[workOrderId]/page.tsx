import { AdminShell } from "../../../../components/admin-shell";
import { MechanicOrderDetailPanel } from "../../../../components/mechanic-order-detail-panel";
import { apiGet, loadWorkspaceContext, WorkspaceApiError } from "../../../../lib/workspace-auth";
import { formatChooseCompanyBlockedCopy } from "../../../../lib/auth-utils";
import type { CompanyAccessContext } from "../../../../lib/supervisor-scope-utils";

type DetailPageProps = {
  readonly params: Promise<{
    workOrderId: string;
  }>;
};

type MechanicApproval = {
  status: string;
  note: string | null;
  contactMethod: string | null;
  decidedAt: string | null;
  createdAt: string;
  supervisor: { id: string; fullName: string | null; email: string } | null;
};

type MechanicPartRecord = {
  id: string;
  name: string;
  quantity: number;
  notes: string | null;
  positionOrder: number;
  photoId: string | null;
  identifiedName: string | null;
  identifiedPartNumber: string | null;
  identifiedAt: string | null;
};

type MechanicOrderDetail = {
  id: string;
  workOrderNumber: string;
  status: string;
  vehicle: {
    id: string;
    vin: string;
    year: number | null;
    make: string | null;
    model: string | null;
    plate: string | null;
    color: string | null;
  };
  mechanicParts: MechanicPartRecord[];
  mechanicApproval: MechanicApproval | null;
};

export default async function MechanicOrderDetailPage({ params }: DetailPageProps) {
  const { workOrderId } = await params;

  try {
    const workspace = await loadWorkspaceContext();
    if (workspace.blocked) {
      return (
        <AdminShell title="Mechanic Order" description="Review mechanic parts and approve or reject.">
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {formatChooseCompanyBlockedCopy()}
          </p>
        </AdminShell>
      );
    }

    const { cookieHeader, selectedCompany } = workspace;

    const [accessContext, order] = await Promise.all([
      apiGet<CompanyAccessContext>(
        `/company-operations/companies/${selectedCompany.id}/access-context`,
        cookieHeader
      ),
      apiGet<MechanicOrderDetail>(
        `/company-operations/${encodeURIComponent(selectedCompany.id)}/mechanic-orders/${encodeURIComponent(workOrderId)}`,
        cookieHeader
      ).catch((error: unknown) => {
        if (error instanceof WorkspaceApiError) {
          if (error.status === 404) {
            return null;
          }
          throw error;
        }
        throw error;
      })
    ]);

    if (!order) {
      return (
        <AdminShell title="Mechanic Order" description="Review mechanic parts and approve or reject.">
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Mechanic order not found.
          </p>
        </AdminShell>
      );
    }

    const isApproved = order.status === "ASSIGNED";
    const isRejected = order.status === "MECHANIC_REJECTED";
    const isPending = order.status === "PENDING_MECHANIC_APPROVAL";

    return (
      <AdminShell
        title="Mechanic Order"
        description={`${order.vehicle.year ?? ""} ${order.vehicle.make ?? ""} ${order.vehicle.model ?? ""} · ${order.workOrderNumber}`.trim()}
      >
        <MechanicOrderDetailPanel
          workOrderId={order.id}
          accessLevel={accessContext.accessLevel}
          canDecide={isPending}
          order={{
            id: order.id,
            workOrderNumber: order.workOrderNumber,
            status: order.status,
            isApproved,
            isRejected,
            vehicle: order.vehicle,
            parts: order.mechanicParts,
            approval: order.mechanicApproval
          }}
        />
      </AdminShell>
    );
  } catch (error) {
    if (error instanceof WorkspaceApiError && error.status === 403) {
      return (
        <AdminShell title="Mechanic Order" description="Review mechanic parts and approve or reject.">
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            You do not have access to this mechanic order.
          </p>
        </AdminShell>
      );
    }
    return (
      <AdminShell title="Mechanic Order" description="Review mechanic parts and approve or reject.">
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Unable to load mechanic order right now.
        </p>
      </AdminShell>
    );
  }
}
