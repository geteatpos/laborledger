import { notFound, redirect } from "next/navigation";

import { AdminShell } from "../../../../components/admin-shell";
import { ClientInvoiceDetailPanel } from "../../../../components/client-invoice-detail-panel";
import {
  CLIENT_INVOICES_MODULE_DESCRIPTION,
  CLIENT_INVOICES_MODULE_TITLE
} from "../../../../lib/billing-module-copy";
import type { ClientInvoiceListRecord } from "../../../../lib/client-invoice-utils";
import { formatChooseCompanyBlockedCopy } from "../../../../lib/auth-utils";
import {
  apiGet,
  loadWorkspaceContext,
  WorkspaceApiError
} from "../../../../lib/workspace-auth";

type ClientInvoiceDetailPageProps = {
  readonly params: Promise<{
    clientInvoiceId: string;
  }>;
};

export default async function ClientInvoiceDetailPage({ params }: ClientInvoiceDetailPageProps) {
  const { clientInvoiceId } = await params;

  try {
    const workspace = await loadWorkspaceContext();

    if (workspace.blocked) {
      return (
        <AdminShell
          title={CLIENT_INVOICES_MODULE_TITLE}
          description={CLIENT_INVOICES_MODULE_DESCRIPTION}
        >
          <p className="stitch-alert-warning">
            {formatChooseCompanyBlockedCopy()}
          </p>
        </AdminShell>
      );
    }

    const { cookieHeader, selectedCompany } = workspace;

    const invoice = await apiGet<ClientInvoiceListRecord>(
      `/company-operations/client-invoices/${clientInvoiceId}`,
      cookieHeader
    );

    // Verify the invoice belongs to the selected company
    if (invoice.companyId && invoice.companyId !== selectedCompany.id) {
      notFound();
    }

    return (
      <AdminShell
        title={CLIENT_INVOICES_MODULE_TITLE}
        description={`Factura ${invoice.invoiceNumber ?? invoice.id.slice(0, 8)}`}
      >
        <ClientInvoiceDetailPanel
          invoice={invoice}
          companyName={selectedCompany.name}
        />
      </AdminShell>
    );
  } catch (error) {
    if (error instanceof WorkspaceApiError && error.status === 401) {
      redirect("/login");
    }

    if (error instanceof WorkspaceApiError && error.status === 404) {
      notFound();
    }

    const apiUnreachable = error instanceof WorkspaceApiError && error.status === 0;

    return (
      <AdminShell
        title={CLIENT_INVOICES_MODULE_TITLE}
        description={CLIENT_INVOICES_MODULE_DESCRIPTION}
      >
        <p className="stitch-alert-error">
          {apiUnreachable
            ? "No se puede conectar con el API. Inicia el servicio de API y actualiza la página."
            : "No se pudo cargar los detalles de la factura."}
        </p>
      </AdminShell>
    );
  }
}
