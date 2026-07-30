import { Inject, Injectable } from "@nestjs/common";
import {
  CompanyRole,
  CorrectionStatus,
  MembershipStatus,
  ShiftStatus,
  WeeklyPeriodStatus,
  WorkOrderStatus,
  type Prisma
} from "@prisma/client";

import type { AuthenticatedPrincipal } from "../identity-access/auth.types";
import { CompanyScopeService } from "../identity-access/company-scope.service";
import { PrismaService } from "../identity-access/prisma.service";
import {
  buildEffectivePunchEvents,
  mapAppliedCorrections
} from "../corrections/punch-corrections";
import { findActiveClockedInShift } from "../labor-work-assignment/labor-work-assignment.utils";
import { resolveOperationsReportDateRange } from "../operations-reports/operations-reports-date-range";
import { buildShiftReview } from "../shift-review/shift-review";
import {
  computeWeekEndLocalDate,
  parseWeekStartLocalDate,
  resolveCompanyCloseTimeZone,
  weekRangeToUtcBounds
} from "../weekly-close/week-period";

import type {
  CompanyDashboardResponse,
  DashboardAlert,
  DashboardMetrics
} from "./company-dashboard.types";

const OPEN_WORK_ORDER_STATUSES: WorkOrderStatus[] = [
  WorkOrderStatus.DRAFT,
  WorkOrderStatus.READY,
  WorkOrderStatus.ASSIGNED,
  WorkOrderStatus.IN_PROGRESS
];

const IN_PROGRESS_WORK_ORDER_STATUSES: WorkOrderStatus[] = [
  WorkOrderStatus.ASSIGNED,
  WorkOrderStatus.IN_PROGRESS
];

const COMPLETED_WORK_ORDER_STATUSES: WorkOrderStatus[] = [
  WorkOrderStatus.COMPLETED,
  WorkOrderStatus.INVOICED
];

const shiftReviewSelect = {
  id: true,
  employeeId: true,
  approvedAt: true,
  additionalTimeApprovedAt: true,
  scheduledEndUtc: true,
  scheduledStartUtc: true,
  punchEvents: { orderBy: { eventUtc: "asc" as const } },
  punchCorrections: true
} satisfies Prisma.ShiftSelect;

type ShiftReviewRow = Prisma.ShiftGetPayload<{ select: typeof shiftReviewSelect }>;

