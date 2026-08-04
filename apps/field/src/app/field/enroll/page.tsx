"use client";

import { useState } from "react";

import { FieldShell } from "@/components/shared/FieldShell";
import { EnrollmentScanner } from "@/components/employee/EnrollmentScanner";

type EnrollStatus = "idle" | "enrolling" | "success" | "error";

export default function EnrollPage() {
  const [status, setStatus] = useState<EnrollStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleTokenScanned(scannedToken: string) {
    const detectedAndroidId = await getAndroidId();
    if (!detectedAndroidId) {
      setStatus("error");
      setErrorMessage("Could not detect device ID. Please try again.");
      return;
    }

    setStatus("enrolling");

    try {
      const response = await fetch("/api/field/devices/enroll", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enrollmentToken: scannedToken,
          androidId: detectedAndroidId
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as { message?: string }).message ?? "Enrollment failed");
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Enrollment failed");
    }
  }

  function handleRetry() {
    setStatus("idle");
    setErrorMessage(null);
  }

  return (
    <FieldShell title="Enroll Device" showHomeLink={false}>
      <div className="space-y-6">
        {status === "idle" && (
          <>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-lg font-semibold text-slate-900">Scan Enrollment QR</h2>
              <p className="text-sm text-slate-600">
                Scan the QR code provided by your administrator to enroll this device.
              </p>
            </div>

            <EnrollmentScanner onDetected={handleTokenScanned} />
          </>
        )}

        {status === "enrolling" && (
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex flex-col items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
              <p className="mt-4 text-sm text-slate-600">Enrolling device...</p>
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
            <h2 className="mb-2 text-lg font-semibold text-emerald-900">Device Enrolled!</h2>
            <p className="text-sm text-emerald-700">
              This device has been successfully enrolled. You can now use the Field app.
            </p>
            <a
              href="/field/login"
              className="mt-4 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Go to Login
            </a>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <h2 className="mb-2 text-lg font-semibold text-red-900">Enrollment Failed</h2>
              <p className="text-sm text-red-700">{errorMessage ?? "An unknown error occurred."}</p>
            </div>

            <button
              onClick={handleRetry}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </FieldShell>
  );
}

async function getAndroidId(): Promise<string | null> {
  if (typeof window !== "undefined" && "devicePixelRatio" in window) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const dataURL = canvas.toDataURL("image/png");
      let hash = 0;
      for (let i = 0; i < dataURL.length; i++) {
        const char = dataURL.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
      }
      return `web-${Math.abs(hash).toString(36)}`;
    }
  }
  return null;
}
