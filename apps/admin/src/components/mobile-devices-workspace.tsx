"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { MobileDevicesTable } from "./mobile-devices-table";
import { CreateEnrollmentTokenForm } from "./create-enrollment-token-form";
import { EnrollmentTokenModal } from "./enrollment-token-modal";

export type MobileDeviceRecord = {
  id: string;
  groupId: string;
  companyId: string;
  locationId: string;
  label: string | null;
  status: string;
  enrolledAt: string;
  revokedAt: string | null;
  lastSeenAt: string | null;
};

export type EnrollmentTokenResult = {
  enrollmentToken: string;
  qrCode: string;
  token: {
    id: string;
    groupId: string;
    companyId: string;
    locationId: string;
    deviceLabel?: string | null;
    status: string;
    expiresAt: string;
    createdAt: string;
  };
};

type MobileDevicesWorkspaceProps = {
  readonly devices: MobileDeviceRecord[];
  readonly companyId: string;
  readonly locations: { id: string; name: string }[];
};

export function MobileDevicesWorkspace({
  devices,
  companyId,
  locations
}: MobileDevicesWorkspaceProps) {
  const router = useRouter();
  const [showCreateToken, setShowCreateToken] = useState(false);
  const [enrollmentResult, setEnrollmentResult] = useState<EnrollmentTokenResult | null>(null);
  const [visibleDevices, setVisibleDevices] = useState(() =>
    devices.filter((device) => device.status === "ACTIVE")
  );

  useEffect(() => {
    setVisibleDevices(devices.filter((device) => device.status === "ACTIVE"));
  }, [devices]);

  function handleTokenCreated(result: EnrollmentTokenResult) {
    setShowCreateToken(false);
    setEnrollmentResult(result);
  }

  function handleCloseModal() {
    setEnrollmentResult(null);
  }

  function handleRevoked(deviceId: string) {
    setVisibleDevices((current) => current.filter((device) => device.id !== deviceId));
    router.refresh();
  }

  return (
    <>
      <div className="mb-6 rounded-xl border border-outline-variant bg-surface-container-low/70 px-4 py-3 text-sm text-on-surface-variant">
        Generate an enrollment token with a device name, then scan the QR from the Field / Android
        app. Revoking a device removes it from this list; a new enrollment token reactivates the
        same physical device.
      </div>

      <div className="mb-6">
        <button
          onClick={() => setShowCreateToken(true)}
          className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary"
        >
          Generate Enrollment Token
        </button>
      </div>

      {showCreateToken && (
        <CreateEnrollmentTokenForm
          companyId={companyId}
          locations={locations}
          onSuccess={handleTokenCreated}
          onCancel={() => setShowCreateToken(false)}
        />
      )}

      <MobileDevicesTable devices={visibleDevices} onRevoked={handleRevoked} />

      {enrollmentResult && (
        <EnrollmentTokenModal result={enrollmentResult} onClose={handleCloseModal} />
      )}
    </>
  );
}
