export type DashboardAlertSeverity = "info" | "warning" | "critical";

export type DashboardAlert = {
  id: string;
  severity: DashboardAlertSeverity;
  title: string;
  message: string;
  href: string | null;
};

export type DashboardMetrics = {
  activeEmployeesCount: number | null;
  clockedInNowCount: number;
  pendingReviewCount: number;
  needsCorrectionCount: number;
  openWorkOrdersCount: number;
  inProgressWorkOrdersCount: number;
  vehiclesReceivedTodayCount: number;
  completedWorkOrdersTodayCount: number;
  pendingInvitesCount: number | null;
};

export type DashboardWeekOverview = {
  weekStart: string;
  weekEnd: string;
  pendingReviewCount: number;
  incompleteShiftsCount: number;
  needsCorrectionCount: number;
  weeklyCloseStatus: "OPEN" | "CLOSED" | null;
  weeklyCloseCanClose: boolean | null;
  weeklyCloseBlockerCount: number | null;
};

export type CompanyDashboardResponse = {
  companyId: string;
  todayDate: string;
  accessLevel: string;
  canManageCompany: boolean;
  today: DashboardMetrics;
  thisWeek: DashboardWeekOverview;
  alerts: DashboardAlert[];
};

export function formatDashboardMetric(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "Not available";
  }

  return String(value);
}

export function formatDashboardDate(dateKey: string) {
  const parts = dateKey.split("-").map(Number);
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(date);
}

export function formatWeekRange(weekStart: string, weekEnd: string) {
  return `${formatDashboardDate(weekStart)} – ${formatDashboardDate(weekEnd)}`;
}
