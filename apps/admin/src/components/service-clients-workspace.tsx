"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { CreateServiceClientForm } from "./create-service-client-form";
import { EmptyState } from "./empty-state";
import { ServiceClientDetailDrawer } from "./service-client-detail-drawer";
import { ServiceClientStatusBadge } from "./service-client-status-badge";
import type { LocationRecord } from "../lib/location-utils";
import {
  filterServiceClientsByQuery,
  formatServiceClientDate,
  type CompanyRecord,
  type ServiceClientViewRecord
} from "../lib/service-client-utils";

type ServiceClientsWorkspaceProps = {
  readonly companies: CompanyRecord[];
  readonly selectedCompany: CompanyRecord;
  readonly serviceClients: ServiceClientViewRecord[];
  readonly locations: LocationRecord[];
  readonly initialQuery: string;
  readonly initialStatus: "active" | "inactive" | "all";
  readonly canManageCompany: boolean;
};

export function ServiceClientsWorkspace({
  companies,
  selectedCompany,
  serviceClients,
  locations,
  initialQuery,
  initialStatus,
  canManageCompany
}: ServiceClientsWorkspaceProps) {
  const [query, setQuery] = useState(initialQuery);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const filteredClients = useMemo(
    () => filterServiceClientsByQuery(serviceClients, query),
    [serviceClients, query]
  );

  const selectedClient =
    filteredClients.find((client) => client.id === selectedClientId) ??
    serviceClients.find((client) => client.id === selectedClientId) ??
    null;

  function buildServiceClientsHref(overrides: { companyId?: string; status?: string; q?: string }) {
    const params = new URLSearchParams();
    params.set("companyId", overrides.companyId ?? selectedCompany.id);

    const status = overrides.status ?? initialStatus;
    if (status !== "active") {
      params.set("status", status);
    }

    const search = overrides.q ?? query;
    if (search.trim()) {
      params.set("q", search.trim());
    }

    return `/service-clients?${params.toString()}`;
  }

  return (
    <>
      {canManageCompany ? (
        <div className="mb-6">
          <CreateServiceClientForm companyId={selectedCompany.id} />
        </div>
      ) : null}

      {companies.length > 1 ? (
        <div className="mb-6 stitch-filter-panel">
          <p className="stitch-label mb-2.5">Company</p>
          <div className="flex flex-wrap gap-2">
            {companies.map((company) => {
              const isSelected = company.id === selectedCompany.id;
              return (
                <Link
                  key={company.id}
                  href={buildServiceClientsHref({ companyId: company.id })}
                  className={isSelected ? "stitch-chip-active" : "stitch-chip-inactive"}
                >
                  {company.name}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mb-4 stitch-filter-panel flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex-1">
          <label className="stitch-label mb-2 block" htmlFor="service-client-search">
            Search
          </label>
          <input
            id="service-client-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by client name…"
            className="stitch-input max-w-md"
          />
        </div>

        <div>
          <p className="stitch-label mb-2">Status</p>
          <div className="flex flex-wrap gap-2">
            {(["active", "inactive", "all"] as const).map((status) => {
              const isSelected = initialStatus === status;
              const label = status === "active" ? "Active" : status === "inactive" ? "Inactive" : "All";
              return (
                <Link
                  key={status}
                  href={buildServiceClientsHref({ status })}
                  className={isSelected ? "stitch-chip-active" : "stitch-chip-inactive"}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {filteredClients.length === 0 ? (
        <EmptyState
          title={
            serviceClients.length === 0 ? "No customers yet" : "No customers match your search"
          }
          description={
            serviceClients.length === 0
              ? "Create a customer record, then link vehicles and locations for service work."
              : "Try a different name or clear the search filter."
          }
        />
      ) : (
        <>
          <div className="stitch-table-wrap hidden md:block">
            <div className="overflow-x-auto">
              <table className="stitch-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Company</th>
                    <th>Active locations</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => (
                    <tr key={client.id}>
                      <td>
                        <button
                          type="button"
                          onClick={() => setSelectedClientId(client.id)}
                          className="text-left font-medium text-on-surface hover:text-primary"
                        >
                          {client.name}
                        </button>
                      </td>
                      <td className="text-on-surface-variant">{selectedCompany.name}</td>
                      <td className="text-on-surface-variant">{client.locationCount}</td>
                      <td>
                        <ServiceClientStatusBadge archivedAt={client.archivedAt} />
                      </td>
                      <td className="text-on-surface-variant">{formatServiceClientDate(client.createdAt)}</td>
                      <td>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedClientId(client.id)}
                            className="stitch-btn-secondary px-3 py-1.5 text-xs"
                          >
                            View
                          </button>
                          {canManageCompany && !client.archivedAt ? (
                            <button
                              type="button"
                              onClick={() => setSelectedClientId(client.id)}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                            >
                              Edit
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {filteredClients.map((client) => (
              <article key={client.id} className="glass-panel rounded-stitch p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-on-surface">{client.name}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">{selectedCompany.name}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {client.locationCount} active {client.locationCount === 1 ? "location" : "locations"}
                    </p>
                  </div>
                  <ServiceClientStatusBadge archivedAt={client.archivedAt} />
                </div>
                <p className="mt-3 text-xs text-on-surface-variant">Added {formatServiceClientDate(client.createdAt)}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedClientId(client.id)}
                    className="stitch-btn-secondary px-3 py-1.5 text-xs"
                  >
                    View details
                  </button>
                  {canManageCompany && !client.archivedAt ? (
                    <button
                      type="button"
                      onClick={() => setSelectedClientId(client.id)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      Edit
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      <ServiceClientDetailDrawer
        client={selectedClient}
        companyId={selectedCompany.id}
        companyName={selectedCompany.name}
        locations={locations}
        canManageCompany={canManageCompany}
        onClose={() => setSelectedClientId(null)}
      />
    </>
  );
}
