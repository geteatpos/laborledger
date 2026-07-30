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