@Injectable()
export class CompanyDashboardService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CompanyScopeService) private readonly companyScopeService: CompanyScopeService
  ) {}

  async getDashboard(
    principal: AuthenticatedPrincipal,
    companyId: string,
    query: { date?: string }
  ): Promise<CompanyDashboardResponse> {
    const access = await this.companyScopeService.getCompanyAccessContext(principal, companyId);
    const todayRange = resolveOperationsReportDateRange(query.date, query.date);
    const weekStart = parseWeekStartLocalDate();
    const weekEnd = computeWeekEndLocalDate(weekStart);

    const locations = await this.prisma.location.findMany({
      where: { companyId },
      select: { id: true, timezone: true, archivedAt: true }
    });
    const closeTimeZone = resolveCompanyCloseTimeZone(locations);
    const weekBounds = weekRangeToUtcBounds(weekStart, closeTimeZone);

    const locationScope = this.companyScopeService.buildLocationIdFilter(access);
    const workOrderLocationScope = this.buildWorkOrderLocationFilter(access);

    const [
      activeEmployeesCount,
      pendingInvitesCount,
      pendingCorrectionsCount,
      openWorkOrdersCount,
      inProgressWorkOrdersCount,
      vehiclesReceivedTodayCount,
      completionsToday,
      reviewShifts,
      weekReviewShifts,
      weekPendingCorrectionsCount,
      weeklyPeriod,
      clockedInCandidateShifts
    ] = await Promise.all([
      access.canManageCompany
        ? this.prisma.employee.count({ where: { companyId, archivedAt: null } })
        : Promise.resolve(null),
      access.canManageCompany
        ? this.prisma.companyMembership.count({
            where: {
              companyId,
              role: CompanyRole.SUPERVISOR,
              status: MembershipStatus.INVITED
            }
          })
        : Promise.resolve(null),
      this.prisma.correctionRequest.count({
        where: {
          companyId,
          status: CorrectionStatus.PENDING,
          ...locationScope
        }
      }),
      this.prisma.workOrder.count({
        where: {
          companyId,
          status: { in: OPEN_WORK_ORDER_STATUSES },
          ...workOrderLocationScope
        }
      }),
      this.prisma.workOrder.count({
        where: {
          companyId,
          status: { in: IN_PROGRESS_WORK_ORDER_STATUSES },
          ...workOrderLocationScope
        }
      }),
      this.prisma.workOrder.count({
        where: {
          companyId,
          ...workOrderLocationScope,
          createdAt: {
            gte: todayRange.fromUtc,
            lt: todayRange.toUtcExclusive
          }
        }
      }),
      this.prisma.serviceCompletion.findMany({
        where: {
          companyId,
          voidedAt: null,
          completedAt: {
            gte: todayRange.fromUtc,
            lt: todayRange.toUtcExclusive
          },
          ...(Object.keys(workOrderLocationScope).length > 0
            ? { workOrder: workOrderLocationScope }
            : {})
        },
        select: {
          workOrderId: true,
          workOrderServiceLineId: true,
          completedAt: true,
          workOrder: {
            select: {
              status: true,
              serviceLines: { select: { id: true } }
            }
          }
        }
      }),
      this.loadReviewShifts(companyId, locationScope),
      this.loadReviewShifts(companyId, locationScope, {
        from: new Date(weekBounds.from),
        to: new Date(weekBounds.to)
      }),
      this.prisma.correctionRequest.count({
        where: {
          companyId,
          status: CorrectionStatus.PENDING,
          ...locationScope,
          shift: {
            scheduledStartUtc: {
              gte: new Date(weekBounds.from),
              lt: new Date(weekBounds.to)
            }
          }
        }
      }),
      access.canManageCompany
        ? this.prisma.weeklyPeriod.findUnique({
            where: {
              companyId_weekStartLocalDate: {
                companyId,
                weekStartLocalDate: weekStart
              }
            },
            select: { status: true }
          })
        : Promise.resolve(null),
      this.prisma.shift.findMany({
        where: {
          companyId,
          status: ShiftStatus.SCHEDULED,
          cancelledAt: null,
          punchEvents: { some: {} },
          ...locationScope
        },
        select: {
          employeeId: true,
          punchEvents: { orderBy: { eventUtc: "asc" as const } }
        },
        orderBy: { scheduledStartUtc: "desc" }
      })
    ]);

    const reviewCounts = this.countReviewStatuses(reviewShifts);
    const weekReviewCounts = this.countReviewStatuses(weekReviewShifts);
    const completedWorkOrdersTodayCount = this.resolveCompletedWorkOrderIds(completionsToday).size;
    const clockedInNowCount = this.countClockedInNow(clockedInCandidateShifts);

    const today: DashboardMetrics = {
      activeEmployeesCount,
      clockedInNowCount,
      pendingReviewCount: reviewCounts.needsReview,
      needsCorrectionCount: pendingCorrectionsCount,
      openWorkOrdersCount,
      inProgressWorkOrdersCount,
      vehiclesReceivedTodayCount,
      completedWorkOrdersTodayCount,
      pendingInvitesCount
    };

    const weeklyCloseStatus = access.canManageCompany
      ? (weeklyPeriod?.status ?? WeeklyPeriodStatus.OPEN)
      : null;
    const weeklyCloseBlockerCount = access.canManageCompany
      ? weekReviewCounts.needsReview +
        weekReviewCounts.incomplete +
        weekPendingCorrectionsCount
      : null;
    const weeklyCloseCanClose = access.canManageCompany
      ? weeklyCloseStatus !== WeeklyPeriodStatus.CLOSED && (weeklyCloseBlockerCount ?? 0) === 0
      : null;

    const alerts = this.buildAlerts({
      canManageCompany: access.canManageCompany,
      weekStart,
      today,
      weekReviewCounts,
      weekPendingCorrectionsCount,
      weeklyCloseStatus,
      weeklyCloseCanClose,
      weeklyCloseBlockerCount
    });

    return {
      companyId,
      todayDate: todayRange.from,
      accessLevel: access.accessLevel,
      canManageCompany: access.canManageCompany,
      today,
      thisWeek: {
        weekStart,
        weekEnd,
        pendingReviewCount: weekReviewCounts.needsReview,
        incompleteShiftsCount: weekReviewCounts.incomplete,
        needsCorrectionCount: weekPendingCorrectionsCount,
        weeklyCloseStatus,
        weeklyCloseCanClose,
        weeklyCloseBlockerCount
      },
      alerts
    };
  }

  private buildWorkOrderLocationFilter(
    access: Awaited<ReturnType<CompanyScopeService["getCompanyAccessContext"]>>
  ): Prisma.WorkOrderWhereInput {
    if (access.unrestrictedLocations) {
      return {};
    }

    return { locationId: { in: access.allowedLocationIds } };
  }

  private async loadReviewShifts(
    companyId: string,
    locationScope: Prisma.ShiftWhereInput,
    range?: { from: Date; to: Date }
  ) {
    return this.prisma.shift.findMany({
      where: {
        companyId,
        status: ShiftStatus.SCHEDULED,
        punchEvents: { some: {} },
        ...locationScope,
        ...(range
          ? {
              scheduledStartUtc: {
                gte: range.from,
                lt: range.to
              }
            }
          : {})
      },
      select: shiftReviewSelect,
      orderBy: { scheduledStartUtc: "desc" }
    });
  }

  private countReviewStatuses(shifts: ShiftReviewRow[]) {
    let needsReview = 0;
    let incomplete = 0;

    for (const shift of shifts) {
      const review = this.buildReviewForShift(shift);
      if (review.displayStatus === "needs_review") {
        needsReview += 1;
      } else if (review.displayStatus === "incomplete") {
        incomplete += 1;
      }
    }

    return { needsReview, incomplete };
  }

  private buildReviewForShift(shift: ShiftReviewRow) {
    const events = buildEffectivePunchEvents(
      shift.punchEvents,
      mapAppliedCorrections(shift.punchCorrections)
    );

    return buildShiftReview({
      approvedAt: shift.approvedAt,
      additionalTimeApprovedAt: shift.additionalTimeApprovedAt,
      scheduledEndUtc: shift.scheduledEndUtc,
      events
    });
  }

  private countClockedInNow(
    shifts: Array<{ employeeId: string; punchEvents: Array<{ action: string; eventUtc: Date; breakMinutes: number | null }> }>
  ) {
    const latestByEmployee = new Map<string, (typeof shifts)[number]>();

    for (const shift of shifts) {
      if (!latestByEmployee.has(shift.employeeId)) {
        latestByEmployee.set(shift.employeeId, shift);
      }
    }

    let count = 0;

    for (const shift of latestByEmployee.values()) {
      if (findActiveClockedInShift([shift as never])) {
        count += 1;
      }
    }

    return count;
  }

  private resolveCompletedWorkOrderIds(
    completions: Array<{
      workOrderId: string;
      workOrderServiceLineId: string;
      workOrder: {
        status: WorkOrderStatus;
        serviceLines: Array<{ id: string }>;
      };
    }>
  ) {
    const byWorkOrder = new Map<
      string,
      {
        status: WorkOrderStatus;
        totalLines: number;
        completedLineIds: Set<string>;
      }
    >();

    for (const completion of completions) {
      const existing = byWorkOrder.get(completion.workOrderId) ?? {
        status: completion.workOrder.status,
        totalLines: completion.workOrder.serviceLines.length,
        completedLineIds: new Set<string>()
      };

      existing.completedLineIds.add(completion.workOrderServiceLineId);
      byWorkOrder.set(completion.workOrderId, existing);
    }

    const completedIds = new Set<string>();

    for (const [workOrderId, summary] of byWorkOrder.entries()) {
      if (!COMPLETED_WORK_ORDER_STATUSES.includes(summary.status)) {
        continue;
      }

      if (summary.totalLines > 0 && summary.completedLineIds.size >= summary.totalLines) {
        completedIds.add(workOrderId);
      }
    }

    return completedIds;
  }

  private buildAlerts(input: {
    canManageCompany: boolean;
    weekStart: string;
    today: DashboardMetrics;
    weekReviewCounts: { needsReview: number; incomplete: number };
    weekPendingCorrectionsCount: number;
    weeklyCloseStatus: WeeklyPeriodStatus | null;
    weeklyCloseCanClose: boolean | null;
    weeklyCloseBlockerCount: number | null;
  }): DashboardAlert[] {
    const alerts: DashboardAlert[] = [];

    if (input.today.pendingReviewCount > 0) {
      alerts.push({
        id: "shifts-needing-review",
        severity: "warning",
        title: "Shifts need review",
        message: `${input.today.pendingReviewCount} shift${input.today.pendingReviewCount === 1 ? "" : "s"} waiting for approval.`,
        href: "/review?status=needs_review"
      });
    }

    if (input.today.needsCorrectionCount > 0) {
      alerts.push({
        id: "corrections-pending",
        severity: "warning",
        title: "Corrections pending",
        message: `${input.today.needsCorrectionCount} correction request${input.today.needsCorrectionCount === 1 ? "" : "s"} need attention.`,
        href: "/corrections?status=PENDING"
      });
    }

    if (input.weekReviewCounts.incomplete > 0) {
      alerts.push({
        id: "incomplete-shifts",
        severity: "critical",
        title: "Incomplete shifts this week",
        message: `${input.weekReviewCounts.incomplete} shift${input.weekReviewCounts.incomplete === 1 ? "" : "s"} have missing or invalid punch data.`,
        href: "/review?status=incomplete"
      });
    }

    if (input.today.inProgressWorkOrdersCount > 0) {
      alerts.push({
        id: "jobs-in-progress",
        severity: "info",
        title: "Jobs in progress",
        message: `${input.today.inProgressWorkOrdersCount} work order${input.today.inProgressWorkOrdersCount === 1 ? "" : "s"} currently in progress.`,
        href: "/jobs"
      });
    }

    if (input.canManageCompany && input.weeklyCloseStatus === WeeklyPeriodStatus.OPEN) {
      if (input.weeklyCloseCanClose) {
        alerts.push({
          id: "weekly-close-ready",
          severity: "info",
          title: "Weekly close ready",
          message: `Week of ${input.weekStart} has no blockers and can be closed.`,
          href: "/weekly-close"
        });
      } else if ((input.weeklyCloseBlockerCount ?? 0) > 0) {
        alerts.push({
          id: "weekly-close-blocked",
          severity: "warning",
          title: "Weekly close not ready",
          message: `${input.weeklyCloseBlockerCount} blocker${input.weeklyCloseBlockerCount === 1 ? "" : "s"} remain before this week can close.`,
          href: "/weekly-close"
        });
      }
    }

    if (input.canManageCompany && input.today.pendingInvitesCount && input.today.pendingInvitesCount > 0) {
      alerts.push({
        id: "supervisor-invites-pending",
        severity: "info",
        title: "Supervisor invites pending",
        message: `${input.today.pendingInvitesCount} supervisor invite${input.today.pendingInvitesCount === 1 ? "" : "s"} awaiting acceptance.`,
        href: "/employees/supervisors"
      });
    }

    return alerts;
  }
}
