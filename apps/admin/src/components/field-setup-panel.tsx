"use client";

import { useCallback, useEffect, useState } from "react";

import { validateFieldHostname, type FieldSiteRecord } from "../lib/field-site-utils";

type FieldSetupPanelProps = {
  readonly locationId: string;
  readonly locationName: string;
  readonly initialSite: FieldSiteRecord | null;
  readonly canManage: boolean;
};

export function FieldSetupPanel({
  locationId,
  locationName,
  initialSite,
  canManage
}: FieldSetupPanelProps) {
  const [site, setSite] = useState<FieldSiteRecord | null>(initialSite);
  const [hostname, setHostname] = useState(initialSite?.hostname ?? "");
  const [displayName, setDisplayName] = useState(initialSite?.displayName ?? locationName);
  const [ready, setReady] = useState(initialSite?.ready ?? false);
  const [isLoading, setIsLoading] = useState(!initialSite);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadSite = useCallback(async () => {
    setIsLoading(true);
    const response = await fetch(`/api/company-operations/locations/${locationId}/field-site`, {
      cache: "no-store"
    });
    const payload = (await response.json().catch(() => null)) as FieldSiteRecord | null;
    setIsLoading(false);

    if (!response.ok || !payload) {
      return;
    }

    setSite(payload);
    setHostname(payload.hostname);
    setDisplayName(payload.displayName ?? locationName);
    setReady(payload.ready);
  }, [locationId, locationName]);

  useEffect(() => {
    if (!initialSite) {
      void loadSite();
    }
  }, [initialSite, loadSite]);

  async function handleSave() {
    setErrorMessage(null);
    setStatusMessage(null);

    const hostnameError = validateFieldHostname(hostname);
    if (hostnameError) {
      setErrorMessage(hostnameError);
      return;
    }

    setIsSaving(true);

    const response = await fetch(`/api/company-operations/locations/${locationId}/field-site`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        hostname,
        displayName: displayName.trim() || undefined,
        ready
      })
    });

    const payload = (await response.json().catch(() => ({}))) as FieldSiteRecord & {
      message?: string;
    };

    setIsSaving(false);

    if (!response.ok) {
      setErrorMessage(payload.message ?? "Unable to save Field setup.");
      return;
    }

    setSite(payload);
    setStatusMessage("Field setup saved.");
  }

  if (!canManage) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600">
        {isLoading
          ? "Loading Field setup…"
          : site?.ready
            ? `Field is ready at ${site.hostname}.`
            : "Field setup is not complete for this location."}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600">
        Loading Field setup…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <p className="text-sm text-slate-700">
        Point your employee app hostname (for example, <code className="font-mono text-xs">app.example.com</code>)
        to this location. Employees sign in with a Field PIN — no clock device env vars on employee devices.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-600" htmlFor={`field-hostname-${locationId}`}>
            Field hostname
          </label>
          <input
            id={`field-hostname-${locationId}`}
            value={hostname}
            onChange={(event) => setHostname(event.target.value)}
            placeholder="app.example.com"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600" htmlFor={`field-display-${locationId}`}>
            Display name (optional)
          </label>
          <input
            id={`field-display-${locationId}`}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={ready}
            onChange={(event) => setReady(event.target.checked)}
            className="rounded border-slate-300"
          />
          Location ready for employee sign-in
        </label>

        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          <p>
            Clock:{" "}
            <span className="font-medium text-slate-900">
              {site?.clockAvailable ? "Available (clock device configured)" : "Needs an active clock device with credentials"}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {isSaving ? "Saving…" : "Save Field setup"}
        </button>
      </div>

      {statusMessage ? <p className="mt-3 text-sm text-emerald-700">{statusMessage}</p> : null}
      {errorMessage ? <p className="mt-3 text-sm text-red-600">{errorMessage}</p> : null}
    </div>
  );
}
