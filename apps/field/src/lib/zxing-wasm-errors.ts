export const SCANNER_ENGINE_FAILED_COPY =
  "Scanner engine failed to initialize. Tap Retry camera to try again.";

/** True when ZXing detect() blew up because the WASM glue/binary is unusable. */
export function isFatalZxingEngineError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === "string"
        ? error
        : String(error ?? "");
  const lower = message.toLowerCase();
  return (
    lower.includes("_free") ||
    lower.includes("is not a function") ||
    lower.includes("barcode detection service unavailable") ||
    lower.includes("notsupportederror") ||
    (typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      error.name === "NotSupportedError")
  );
}
