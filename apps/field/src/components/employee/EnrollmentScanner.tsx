"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useZxing } from "react-zxing";

import { CAMERA_UNAVAILABLE_COPY } from "@/lib/worker-scanner-utils";
import { createScanDetectionGate, type ScanDetectionGate } from "@/lib/vin-camera-scan";
import {
  ensureZxingWasm,
  getZxingWasmUrl,
  isFatalZxingEngineError,
  SCANNER_ENGINE_FAILED_COPY
} from "@/lib/zxing-wasm";

const ENROLLMENT_TOKEN_MIN_LENGTH = 20;

type EnrollmentScannerPhase = "idle" | "starting" | "scanning" | "detected" | "error" | "closed";

type EnrollmentScannerSessionProps = {
  readonly onDetected: (token: string) => void;
  readonly onPhaseChange: (phase: EnrollmentScannerPhase) => void;
  readonly onError: (message: string) => void;
  readonly onRequestClose: () => void;
};

const PHASE_LABEL: Record<EnrollmentScannerPhase, string> = {
  idle: "Tap a button to start scanning.",
  starting: "Starting camera…",
  scanning: "Align the QR code in the frame.",
  detected: "Token detected.",
  error: "",
  closed: ""
};

function EnrollmentScannerSession({
  onDetected,
  onPhaseChange,
  onError,
  onRequestClose
}: EnrollmentScannerSessionProps) {
  const gateRef = useRef<ScanDetectionGate>(createScanDetectionGate(5000));
  const closedRef = useRef(false);
  const fatalEngineRef = useRef(false);
  const phaseRef = useRef<EnrollmentScannerPhase>("starting");
  const [scannedFormat, setScannedFormat] = useState<string | null>(null);
  const [phase, setPhase] = useState<EnrollmentScannerPhase>("starting");

  const setSessionPhase = useCallback(
    (next: EnrollmentScannerPhase) => {
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

      if (text.length < ENROLLMENT_TOKEN_MIN_LENGTH) {
        return;
      }

      if (!gateRef.current.accept(text)) {
        return;
      }

      setScannedFormat(formatName);
      closedRef.current = true;
      gateRef.current.close();
      setSessionPhase("detected");
      onDetected(text);
      onRequestClose();
    },
    [onDetected, onError, onRequestClose, setSessionPhase]
  );

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
    wasmUrl: getZxingWasmUrl(),
    formats: ["qr_code"],
    timeBetweenDecodingAttempts: 300,
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
            <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-emerald-400/40" />
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <span className="font-medium">
          {phase === "detected"
            ? `Detected ${scannedFormat ?? "QR code"}`
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

type EnrollmentScannerProps = {
  readonly disabled?: boolean;
  readonly onDetected: (token: string) => void;
};

export function EnrollmentScanner({ disabled = false, onDetected }: EnrollmentScannerProps) {
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [sessionId, setSessionId] = useState(0);
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState<EnrollmentScannerPhase>("idle");
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

  const handlePhaseChange = useCallback((next: EnrollmentScannerPhase) => {
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
        <EnrollmentScannerSession
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
              : "Scan QR Code"}
        </button>
      )}

      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
    </div>
  );
}
