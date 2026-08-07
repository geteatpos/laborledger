export type CompanyMemberRole = "COMPANY_ADMIN" | "SUPERVISOR";

export type CompanyMemberRecord = {
  membershipId: string;
  userId: string | null;
  email: string;
  fullName: string | null;
  role: CompanyMemberRole;
  assignedLocationCount: number | null;
};

export const ACTIVE_MEMBERS_HELPER_COPY =
  "Personas con acceso web activo a esta compañía. Revocar el acceso es inmediato.";

export function formatMemberLabel(member: Pick<CompanyMemberRecord, "fullName" | "email">) {
  return member.fullName?.trim() || member.email;
}

export function formatMemberRole(role: CompanyMemberRole) {
  return role === "COMPANY_ADMIN" ? "Administrador de compañía" : "Supervisor";
}

export function companyMembersApiPath(companyId: string) {
  return `/api/company-operations/companies/${encodeURIComponent(companyId)}/members`;
}

export function updateCompanyMemberRolePath(companyId: string, membershipId: string) {
  return `/api/company-operations/companies/${encodeURIComponent(companyId)}/members/${encodeURIComponent(membershipId)}`;
}

export function revokeCompanyMemberPath(companyId: string, membershipId: string) {
  return `/api/company-operations/companies/${encodeURIComponent(companyId)}/members/${encodeURIComponent(membershipId)}/revoke`;
}

export function buildRevokeConfirmMessage(member: Pick<CompanyMemberRecord, "fullName" | "email" | "role">) {
  const label = formatMemberLabel(member);
  const roleLabel = formatMemberRole(member.role);
  return `¿Revocar el acceso de ${label} (${roleLabel})? Perderá acceso de forma inmediata y no podrá iniciar sesión en esta compañía.`;
}

export function buildRoleChangeConfirmMessage(
  member: Pick<CompanyMemberRecord, "fullName" | "email">,
  newRole: CompanyMemberRole
) {
  const label = formatMemberLabel(member);
  return `¿Cambiar el rol de ${label} a ${formatMemberRole(newRole)}?`;
}

export function countActiveAdmins(members: CompanyMemberRecord[]) {
  return members.filter((member) => member.role === "COMPANY_ADMIN").length;
}
