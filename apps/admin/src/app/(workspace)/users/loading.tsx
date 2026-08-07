import { AdminShell } from "../../../components/admin-shell";
import { USERS_PAGE_DESCRIPTION } from "../../../lib/user-invite-utils";

export default function UsersLoadingPage() {
  return (
    <AdminShell title="Roles y acceso" description={USERS_PAGE_DESCRIPTION}>
      <p className="text-sm text-slate-500">Cargando invitaciones…</p>
    </AdminShell>
  );
}
