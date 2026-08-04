import {
  extractVinFromScan,
  hasValidVinCheckDigit,
  VIN_LENGTH
} from "@/lib/worker-scanner-utils";

/** ZXing / barcode-detector format list for physical VIN stickers (Code 39). */
export const VIN_CAMERA_BARCODE_FORMATS = ["code_39"] as const;

export type VinCameraBarcodeFormat = (typeof VIN_CAMERA_BARCODE_FORMATS)[number];

export const VIN_CAMERA_DECODE_INTERVAL_MS = 300;
export const VIN_CAMERA_DEBOUNCE_MS = 2000;

export type VinCameraPhase = "idle" | "starting" | "scanning" | "detected" | "error" | "closed";

export type ScanDetectionGate = {
  readonly accept: (key: string, nowMs?: number) => boolean;
  readonly reset: () => void;
  readonly close: () => void;
  readonly open: () => void;
  readonly isOpen: () => boolean;
};

/**
 * Gate for decode results within one camera session.
 * - Blocks duplicate reads of the same payload while it remains in frame.
 * - After close(), all results are ignored (unmount / stop / post-success).
 * - reset() clears the duplicate lock so a second VIN can be accepted.
 */
export function createScanDetectionGate(debounceMs = VIN_CAMERA_DEBOUNCE_MS): ScanDetectionGate {
  let open = true;
  let last: { value: string; at: number } | null = null;

  return {
    accept(key: string, nowMs = Date.now()): boolean {
      if (!open) return false;
      if (last && last.value === key && nowMs - last.at < debounceMs) {
        return false;
      }
      last = { value: key, at: nowMs };
      return true;
    },
    reset() {
      last = null;
    },
    close() {
      open = false;
    },
    open() {
      open = true;
      last = null;
    },
    isOpen() {
      return open;
    }
  };
}

/** Trim, uppercase, drop accidental spaces and Code 39 start/stop `*` delimiters. */
export function normalizeCode39VinPayload(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s*]/g, "");
}

export type VinDecodeDecision =
  | { readonly ok: true; readonly vin: string; readonly cleaned: string }
  | { readonly ok: false; readonly cleaned: string; readonly reason: string };

/**
 * Validate a Code 39 decode payload against the repo VIN contract.
 * Does not call NHTSA or invent stub VINs.
 */
export function decideVinFromCode39Decode(raw: string): VinDecodeDecision {
  const cleaned = normalizeCode39VinPayload(raw);
  const vin = extractVinFromScan(raw);

  if (vin === null) {
    return {
      ok: false,
      cleaned,
      reason: `Detected ${cleaned.length} characters. Move closer or align the VIN, then we will keep scanning.`
    };
  }

  if (vin.length !== VIN_LENGTH || !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
    return {
      ok: false,
      cleaned,
      reason: `Invalid VIN structure (${vin.length} chars). A VIN must be exactly ${VIN_LENGTH} characters using letters (except I, O, Q) and digits.`
    };
  }

  if (cleaned.length === VIN_LENGTH && !hasValidVinCheckDigit(vin)) {
    return {
      ok: false,
      cleaned,
      reason: "Invalid VIN check digit. The scanned barcode may be damaged or not a valid VIN."
    };
  }

  return { ok: true, vin, cleaned };
}

/** Idempotent release of MediaStream tracks attached to a video element. */
export function releaseVideoMediaStream(videoEl: HTMLVideoElement | null | undefined): void {
  if (!videoEl) return;
  const srcObject = videoEl.srcObject;
  if (!srcObject || typeof (srcObject as MediaStream).getTracks !== "function") {
    videoEl.srcObject = null;
    return;
  }
  const stream = srcObject as MediaStream;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      // Idempotent: already stopped tracks must not throw.
    }
  }
  videoEl.srcObject = null;
}

export function releaseMediaStream(stream: MediaStream | null | undefined): void {
  if (!stream || typeof stream.getTracks !== "function") return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      // Idempotent cleanup.
    }
  }
}
