"use client";

import { useState } from "react";

import type { MobileDeviceRecord } from "./mobile-devices-workspace";

type MobileDevicesTableProps = {
  readonly devices: MobileDeviceRecord[];
  readonly onRevoked: (deviceId: string) => void;
};

export function MobileDevicesTable({ devices, onRevoked }: MobileDevicesTableProps) {
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function handleRevoke(deviceId: string) {
    if (!confirm("Are you sure you want to revoke this device?")) {
      return;
    }

    setRevokingId(deviceId);

    try {
      const response = await fetch(`/api/mobile/devices/${deviceId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "admin_revoke" })
      });

      if (response.ok) {
        onRevoked(deviceId);
      } else {
        alert("Failed to revoke device");
      }
    } catch {
      alert("Network error");
    } finally {
      setRevokingId(null);
    }
  }

  if (devices.length === 0) {
    return (
      <div className="stitch-card py-12 text-center text-sm text-on-surface-variant">
        No mobile devices enrolled yet. Generate an enrollment token to add one.
      </div>
    );
  }

  return (
    <div className="overflow-hidden stitch-card">
      <table className="min-w-full divide-y divide-outline-variant">
        <thead className="bg-surface-container-low">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-on-surface-variant">
              Device
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-on-surface-variant">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-on-surface-variant">
              Enrolled
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-on-surface-variant">
              Last Seen
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-on-surface-variant">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant bg-white">
          {devices.map((device) => (
            <tr key={device.id} className="hover:bg-surface-container-low">
              <td className="whitespace-nowrap px-4 py-3 text-sm text-on-surface">
                {device.label ?? "Unnamed device"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm">
                <span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-success">
                  {device.status}
                </span>
              </td>
              <td
                className="whitespace-nowrap px-4 py-3 text-sm text-on-surface-variant"
                suppressHydrationWarning
              >
                {new Date(device.enrolledAt).toLocaleDateString()}
              </td>
              <td
                className="whitespace-nowrap px-4 py-3 text-sm text-on-surface-variant"
                suppressHydrationWarning
              >
                {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleDateString() : "Never"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                <button
                  onClick={() => handleRevoke(device.id)}
                  disabled={revokingId === device.id}
                  className="text-error hover:text-red-800 disabled:opacity-50"
                >
                  {revokingId === device.id ? "Revoking..." : "Revoke"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
