"use client";

import { useState } from "react";

import type { EnrollmentTokenResult } from "./mobile-devices-workspace";

type EnrollmentTokenModalProps = {
  readonly result: EnrollmentTokenResult;
  readonly onClose: () => void;
};

export function EnrollmentTokenModal({ result, onClose }: EnrollmentTokenModalProps) {
  const [copied, setCopied] = useState(false);
  const expiresAt = new Date(result.token.expiresAt);
  const isExpired = expiresAt <= new Date();

  async function handleCopyToken() {
    try {
      await navigator.clipboard.writeText(result.enrollmentToken);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="m-4 max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-on-surface">Enrollment Token Created</h2>

        <div className="mb-4 flex justify-center">
          {isExpired ? (
            <div className="rounded-lg bg-error-container px-4 py-2 text-sm text-error">
              Token expired
            </div>
          ) : result.qrCode ? (
            <img
              src={result.qrCode}
              alt="Enrollment QR Code"
              className="rounded-lg border border-outline-variant"
              width={256}
              height={256}
            />
          ) : (
            <div className="rounded-lg bg-error-container px-4 py-2 text-sm text-error">
              QR code unavailable — copy the token below.
            </div>
          )}
        </div>

        <div className="mb-4 space-y-2 text-sm">
          {result.token.deviceLabel ? (
            <div className="flex justify-between gap-3">
              <span className="text-on-surface-variant">Device:</span>
              <span className="font-medium text-on-surface">{result.token.deviceLabel}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <span className="text-on-surface-variant">Token:</span>
            <div className="flex min-w-0 items-center gap-2">
              <code className="max-w-[12rem] truncate rounded bg-surface-container px-2 py-0.5 font-mono text-xs">
                {result.enrollmentToken}
              </code>
              <button
                type="button"
                onClick={handleCopyToken}
                className="shrink-0 rounded border border-outline px-2 py-0.5 text-xs font-medium text-on-surface hover:bg-surface-container-low"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Expires:</span>
            <span className="text-on-surface" suppressHydrationWarning>
              {expiresAt.toLocaleString()}
            </span>
          </div>
        </div>

        {!isExpired && (
          <div className="mb-4 stitch-alert-warning p-3 text-xs text-on-surface-variant">
            Scan this QR code with the Field app to enroll a device. The token expires in 24 hours
            unless you chose a custom expiration.
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full rounded-lg bg-surface-container px-4 py-2 text-sm font-medium text-on-surface hover:bg-outline-variant"
        >
          Close
        </button>
      </div>
    </div>
  );
}
