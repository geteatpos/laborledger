import { AdminShell } from "../../components/admin-shell";
import { DashboardAlerts } from "../../components/dashboard-alerts";
import { DashboardMetricCard } from "../../components/dashboard-metric-card";
import { DashboardQuickActions } from "../../components/dashboard-quick-actions";
import { FinancialDashboardSection } from "../../components/financial-dashboard-section";
import { formatChooseCompanyBlockedCopy } from "../../lib/auth-utils";
import type { CompanyDashboardResponse } from "../../lib/dashboard-utils";
import {
  formatDashboardDate,
  formatDashboardMetric,
  formatWeekRange
} from "../../lib/dashboard-utils";
import {
  apiGet,
  loadWorkspaceContext,
  WorkspaceApiError
} from "../../lib/workspace-auth";

function WeeklyCloseBadge({
  status,
  canClose,
  blockerCount
}: {
  readonly status: "OPEN" | "CLOSED" | null;
  readonly canClose: boolean | null;
  readonly blockerCount: number | null;
}) {
  if (status === null) {
    return null;
  }

  if (status === "CLOSED") {
    return (
      <span className="rounded-full bg-surface-variant px-2.5 py-0.5 text-xs font-medium text-on-surface-variant">
        Closed
      </span>
    );
  }

  if (canClose) {
    return (
      <span className="rounded-full bg-primary-container px-2.5 py-0.5 text-xs font-medium text-primary status-glow-blue">
        Ready to close
      </span>
    );
  }

  return (
    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-warning status-glow-orange">
      {blockerCount ?? 0} blocker{(blockerCount ?? 0) === 1 ? "" : "s"}
    </span>
  );
}

type DashboardPageProps = {
  readonly searchParams?: Promise<{ companyId?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  try {
    const query = (await searchParams) ?? {};
    const workspace = await loadWorkspaceContext();

    if (workspace.blocked) {
      return (
        <AdminShell
          title="Dashboard"
          description="Overview of workforce activity and daily operations."
        >
          <p className="stitch-alert-warning">
            {formatChooseCompanyBlockedCopy()}
          </p>
        </AdminShell>
      );
    }

    const { cookieHeader, companies } = workspace;
    const selectedCompany =
      companies.find((company) => company.id === query.companyId) ?? workspace.selectedCompany;

    const dashboard = await apiGet<CompanyDashboardResponse>(
      `/company-operations/companies/${selectedCompany.id}/dashboard`,
      cookieHeader
    );

    const { today, thisWeek } = dashboard;

    return (
      <AdminShell
        title="Dashboard"
        description="Overview of workforce activity and daily operations."
      >
        <div className="space-y-8">
          <FinancialDashboardSection
            companyId={selectedCompany.id}
            companyName={selectedCompany.name}
            canManageCompany={dashboard.canManageCompany}
            companies={companies.map((company) => ({ id: company.id, name: company.name }))}
          />

          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="stitch-section-title text-body-sm">Today overview</h2>
                <p className="mt-1 text-body-sm text-on-surface-variant">{formatDashboardDate(dashboard.todayDate)}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <DashboardMetricCard
                label="Clocked in now"
                value={formatDashboardMetric(today.clockedInNowCount)}
                tone={today.clockedInNowCount > 0 ? "accent" : "default"}
              />
              <DashboardMetricCard
                label="Pending approvals"
                value={formatDashboardMetric(today.pendingReviewCount)}
                tone={today.pendingReviewCount > 0 ? "warning" : "default"}
              />
              <DashboardMetricCard
                label="Needs correction"
                value={formatDashboardMetric(today.needsCorrectionCount)}
                tone={today.needsCorrectionCount > 0 ? "warning" : "default"}
              />
              <DashboardMetricCard
                label="Open jobs"
                value={formatDashboardMetric(today.openWorkOrdersCount)}
              />
              <DashboardMetricCard
                label="Vehicles received today"
                value={formatDashboardMetric(today.vehiclesReceivedTodayCount)}
              />
              <DashboardMetricCard
                label="Completed jobs today"
                value={formatDashboardMetric(today.completedWorkOrdersTodayCount)}
              />
              {dashboard.canManageCompany ? (
                <>
                  <DashboardMetricCard
                    label="Active employees"
                    value={formatDashboardMetric(today.activeEmployeesCount)}
                  />
                  <DashboardMetricCard
                    label="Pending supervisor invites"
                    value={formatDashboardMetric(today.pendingInvitesCount)}
                  />
                </>
              ) : null}
            </div>
          </section>

          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="stitch-section-title text-body-sm">This week overview</h2>
                <p className="mt-1 text-body-sm text-on-surface-variant">
                  {formatWeekRange(thisWeek.weekStart, thisWeek.weekEnd)}
                </p>
              </div>
              {dashboard.canManageCompany ? (
                <WeeklyCloseBadge
                  status={thisWeek.weeklyCloseStatus}
                  canClose={thisWeek.weeklyCloseCanClose}
                  blockerCount={thisWeek.weeklyCloseBlockerCount}
                />
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <DashboardMetricCard
                label="Shifts needing review"
                value={formatDashboardMetric(thisWeek.pendingReviewCount)}
              />
              <DashboardMetricCard
                label="Incomplete shifts"
                value={formatDashboardMetric(thisWeek.incompleteShiftsCount)}
              />
              <DashboardMetricCard
                label="Corrections pending"
                value={formatDashboardMetric(thisWeek.needsCorrectionCount)}
              />
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <DashboardAlerts alerts={dashboard.alerts} />
            <DashboardQuickActions />
          </div>
        </div>
      </AdminShell>
    );
  } catch (error) {
    if (error instanceof WorkspaceApiError && error.status === 403) {
      return (
        <AdminShell
          title="Dashboard"
          description="Overview of workforce activity and daily operations."
        >
          <p className="glass-panel rounded-stitch px-4 py-3 text-body-sm text-on-surface-variant">
            You do not have access to this company dashboard.
          </p>
        </AdminShell>
      );
    }

    throw error;
  }
}
