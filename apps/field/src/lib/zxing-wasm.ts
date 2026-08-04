import { prepareWasm } from "react-zxing";

import {
  ZXING_WASM_PACKAGE_VERSION,
  ZXING_WASM_SHA256,
  ZXING_WASM_URL
} from "@/lib/zxing-wasm-asset";

export {
  BARCODE_DETECTOR_VERSION,
  REACT_ZXING_VERSION,
  ZXING_WASM_BYTES,
  ZXING_WASM_PACKAGE_VERSION,
  ZXING_WASM_PUBLIC_PATH,
  ZXING_WASM_SHA256,
  ZXING_WASM_URL
} from "@/lib/zxing-wasm-asset";

export {
  isFatalZxingEngineError,
  SCANNER_ENGINE_FAILED_COPY
} from "@/lib/zxing-wasm-errors";

/**
 * Shared prepareWasm() promise for the whole Field app.
 * Must complete BEFORE any BarcodeDetector / useZxing mounts — otherwise
 * barcode-detector's constructor fires CDN prepareZXingModule first and a
 * second prepare with a different locateFile corrupts the WASM module
 * (TypeError: _free is not a function).
 */
let preparePromise: Promise<void> | null = null;

export function getZxingWasmUrl(): string {
  return ZXING_WASM_URL;
}

export async function ensureZxingWasm(): Promise<{
  readonly url: string;
  readonly version: string;
  readonly sha256: string;
}> {
  if (!preparePromise) {
    preparePromise = prepareWasm({ wasmUrl: ZXING_WASM_URL }).catch((error) => {
      preparePromise = null;
      throw error;
    });
  }
  await preparePromise;
  return {
    url: ZXING_WASM_URL,
    version: ZXING_WASM_PACKAGE_VERSION,
    sha256: ZXING_WASM_SHA256
  };
}
