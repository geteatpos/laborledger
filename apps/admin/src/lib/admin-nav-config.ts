export type AdminNavItem = {
  readonly href: string;
  readonly label: string;
};

export type AdminNavSection = {
  readonly id: string;
  readonly label: string;
  /** Direct link when the section has no children */
  readonly href?: string;
  readonly items?: readonly AdminNavItem[];
};

/** Primary Management System IA — maps to existing LaborLedger routes */
export const companyAdminNavSections: readonly AdminNavSection[] = [
  { id: "dashboard", label: "Dashboard", href: "/" },
  { id: "employees", label: "Empleados", href: "/employees" },
  {
    id: "credentials",
    label: "Credenciales",
    href: "/employees"
  },
  { id: "clients", label: "Clientes", href: "/service-clients" },
  { id: "vehicles", label: "Vehículos", href: "/vehicles" },
  { id: "maintenance", label: "Mantenimiento", href: "/mechanic-orders" },
  { id: "devices", label: "Dispositivos", href: "/mobile-devices" },
  { id: "invoices", label: "Facturas", href: "/client-invoices" },
  { id: "reports", label: "Reportes", href: "/reports" },
  { id: "users", label: "Usuarios", href: "/users" },
  {
    id: "operations",
    label: "Operaciones",
    items: [
      { href: "/reception", label: "Recepción" },
      { href: "/jobs", label: "Trabajos activos" },
      { href: "/work-orders", label: "Órdenes de trabajo" },
      { href: "/service-catalog", label: "Catálogo de servicios" },
      { href: "/attendance", label: "Control de Asistencia" },
      { href: "/kiosks", label: "Relojes / Kioskos" },
      { href: "/mobile-devices", label: "Dispositivos móviles" },
      { href: "/scheduling", label: "Tarjetas de tiempo" },
      { href: "/review", label: "Aprobaciones" },
      { href: "/corrections", label: "Correcciones" },
      { href: "/weekly-close", label: "Cierre semanal" },
      { href: "/labor-billing", label: "Facturación laboral" },
      { href: "/labor-work", label: "Registro de labor" },
      { href: "/employees/supervisors", label: "Supervisores" },
      { href: "/locations", label: "Ubicaciones" },
      { href: "/rates", label: "Tarifas" }
    ]
  },
  { id: "settings", label: "Configuración", href: "/settings" }
] as const;

export const platformNavSections: readonly AdminNavSection[] = [
  { id: "platform-dashboard", label: "Dashboard Global", href: "/platform" },
  { id: "platform-customers", label: "Empresas", href: "/platform/customers" },
  { id: "platform-companies", label: "Compañías", href: "/platform/companies" },
  { id: "platform-users", label: "Usuarios Globales", href: "/platform/admin-users" },
  { id: "platform-audit", label: "Auditoría", href: "/platform/audit-log" },
  { id: "platform-health", label: "Estado del Sistema", href: "/platform/health" }
] as const;

export const employeesSectionNavItems: readonly AdminNavItem[] = [
  { href: "/employees", label: "Equipo" },
  { href: "/employees/supervisors", label: "Supervisores" },
  { href: "/users", label: "Roles y acceso" },
  { href: "/locations", label: "Ubicaciones" }
] as const;

export const receptionSectionNavItems: readonly AdminNavItem[] = [
  { href: "/reception", label: "Recibir vehículo" },
  { href: "/vehicles", label: "Directorio de vehículos" },
  { href: "/service-clients", label: "Clientes" }
] as const;

export const jobsSectionNavItems: readonly AdminNavItem[] = [
  { href: "/jobs", label: "Trabajos activos" },
  { href: "/work-orders", label: "Órdenes de trabajo" },
  { href: "/mechanic-orders", label: "Mantenimiento" },
  { href: "/service-catalog", label: "Servicios" }
] as const;

export const timeSectionNavItems: readonly AdminNavItem[] = [
  { href: "/attendance", label: "Control de Asistencia" },
  { href: "/kiosks", label: "Relojes / Kioskos" },
  { href: "/mobile-devices", label: "Dispositivos móviles" },
  { href: "/scheduling", label: "Tarjetas de tiempo" },
  { href: "/review", label: "Aprobaciones" },
  { href: "/corrections", label: "Correcciones" },
  { href: "/weekly-close", label: "Cierre semanal" }
] as const;

export const billingSectionNavItems: readonly AdminNavItem[] = [
  { href: "/billing-settings", label: "Billing Settings" },
  { href: "/labor-billing", label: "Facturación laboral" },
  { href: "/client-invoices", label: "Facturas de cliente" },
  { href: "/labor-work", label: "Registro de labor" },
  { href: "/rates", label: "Tarifas" }
] as const;

export function isNavHrefActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  if (pathname === href) {
    return true;
  }

  if (href === "/employees") {
    return pathname === "/employees" || pathname.startsWith("/employees/");
  }

  return pathname.startsWith(`${href}/`);
}

export function findActiveNavSectionId(
  pathname: string,
  sections: readonly AdminNavSection[]
): string | null {
  for (const section of sections) {
    if (section.href && isNavHrefActive(pathname, section.href) && section.id !== "credentials") {
      return section.id;
    }

    if (section.items?.some((item) => isNavHrefActive(pathname, item.href))) {
      return section.id;
    }
  }

  return null;
}

const NAV_ICONS: Record<string, string> = {
  dashboard: "dashboard",
  employees: "groups",
  credentials: "badge",
  clients: "business",
  vehicles: "directions_car",
  maintenance: "build",
  devices: "devices",
  invoices: "receipt_long",
  reports: "analytics",
  users: "admin_panel_settings",
  operations: "hub",
  settings: "settings",
  time: "schedule",
  reception: "garage",
  jobs: "handyman",
  billing: "payments",
  "/attendance": "how_to_reg",
  "/kiosks": "sensors",
  "/mobile-devices": "smartphone",
  "/scheduling": "calendar_month",
  "/review": "fact_check",
  "/corrections": "edit_note",
  "/weekly-close": "event_available",
  "/reception": "directions_car",
  "/vehicles": "directions_car",
  "/service-clients": "person",
  "/jobs": "construction",
  "/work-orders": "assignment",
  "/mechanic-orders": "handyman",
  "/service-catalog": "home_repair_service",
  "/employees": "badge",
  "/employees/supervisors": "supervisor_account",
  "/users": "manage_accounts",
  "/locations": "location_on",
  "/labor-billing": "payments",
  "/billing-settings": "receipt_long",
  "/client-invoices": "request_quote",
  "/labor-work": "work_history",
  "/settings": "tune",
  "/rates": "price_change",
  "/reports": "analytics"
};

export function getNavIcon(sectionOrHref: string): string | undefined {
  return NAV_ICONS[sectionOrHref];
}

export function flattenNavSections(sections: readonly AdminNavSection[]): AdminNavItem[] {
  const items: AdminNavItem[] = [];

  for (const section of sections) {
    if (section.href) {
      items.push({ href: section.href, label: section.label });
    }

    if (section.items) {
      items.push(...section.items);
    }
  }

  return items;
}
