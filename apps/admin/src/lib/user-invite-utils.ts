export type InvitationStatus = "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";

export type UserInvitationRecord = {
  id: string;
  email: string;
  role: string;
  status: InvitationStatus;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  invitedBy: {
    id: string;
    fullName: string | null;
    email: string;
  };
};

export const USERS_PAGE_DESCRIPTION =
  "Invita administradores y supervisores, revisa invitaciones pendientes y gestiona el acceso por ubicación de los supervisores.";

export const USERS_PIN_HELPER_COPY =
  "Esta página es para el acceso web administrativo. Los empleados usan PINs de campo para acceder a la app de campo.";

export const USERS_ACCESS_TYPES = [
  {
    title: "Administradores de la compañía",
    description: "Usuarios web invitados arriba con acceso completo de administración de la compañía."
  },
  {
    title: "Supervisores",
    description: "Usuarios web con membresía de supervisor. El acceso por ubicación se gestiona abajo."
  },
  {
    title: "Usuarios con PIN de empleado",
    description: "Empleados de campo y trabajadores gestionados en Equipo. No inician sesión aquí."
  }
] as const;

export const PASSWORD_RESET_REQUEST_MESSAGE =
  "If an account exists for that email, reset instructions have been sent.";

export function formatInvitationStatus(status: InvitationStatus): string {
  if (status === "PENDING") {
    return "Pendiente";
  }

  if (status === "ACCEPTED") {
    return "Aceptada";
  }

  if (status === "REVOKED") {
    return "Revocada";
  }

  return "Expirada";
}

export function formatInvitationRole(role: string): string {
  if (role === "COMPANY_ADMIN") {
    return "Administrador de compañía";
  }

  if (role === "SUPERVISOR") {
    return "Supervisor";
  }

  return role.replace(/_/gu, " ").toLowerCase();
}

export function formatInvitedByLabel(
  invitedBy: UserInvitationRecord["invitedBy"] | null | undefined
): string {
  if (!invitedBy) {
    return "—";
  }

  return invitedBy.fullName?.trim() || invitedBy.email;
}

export function invitationStatusClassName(status: InvitationStatus): string {
  if (status === "PENDING") {
    return "bg-amber-50 text-amber-800 border-amber-200";
  }

  if (status === "ACCEPTED") {
    return "bg-emerald-50 text-emerald-800 border-emerald-200";
  }

  if (status === "REVOKED") {
    return "bg-slate-100 text-slate-700 border-slate-200";
  }

  return "bg-red-50 text-red-700 border-red-200";
}

export function validateInviteEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase();

  if (!normalized) {
    return "El correo es obligatorio.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized)) {
    return "Ingresa un correo válido.";
  }

  return null;
}

export const INVITABLE_ROLES = [
  { value: "COMPANY_ADMIN", label: "Administrador de compañía" },
  { value: "SUPERVISOR", label: "Supervisor" }
] as const;

export type InvitableRole = (typeof INVITABLE_ROLES)[number]["value"];

export function validateNewPassword(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }

  if (!/[A-Za-z]/u.test(password) || !/[0-9]/u.test(password)) {
    return "Password must include at least one letter and one number.";
  }

  return null;
}
