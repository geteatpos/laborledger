export type CompanySupervisorRecord = {
  userId: string | null;
  email: string;
  fullName: string | null;
  role: string;
  status: "ACTIVE" | "INVITED";
  assignedLocationCount: number;
};

export type SupervisorLocationAssignmentRecord = {
  id: string;
  companyId: string;
  supervisorUserId: string;
  locationId: string;
  assignedAt: string;
  supervisor: {
    id: string;
    email: string;
    fullName: string | null;
  };
  location: {
    id: string;
    name: string;
    timezone: string;
    archivedAt: string | null;
  };
};

export type LocationOption = {
  id: string;
  name: string;
  timezone: string;
  archivedAt?: string | null;
};

export const SUPERVISOR_ACCESS_HELPER_COPY =
  "Los supervisores solo pueden ver y gestionar registros de las ubicaciones asignadas.";

export const SUPERVISOR_PIN_HELPER_COPY =
  "Los usuarios con PIN de empleado se gestionan por separado y no se asignan aquí.";

export const SUPERVISOR_ROLE_HELPER_COPY =
  "Invita supervisores desde aquí mismo o desde Equipo → Supervisores, y asigna sus ubicaciones después de que acepten la invitación.";

export function formatSupervisorLabel(supervisor: Pick<CompanySupervisorRecord, "fullName" | "email">) {
  return supervisor.fullName?.trim() || supervisor.email;
}

export function formatAssignedLocationCount(count: number): string {
  if (count === 0) {
    return "Sin ubicaciones asignadas";
  }

  return `${count} ${count === 1 ? "ubicación asignada" : "ubicaciones asignadas"}`;
}

export function groupAssignmentsBySupervisor(assignments: SupervisorLocationAssignmentRecord[]) {
  const grouped = new Map<string, SupervisorLocationAssignmentRecord[]>();

  for (const assignment of assignments) {
    const existing = grouped.get(assignment.supervisorUserId) ?? [];
    existing.push(assignment);
    grouped.set(assignment.supervisorUserId, existing);
  }

  return grouped;
}

export function buildAssignSupervisorLocationPath(
  companyId: string,
  supervisorUserId: string
): string {
  return `/api/company-operations/companies/${encodeURIComponent(companyId)}/supervisors/${encodeURIComponent(supervisorUserId)}/locations`;
}

export function buildRemoveSupervisorLocationPath(
  companyId: string,
  supervisorUserId: string,
  locationId: string
): string {
  return `/api/company-operations/companies/${encodeURIComponent(companyId)}/supervisors/${encodeURIComponent(supervisorUserId)}/locations/${encodeURIComponent(locationId)}`;
}

export function buildBulkRemoveSupervisorLocationsPath(companyId: string, supervisorUserId: string): string {
  return `/api/company-operations/companies/${encodeURIComponent(companyId)}/supervisors/${encodeURIComponent(supervisorUserId)}/locations/bulk-remove`;
}

export function buildBulkRemoveConfirmMessage(
  supervisor: Pick<CompanySupervisorRecord, "fullName" | "email">,
  count: number
): string {
  const label = formatSupervisorLabel(supervisor);
  const countLabel = count === 1 ? "1 ubicación" : `${count} ubicaciones`;
  return `¿Quitar ${countLabel} a ${label}? Esta acción no se puede deshacer.`;
}

export function supervisorAccessEmptyMessage(
  supervisors: CompanySupervisorRecord[],
  locations: LocationOption[]
): { title: string; description: string } {
  if (locations.length === 0) {
    return {
      title: "No hay ubicaciones disponibles",
      description: "Crea una ubicación activa antes de asignar acceso de supervisor."
    };
  }

  if (supervisors.length === 0) {
    return {
      title: "Todavía no hay supervisores",
      description:
        "Invita supervisores desde arriba. Las ubicaciones se pueden asignar después de que acepten la invitación."
    };
  }

  return {
    title: "Todavía no hay ubicaciones asignadas",
    description: "Asigna una o más ubicaciones a cada supervisor para delimitar su acceso."
  };
}

export function validateSupervisorAssignmentInput(supervisorUserId: string, locationId: string) {
  if (!supervisorUserId.trim()) {
    return "Selecciona un supervisor.";
  }

  if (!locationId.trim()) {
    return "Selecciona una ubicación.";
  }

  return null;
}
