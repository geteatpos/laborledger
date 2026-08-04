export const VIN_LENGTH = 17;

export const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;

export const SCAN_DEBOUNCE_MS = 2000;

export const WORKER_SCANNER_HELPER_COPY =
  "Use a hardware scanner or type the VIN manually. Most Zebra scanners work as keyboard input and submit with Enter.";

export const CAMERA_UNAVAILABLE_COPY =
  "Camera scanning is not available on this device. Use manual entry or a hardware scanner.";

export const OFFLINE_BANNER_COPY =
  "You are offline. Scans and service completions will not submit until connection returns.";

export const NETWORK_ERROR_COPY =
  "Network error. Check your connection and try again. Your scan was not submitted.";

export type WorkerScanStatus =
  | "ready"
  | "submitting"
  | "matched"
  | "not_found"
  | "already_completed"
  | "network_error";

export type ScanStatusPresentation = {
  label: string;
  description: string;
  tone: "neutral" | "info" | "success" | "warning" | "error";
};

export function sanitizeVinInput(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-HJ-NPR-Z0-9]/g, "");
}

/** Extract a VIN from a camera/barcode payload. Does not strip I/O/Q (unlike sanitizeVinInput). */
export function extractVinFromScan(raw: string): string | null {
  // Minimal cleanup: framing only — no I/O/Q strip
  const cleaned = raw.trim().toUpperCase().replace(/[\s*]/g, "");

  if (VIN_PATTERN.test(cleaned)) return cleaned;

  if (cleaned.length === 18) {
    // Import/framing prefix "I"
    if (cleaned.startsWith("I") && VIN_PATTERN.test(cleaned.slice(1))) {
      return cleaned.slice(1);
    }
    // Trailing Mod43 checksum
    if (VIN_PATTERN.test(cleaned.slice(0, 17))) {
      return cleaned.slice(0, 17);
    }
  }

  // Fallback: sliding window of 17 over longer payloads.
  // When padding is VIN-alphabet (e.g. "XX…YY"), multiple windows match
  // VIN_PATTERN — prefer the one with a valid ISO 3779 check digit.
  if (cleaned.length > 17) {
    let patternOnly: string | null = null;
    for (let i = 0; i + 17 <= cleaned.length; i++) {
      const candidate = cleaned.slice(i, i + 17);
      if (!VIN_PATTERN.test(candidate)) continue;
      if (hasValidVinCheckDigit(candidate)) return candidate;
      if (!patternOnly) patternOnly = candidate;
    }
    return patternOnly;
  }

  return null;
}

const VIN_CHECK_TRANSLITERATION: Record<string, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
  H: 8,
  J: 1,
  K: 2,
  L: 3,
  M: 4,
  N: 5,
  P: 7,
  R: 9,
  S: 2,
  T: 3,
  U: 4,
  V: 5,
  W: 6,
  X: 7,
  Y: 8,
  Z: 9
};

const VIN_CHECK_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2] as const;

export function hasValidVinCheckDigit(vin: string): boolean {
  // ISO 3779 check digit is only defined for exactly 17 characters.
  if (typeof vin !== "string" || vin.length !== 17) return false;
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const char = vin[i]!;
    const value =
      char >= "0" && char <= "9" ? Number(char) : VIN_CHECK_TRANSLITERATION[char];
    if (value === undefined) return false;
    sum += value * VIN_CHECK_WEIGHTS[i]!;
  }
  const remainder = sum % 11;
  const expected = remainder === 10 ? "X" : String(remainder);
  return vin[8] === expected;
}

export function validateWorkerVin(value: string): string | null {
  const normalized = sanitizeVinInput(value);

  if (!normalized) {
    return "Enter the full 17-character VIN.";
  }

  if (normalized.length !== VIN_LENGTH) {
    return `VIN must be exactly ${VIN_LENGTH} characters.`;
  }

  if (!/^[A-HJ-NPR-Z0-9]{17}$/u.test(normalized)) {
    return "VIN must use letters and digits only (I, O, and Q are not allowed).";
  }

  return null;
}

export function parseScannerVinInput(rawValue: string): string {
  return sanitizeVinInput(rawValue.replace(/[\r\n\t]+$/u, ""));
}

export function shouldDebounceScan(
  lastVin: string | null,
  lastAttemptAt: number | null,
  nextVin: string,
  nowMs: number,
  debounceMs = SCAN_DEBOUNCE_MS
): boolean {
  if (!lastVin || lastAttemptAt === null) {
    return false;
  }

  return lastVin === nextVin && nowMs - lastAttemptAt < debounceMs;
}

export function shouldAutoSubmitScannerVin(value: string, triggerKey: "Enter" | "Tab"): boolean {
  const normalized = parseScannerVinInput(value);
  if (normalized.length !== VIN_LENGTH) {
    return false;
  }

  return triggerKey === "Enter" || triggerKey === "Tab";
}

export function formatScanStatusPresentation(status: WorkerScanStatus): ScanStatusPresentation {
  if (status === "ready") {
    return {
      label: "Ready to scan",
      description: "Enter or scan the vehicle VIN.",
      tone: "neutral"
    };
  }

  if (status === "submitting") {
    return {
      label: "Submitting scan",
      description: "Confirming vehicle responsibility…",
      tone: "info"
    };
  }

  if (status === "matched") {
    return {
      label: "VIN matched",
      description: "Vehicle responsibility confirmed for this assignment.",
      tone: "success"
    };
  }

  if (status === "not_found") {
    return {
      label: "VIN not matched",
      description: "The scanned VIN does not match this assignment.",
      tone: "error"
    };
  }

  if (status === "already_completed") {
    return {
      label: "Already completed",
      description: "All assigned services are already marked complete.",
      tone: "warning"
    };
  }

  return {
    label: "Network error",
    description: NETWORK_ERROR_COPY,
    tone: "error"
  };
}

export function scanStatusClassName(tone: ScanStatusPresentation["tone"]): string {
  if (tone === "success") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }

  if (tone === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  if (tone === "error") {
    return "border-red-200 bg-red-50 text-red-900";
  }

  if (tone === "info") {
    return "border-brand-200 bg-brand-50 text-brand-900";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function formatLastScannedVin(vin: string | null): string {
  if (!vin) {
    return "No VIN scanned yet.";
  }

  return `Last scanned: ${vin}`;
}

export function isBrowserOffline(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return navigator.onLine === false;
}

export function isBarcodeDetectorAvailable(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return "BarcodeDetector" in window;
}

export function classifyScanResponse(input: {
  ok: boolean;
  status: number;
  message?: string;
  accepted?: boolean;
}): WorkerScanStatus {
  if (!input.ok) {
    if (input.status === 0 || input.message?.toLowerCase().includes("network")) {
      return "network_error";
    }

    if (input.message?.toLowerCase().includes("match")) {
      return "not_found";
    }

    return "not_found";
  }

  if (input.accepted === false) {
    return "not_found";
  }

  return "matched";
}

export function assignmentFullyCompleted(
  serviceLines: Array<{ completion: unknown | null }>
): boolean {
  return serviceLines.length > 0 && serviceLines.every((line) => Boolean(line.completion));
}
