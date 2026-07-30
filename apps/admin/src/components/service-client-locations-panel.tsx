"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";

import {
  COMMON_IANA_TIMEZONES,
  isLocationUsableByClient,
  validateLocationName,
  validateLocationTimeZone,
  type LocationRecord
} from "../lib/location-utils";

type ServiceClientLocationsPanelProps = {
  readonly companyId: string;
  readonly serviceClientId: string;
  readonly locations: LocationRecord[];
  readonly canManage: boolean;
};

export function ServiceClientLocationsPanel({
  companyId,
  serviceClientId,
  locations,
  canManage
}: ServiceClientLocationsPanelProps) {
  const router = useRouter();
  const clientLocations = useMemo(
    () =>
      locations.filter((location) =>
        isLocationUsableByClient(location, serviceClientId, { includeArchived: true })
      ),
    [locations, serviceClientId]
  );
  const shareableLocations = useMemo(
    () =>
      locations.filter(
        (location) =>
          !location.archivedAt && !isLocationUsableByClient(location, serviceClientId)
      ),
    [locations, serviceClientId]
  );

  const [mode, setMode] = useState<"idle" | "create" | "share">("idle");
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [shareLocationId, setShareLocationId] = useState(shareableLocations[0]?.id ?? "");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  function resetCreate() {
    setName("");
    setTimezone("America/New_York");
    setFieldError(null);
    setSubmitError(null);
  }

  function closeForms() {
    setMode("idle");
    resetCreate();
    setSuccessMessage(null);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    const nameError = validateLocationName(name);
    const timezoneError = validateLocationTimeZone(timezone);
    if (nameError || timezoneError) {
      setFieldError(nameError ?? timezoneError);
      return;
    }

    setFieldError(null);
    setIsSubmitting(true);

    const response = await fetch(`/api/company-operations/companies/${companyId}/locations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        timezone,
        serviceClientId
      })
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    setIsSubmitting(false);

    if (!response.ok) {
      setSubmitError(payload.message ?? "Unable to create location.");
      return;
    }

    setSuccessMessage("Location created and linked to this client.");
    resetCreate();
    setMode("idle");
    router.refresh();
  }

  async function handleShare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    if (!shareLocationId) {
      setFieldError("Select a location to share.");
      return;
    }

    const location = locations.find((item) => item.id === shareLocationId);
    if (!location) {
      setFieldError("Selected location was not found.");
      return;
    }

    setFieldError(null);
    setIsSubmitting(true);

    const response = await fetch(`/api/company-operations/service-clients/${serviceClientId}/locations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locationId: shareLocationId })
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    setIsSubmitting(false);

    if (!response.ok) {
      setSubmitError(payload.message ?? "Unable to share location.");
      return;
    }

    setSuccessMessage(`${location.name} is now shared with this client.`);
    setMode("idle");
    setShareLocationId(shareableLocations.find((item) => item.id !== shareLocationId)?.id ?? "");
    router.refresh();
  }

  async function handleUnlink(location: LocationRecord) {
    if (location.serviceClientId === serviceClientId) {
      return;
    }

    setSubmitError(null);
    setSuccessMessage(null);
    setUnlinkingId(location.id);

    const response = await fetch(
      `/api/company-operations/service-clients/${serviceClientId}/locations/${location.id}`,
      { method: "DELETE" }
    );

    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    setUnlinkingId(null);

    if (!response.ok) {
      setSubmitError(payload.message ?? "Unable to unlink location.");
      return;
    }

    setSuccessMessage(`${location.name} was unlinked from this client.`);
    router.refresh();
  }

  return (
    <section className="mt-6 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="stitch-label">Locations</h3>
        <Link href="/locations" className="text-xs font-medium text-primary hover:underline">
          Open locations
        </Link>
      </div>

      <div className="glass-panel rounded-stitch p-4">
        {clientLocations.length === 0 ? (
          <p className="text-body-sm text-on-surface-variant">
            No locations linked to this client yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {clientLocations.map((location) => {
              const isPrimary = location.serviceClientId === serviceClientId;
              return (
                <li
                  key={location.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-outline-variant/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-medium text-on-surface">{location.name}</p>
                    <p className="mt-0.5 font-mono text-xs text-on-surface-variant">{location.timezone}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                        isPrimary
                          ? "bg-primary-container/40 text-primary"
                          : "bg-surface-variant text-on-surface-variant"
                      }`}
                    >
                      {isPrimary ? "Primary" : "Shared"}
                    </span>
                    {location.archivedAt ? (
                      <span className="rounded-full bg-surface-variant px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-on-surface-variant">
                        Archived
                      </span>
                    ) : null}
                    {canManage && !isPrimary ? (
                      <button
                        type="button"
                        onClick={() => handleUnlink(location)}
                        disabled={unlinkingId === location.id}
                        className="text-[11px] font-medium text-red-600 hover:underline disabled:opacity-50"
                      >
                        {unlinkingId === location.id ? "Unlinking…" : "Unlink"}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {canManage ? (
          <div className="mt-4 space-y-3 border-t border-outline-variant/30 pt-4">
            {mode === "idle" ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resetCreate();
                    setSuccessMessage(null);
                    setMode("create");
                  }}
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                >
                  Add location
                </button>
                {shareableLocations.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setFieldError(null);
                      setSubmitError(null);
                      setSuccessMessage(null);
                      setShareLocationId(shareableLocations[0]?.id ?? "");
                      setMode("share");
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Share location
                  </button>
                ) : null}
              </div>
            ) : null}

            {mode === "create" ? (
              <form onSubmit={handleCreate} className="space-y-3">
                <p className="text-xs text-on-surface-variant">
                  Create a location owned by this client. Other clients can share it later.
                </p>
                <div>
                  <label className="block text-xs font-medium text-slate-700" htmlFor="client-location-name">
                    Location name
                  </label>
                  <input
                    id="client-location-name"
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label
                    className="block text-xs font-medium text-slate-700"
                    htmlFor="client-location-timezone"
                  >
                    Time zone
                  </label>
                  <select
                    id="client-location-timezone"
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                    disabled={isSubmitting}
                  >
                    {COMMON_IANA_TIMEZONES.map((zone) => (
                      <option key={zone} value={zone}>
                        {zone}
                      </option>
                    ))}
                  </select>
                </div>
                {fieldError ? <p className="text-xs text-red-600">{fieldError}</p> : null}
                {submitError ? <p className="text-xs text-red-600">{submitError}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {isSubmitting ? "Saving…" : "Create location"}
                  </button>
                  <button
                    type="button"
                    onClick={closeForms}
                    disabled={isSubmitting}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}

            {mode === "share" ? (
              <form onSubmit={handleShare} className="space-y-3">
                <p className="text-xs text-on-surface-variant">
                  Reuse an existing company location without moving it from its primary client.
                </p>
                <div>
                  <label
                    className="block text-xs font-medium text-slate-700"
                    htmlFor="client-share-location"
                  >
                    Location
                  </label>
                  <select
                    id="client-share-location"
                    value={shareLocationId}
                    onChange={(event) => setShareLocationId(event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                    disabled={isSubmitting}
                  >
                    {shareableLocations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </div>
                {fieldError ? <p className="text-xs text-red-600">{fieldError}</p> : null}
                {submitError ? <p className="text-xs text-red-600">{submitError}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={isSubmitting || !shareLocationId}
                    className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {isSubmitting ? "Sharing…" : "Share location"}
                  </button>
                  <button
                    type="button"
                    onClick={closeForms}
                    disabled={isSubmitting}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}

            {successMessage ? <p className="text-xs text-emerald-700">{successMessage}</p> : null}
            {mode === "idle" && submitError ? <p className="text-xs text-red-600">{submitError}</p> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
