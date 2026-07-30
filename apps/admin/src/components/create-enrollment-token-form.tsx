"use client";

import { useState } from "react";

import type { EnrollmentTokenResult } from "./mobile-devices-workspace";

type CreateEnrollmentTokenFormProps = {
  readonly companyId: string;
  readonly locations: { id: string; name: string }[];
  readonly onSuccess: (result: EnrollmentTokenResult) => void;
  readonly onCancel: () => void;
};

export function CreateEnrollmentTokenForm({
  companyId,
  locations,
  onSuccess,
  onCancel
}: CreateEnrollmentTokenFormProps) {
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [deviceLabel, setDeviceLabel] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!locationId) {
      setError("Please select a location");
      return;
    }

    const trimmedLabel = deviceLabel.trim();
    if (!trimmedLabel) {
      setError("Please enter a device name");
      return;
    }
    if (trimmedLabel.length > 80) {
      setError("Device name must be 80 characters or fewer");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const body: {
        companyId: string;
        locationId: string;
        deviceLabel: string;
        expiresAt?: string;
      } = {
        companyId,
        locationId,
        deviceLabel: trimmedLabel
      };

      if (expiresAt) {
        // datetime-local is wall-clock without timezone; convert to absolute ISO
        // so the UTC API does not treat a local future time as already expired.
        const localExpiry = new Date(expiresAt);
        if (Number.isNaN(localExpiry.getTime())) {
          setError("Expires At must be a valid date and time.");
          setIsLoading(false);
          return;
        }
        if (localExpiry <= new Date()) {
          setError("Expires At must be in the future.");
          setIsLoading(false);
          return;
        }
        body.expiresAt = localExpiry.toISOString();
      }

      const response = await fetch("/api/mobile/devices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Failed to create enrollment token");
        return;
      }

      if (typeof data.enrollmentToken !== "string" || typeof data.qrCode !== "string") {
        setError("Enrollment token was created but the QR code response was incomplete.");
        return;
      }

      onSuccess(data);
    } catch {
      setError("Network error");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mb-6 stitch-card p-4">
      <h3 className="mb-4 text-sm font-semibold text-on-surface">Generate Enrollment Token</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-on-surface" htmlFor="deviceLabel">
            Device name
          </label>
          <input
            id="deviceLabel"
            type="text"
            value={deviceLabel}
            onChange={(e) => setDeviceLabel(e.target.value)}
            placeholder="e.g. Bay 1 tablet, TC22 shop floor"
            maxLength={80}
            className="mt-1 block w-full rounded-lg border border-outline px-3 py-2 text-sm focus:border-secondary focus:outline-none focus:ring-1 focus:ring-brand-600"
            required
          />
          <p className="mt-1 text-xs text-on-surface-variant">
            This name is saved on the device when the QR is scanned.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-on-surface" htmlFor="location">
            Location
          </label>
          <select
            id="location"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-outline px-3 py-2 text-sm focus:border-secondary focus:outline-none focus:ring-1 focus:ring-brand-600"
            required
          >
            <option value="">Select a location</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-on-surface" htmlFor="expiresAt">
            Expires At (optional)
          </label>
          <input
            id="expiresAt"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-outline px-3 py-2 text-sm focus:border-secondary focus:outline-none focus:ring-1 focus:ring-brand-600"
          />
          <p className="mt-1 text-xs text-on-surface-variant">
            Default: 24 hours from now. Leave empty for default expiration.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-error-container px-4 py-2 text-sm text-error">{error}</div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isLoading}
            className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary disabled:opacity-50"
          >
            {isLoading ? "Generating..." : "Generate Token"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-outline px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-low"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
