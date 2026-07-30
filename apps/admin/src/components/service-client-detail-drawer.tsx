"use client";

import { ArchiveServiceClientButton } from "./archive-service-client-button";
import { EditServiceClientForm } from "./edit-service-client-form";
import { ServiceClientLocationsPanel } from "./service-client-locations-panel";
import { ServiceClientStatusBadge } from "./service-client-status-badge";
import type { LocationRecord } from "../lib/location-utils";
import {
  formatServiceClientAddressLines,
  formatServiceClientDate,
  resolveServiceClientDisplayName,
  type ServiceClientViewRecord
} from "../lib/service-client-utils";

type ServiceClientDetailDrawerProps = {
  readonly client: ServiceClientViewRecord | null;
  readonly companyId: string;
  readonly companyName: string;
  readonly locations: LocationRecord[];
  readonly canManageCompany: boolean;
  readonly onClose: () => void;
};

export function ServiceClientDetailDrawer({
  client,
  companyId,
  companyName,
  locations,
  canManageCompany,
  onClose
}: ServiceClientDetailDrawerProps) {
  if (!client) {
    return null;
  }

  const isArchived = Boolean(client.archivedAt);
  const addressLines = formatServiceClientAddressLines(client);
  const displayName = resolveServiceClientDisplayName(client);

  return (
    <>
      <button
        type="button"
        aria-label="Close service client detail"
        className="stitch-drawer-overlay"
        onClick={onClose}
      />

      <aside
        className="stitch-drawer"
        role="dialog"
        aria-labelledby="service-client-detail-title"
      >
        <div className="flex items-start justify-between border-b border-outline-variant-20 px-5 py-4">
          <div className="min-w-0">
            <h2 id="service-client-detail-title" className="truncate font-display text-base font-semibold text-on-surface">
              {client.name}
            </h2>
            <p className="text-xs text-on-surface-variant">{companyName}</p>
            {displayName !== client.name ? (
              <p className="mt-0.5 truncate text-xs text-on-surface-variant">Facturar como: {displayName}</p>
            ) : null}
          </div>
          <button type="button" onClick={onClose} className="stitch-btn-secondary px-2.5 py-1 text-xs">
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <ServiceClientStatusBadge archivedAt={client.archivedAt} />
            <span className="text-xs text-on-surface-variant">Added {formatServiceClientDate(client.createdAt)}</span>
          </div>

          <section className="mt-6 space-y-3">
            <h3 className="stitch-label">Identidad fiscal</h3>
            <div className="glass-panel rounded-stitch p-4">
              <dl className="space-y-3 text-body-sm">
                <DetailRow label="Nombre comercial" value={client.name} />
                <DetailRow label="Nombre legal" value={client.legalName} />
                <DetailRow label="Tax ID / RNC" value={client.taxId} />
              </dl>
            </div>
          </section>

          <section className="mt-6 space-y-3">
            <h3 className="stitch-label">Contacto</h3>
            <div className="glass-panel rounded-stitch p-4">
              <dl className="space-y-3 text-body-sm">
                <DetailRow label="Encargado" value={client.billingContactName} />
                <DetailRow label="Teléfono" value={client.phone} />
                <DetailRow label="Correo de facturación" value={client.billingEmail} />
              </dl>
            </div>
          </section>

          <section className="mt-6 space-y-3">
            <h3 className="stitch-label">Dirección de facturación</h3>
            <div className="glass-panel rounded-stitch p-4">
              {addressLines.length > 0 ? (
                <p className="whitespace-pre-line text-body-sm text-on-surface">{addressLines.join("\n")}</p>
              ) : (
                <p className="text-body-sm text-on-surface-variant">Sin dirección configurada.</p>
              )}
            </div>
          </section>

          <section className="mt-6 space-y-3">
            <h3 className="stitch-label">Client details</h3>
            <div className="glass-panel rounded-stitch p-4">
              <dl className="space-y-3 text-body-sm">
                <div>
                  <dt className="text-xs text-on-surface-variant">Active locations</dt>
                  <dd className="mt-0.5 text-on-surface">
                    {client.locationCount} {client.locationCount === 1 ? "location" : "locations"}
                  </dd>
                </div>
                {client.updatedAt ? (
                  <div>
                    <dt className="text-xs text-on-surface-variant">Last updated</dt>
                    <dd className="mt-0.5 text-on-surface">{formatServiceClientDate(client.updatedAt)}</dd>
                  </div>
                ) : null}
              </dl>
              <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
                Estos datos alimentan el Bill To de las facturas al emitirlas. Los cambios no alteran facturas ya
                emitidas.
              </p>
              {canManageCompany && !isArchived ? (
                <div className="mt-4">
                  <EditServiceClientForm serviceClient={client} />
                </div>
              ) : null}
            </div>
          </section>

          <ServiceClientLocationsPanel
            companyId={companyId}
            serviceClientId={client.id}
            locations={locations}
            canManage={canManageCompany && !isArchived}
          />

          <section className="mt-6 space-y-3">
            <h3 className="stitch-label">Company</h3>
            <div className="glass-panel rounded-stitch p-4 text-body-sm text-on-surface-variant">{companyName}</div>
          </section>

          <section className="mt-6 space-y-3">
            <h3 className="stitch-label">Status</h3>
            <ArchiveServiceClientButton
              serviceClientId={client.id}
              serviceClientName={client.name}
              isArchived={isArchived}
            />
          </section>
        </div>
      </aside>
    </>
  );
}

function DetailRow({ label, value }: { readonly label: string; readonly value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-on-surface-variant">{label}</dt>
      <dd className="mt-0.5 font-medium text-on-surface">{value?.trim() || "—"}</dd>
    </div>
  );
}
