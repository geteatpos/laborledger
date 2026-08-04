"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useZxing } from "react-zxing";

import { CAMERA_UNAVAILABLE_COPY } from "@/lib/worker-scanner-utils";
import {
  createScanDetectionGate,
  decideVinFromCode39Decode,
  releaseVideoMediaStream,
  VIN_CAMERA_BARCODE_FORMATS,
  VIN_CAMERA_DECODE_INTERVAL_MS,
  type VinCameraPhase
} from "@/lib/vin-camera-scan";
import {
  ensureZxingWasm,
  getZxingWasmUrl,
  isFatalZxingEngineError,
  SCANNER_ENGINE_FAILED_COPY
} from "@/lib/zxing-wasm";

type VinCameraScanProps = {
  readonly disabled?: boolean;
  readonly onDetected: (value: string) => void;
};

const PHASE_LABEL: Record<string, string> = {
  idle: "Tap a button to start scanning.",
  starting: "Starting camera…",
  scanning: "Align the VIN barcode in the frame.",
  detected: "VIN detected.",
  error: "",
  closed: ""
};

type SessionProps = {
  readonly onDetected: (value: string) => void;
  readonly onPhaseChange: (phase: VinCameraPhase) => void;
  readonly onError: (message: string) => void;
  readonly onRequestClose: () => void;
};

/**
 * One active reader + stream per mount. Unmounting ends the session and lets
 * react-zxing release tracks. Parent remounts via key={sessionId} for reopen.
 */
