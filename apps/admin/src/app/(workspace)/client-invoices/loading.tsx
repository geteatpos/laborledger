import { AdminShell } from "../../../components/admin-shell";
import {
  CLIENT_INVOICES_MODULE_DESCRIPTION,
  CLIENT_INVOICES_MODULE_TITLE
} from "../../../lib/billing-module-copy";

export default function ClientInvoicesLoading() {
  return (
    <AdminShell
      title={CLIENT_INVOICES_MODULE_TITLE}
      description={CLIENT_INVOICES_MODULE_DESCRIPTION}
    >
      <div className="animate-pulse space-y-4">
        <div className="h-16 rounded-2xl bg-slate-100" />
        <div className="h-40 rounded-2xl bg-slate-100" />
        <div className="h-64 rounded-2xl bg-slate-100" />
      </div>
    </AdminShell>
  );
}