function VinCameraScanSession({
  onDetected,
  onPhaseChange,
  onError,
  onRequestClose
}: SessionProps) {
  const gateRef = useRef(createScanDetectionGate());
  const closedRef = useRef(false);
  const fatalEngineRef = useRef(false);
  const phaseRef = useRef<VinCameraPhase>("starting");
  const [scannedFormat, setScannedFormat] = useState<string | null>(null);
  const [phase, setPhase] = useState<VinCameraPhase>("starting");

  const setSessionPhase = useCallback(
    (next: VinCameraPhase) => {
      if (phaseRef.current === next) return;
      phaseRef.current = next;
      setPhase(next);
      onPhaseChange(next);
    },
    [onPhaseChange]
  );

  const handleDecodeResult = useCallback(
    (text: string, formatName: string) => {
      if (closedRef.current || !gateRef.current.isOpen()) {
        return;
      }

      const decision = decideVinFromCode39Decode(text);
      const debounceKey = decision.ok ? decision.vin : decision.cleaned;

      if (!gateRef.current.accept(debounceKey)) {
        return;
      }

      setScannedFormat(formatName);

      if (!decision.ok) {
        onError(decision.reason);
        return;
      }

      closedRef.current = true;
      gateRef.current.close();
      setSessionPhase("detected");
      onDetected(decision.vin);
      onRequestClose();
    },
    [onDetected, onError, onRequestClose, setSessionPhase]
  );

  // Fatal WASM/glue failure (e.g. `_free is not a function`): stop the decode
  // loop immediately so we don't spam the console, and surface Retry.
  const failEngine = useCallback(() => {
    if (closedRef.current || fatalEngineRef.current) return;
    fatalEngineRef.current = true;
    closedRef.current = true;
    gateRef.current.close();
    setSessionPhase("error");
    onError(SCANNER_ENGINE_FAILED_COPY);
    onRequestClose();
  }, [onError, onRequestClose, setSessionPhase]);

  const { ref: videoRef, torch } = useZxing({
    paused: false,
    // Same URL prepareWasm already initialized — never load CDN/default WASM.
    wasmUrl: getZxingWasmUrl(),
    // Limit to Code 39 — VIN barcodes on vehicles use this symbology.
    formats: [...VIN_CAMERA_BARCODE_FORMATS],
    timeBetweenDecodingAttempts: VIN_CAMERA_DECODE_INTERVAL_MS,
    trySkew: false,
    constraints: {
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920, max: 1920 },
        height: { ideal: 1080, max: 1080 }
      }
    },
    onDecodeResult: (result) => {
      if (closedRef.current || fatalEngineRef.current) return;
      setSessionPhase("scanning");
      handleDecodeResult(result.rawValue ?? "", result.format ?? "Unknown");
    },
    onDecodeError: (error) => {
      if (closedRef.current || fatalEngineRef.current) return;
      // Empty frames are normal. Fatal WASM glue failures must stop the loop.
      if (isFatalZxingEngineError(error)) {
        failEngine();
      }
    },
    onError: (error) => {
      if (closedRef.current || fatalEngineRef.current) return;
      if (isFatalZxingEngineError(error)) {
        failEngine();
        return;
      }
      closedRef.current = true;
      gateRef.current.close();
      setSessionPhase("error");
      onError(error instanceof Error ? error.message : "Camera scanner failed to start.");
      onRequestClose();
    }
  });

  useEffect(() => {
    onPhaseChange("starting");
    const readyTimer = window.setInterval(() => {
      if (closedRef.current) return;
      const video = videoRef.current;
      if (video?.srcObject && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        setSessionPhase("scanning");
        window.clearInterval(readyTimer);
      }
    }, 100);

    return () => {
      window.clearInterval(readyTimer);
      closedRef.current = true;
      gateRef.current.close();
      releaseVideoMediaStream(videoRef.current);
    };
  }, [onPhaseChange, setSessionPhase, videoRef]);

  return (
    <>
      <div className="relative h-64 w-full overflow-hidden rounded-xl border border-slate-200 bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="h-full w-full object-cover"
        />
        {phase === "scanning" ? (
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <span className="absolute left-3 top-3 h-5 w-5 border-l-2 border-t-2 border-emerald-400/90" />
            <span className="absolute right-3 top-3 h-5 w-5 border-r-2 border-t-2 border-emerald-400/90" />
            <span className="absolute left-3 bottom-3 h-5 w-5 border-l-2 border-b-2 border-emerald-400/90" />
            <span className="absolute right-3 bottom-3 h-5 w-5 border-r-2 border-b-2 border-emerald-400/90" />
            <span className="vin-scanline absolute inset-x-3 top-3 h-[2px] bg-gradient-to-r from-transparent via-emerald-300 to-transparent shadow-[0_0_8px_rgba(110,231,183,0.85)]" />
            <span className="absolute inset-x-6 top-1/2 -translate-y-1/2 rounded border border-emerald-400/40 bg-emerald-400/5" />
            <span className="absolute left-6 right-6 top-1/2 -translate-y-1/2 flex-col items-center">
              <span className="block h-[1px] w-full bg-emerald-400/50" />
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <span className="font-medium">
          {phase === "detected"
            ? `Detected ${scannedFormat ?? "barcode"}`
            : PHASE_LABEL[phase] || PHASE_LABEL.scanning}
        </span>
        <div className="flex gap-2">
          {torch.isAvailable ? (
            <button
              type="button"
              onClick={() => (torch.isOn ? void torch.off() : void torch.on())}
              className="rounded-md bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-300"
            >
              {torch.isOn ? "Torch off" : "Torch on"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              closedRef.current = true;
              gateRef.current.close();
              releaseVideoMediaStream(videoRef.current);
              onRequestClose();
            }}
            className="rounded-md bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Stop camera
          </button>
        </div>
      </div>
    </>
  );
}

export function VinCameraScan({ disabled = false, onDetected }: VinCameraScanProps) {
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [sessionId, setSessionId] = useState(0);
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState<VinCameraPhase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!navigator?.mediaDevices?.getUserMedia) {
      setShowUnavailable(true);
    }
  }, []);

  const endSession = useCallback(() => {
    setActive(false);
    setStarting(false);
    setPhase((current) => (current === "detected" || current === "error" ? current : "idle"));
  }, []);

  const startCamera = useCallback(async () => {
    if (starting || active) return;
    setErrorMessage(null);
    setStarting(true);
    setPhase("starting");
    try {
      // CRITICAL: prepareWasm with our hosted binary BEFORE useZxing mounts
      // BarcodeDetector (which otherwise fires CDN prepareZXingModule first,
      // and a second prepare with a different locateFile corrupts the module —
      // `TypeError: _free is not a function`).
      await ensureZxingWasm();
      setSessionId((current) => current + 1);
      setActive(true);
    } catch {
      setPhase("error");
      setErrorMessage(SCANNER_ENGINE_FAILED_COPY);
    } finally {
      setStarting(false);
    }
  }, [active, starting]);

  const handlePhaseChange = useCallback((next: VinCameraPhase) => {
    setPhase(next);
  }, []);

  const handleError = useCallback((message: string) => {
    setErrorMessage(message);
  }, []);

  if (showUnavailable) {
    return (
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
        {CAMERA_UNAVAILABLE_COPY}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {active ? (
        <VinCameraScanSession
          key={sessionId}
          onDetected={onDetected}
          onPhaseChange={handlePhaseChange}
          onError={handleError}
          onRequestClose={endSession}
        />
      ) : (
        <button
          type="button"
          onClick={() => void startCamera()}
          disabled={disabled || starting}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          {starting
            ? "Starting camera…"
            : phase === "error"
              ? "Retry camera"
              : "Scan with camera"}
        </button>
      )}

      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
    </div>
  );
}
