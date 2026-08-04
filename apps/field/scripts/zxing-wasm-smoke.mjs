import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

/**
 * Smoke: load the exact zxing-wasm binary Field serves, prepare the reader
 * module, encode a Code 39 VIN, decode it back, and assert `_free` works.
 *
 * Does not use the camera or NHTSA.
 */
const here = dirname(fileURLToPath(import.meta.url));
const fieldRoot = join(here, "..");
const requireFromField = createRequire(join(fieldRoot, "package.json"));

function packageRootFromEntry(entryPath, expectedName) {
  let dir = dirname(entryPath);
  while (dir !== "/") {
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      if (!expectedName || pkg.name === expectedName) {
        return { root: dir, pkg };
      }
    }
    dir = dirname(dir);
  }
  throw new Error(`Could not find package ${expectedName} above ${entryPath}`);
}

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

const reactZxingEntry = requireFromField.resolve("react-zxing");
const { root: reactZxingRoot } = packageRootFromEntry(reactZxingEntry, "react-zxing");
const barcodeDetectorRoot = join(dirname(reactZxingRoot), "barcode-detector");
const requireFromBd = createRequire(join(barcodeDetectorRoot, "package.json"));
const zxingEntry = requireFromBd.resolve("zxing-wasm");
const { root: zxingRoot, pkg: zxingPkg } = packageRootFromEntry(zxingEntry, "zxing-wasm");
const depWasmPath = join(zxingRoot, "dist/reader/zxing_reader.wasm");
const publicWasmPath = join(fieldRoot, "public/wasm/zxing_reader.wasm");

if (!existsSync(depWasmPath)) {
  throw new Error(`Missing dependency WASM at ${depWasmPath}`);
}
if (!existsSync(publicWasmPath)) {
  throw new Error(`Missing public WASM at ${publicWasmPath} — run pnpm --filter field sync-wasm`);
}

const depBytes = readFileSync(depWasmPath);
const publicBytes = readFileSync(publicWasmPath);
const depHash = sha256(depBytes);
const publicHash = sha256(publicBytes);

if (depHash !== publicHash) {
  throw new Error(
    `Public WASM hash ${publicHash} does not match zxing-wasm@${zxingPkg.version} ${depHash}`
  );
}

const reader = await import(pathToFileURL(join(zxingRoot, "dist/es/reader/index.js")).href);
const writer = await import(pathToFileURL(join(zxingRoot, "dist/es/writer/index.js")).href);

const vin = "1HGBH41JXMN109186";
const written = await writer.writeBarcode(vin, {
  format: "Code39",
  scale: 3,
  quietZone: 20
});

let pngBytes;
if (written?.image instanceof Uint8Array) {
  pngBytes = written.image;
} else if (written?.image && typeof written.image.arrayBuffer === "function") {
  pngBytes = new Uint8Array(await written.image.arrayBuffer());
} else if (written instanceof Uint8Array) {
  pngBytes = written;
} else {
  throw new Error(`Unexpected writeBarcode shape: ${Object.keys(written || {}).join(",")}`);
}

const outDir = join("/tmp", "laborledger-zxing-smoke");
mkdirSync(outDir, { recursive: true });
const pngPath = join(outDir, "code39-vin.png");
writeFileSync(pngPath, pngBytes);

const ab = depBytes.buffer.slice(depBytes.byteOffset, depBytes.byteOffset + depBytes.byteLength);
reader.purgeZXingModule();
const mod = await reader.prepareZXingModule({
  overrides: { wasmBinary: ab },
  fireImmediately: true
});

if (typeof mod._free !== "function") {
  throw new Error(`_free is not a function after prepare (type=${typeof mod._free})`);
}
if (typeof mod._malloc !== "function") {
  throw new Error(`_malloc is not a function after prepare (type=${typeof mod._malloc})`);
}

const file = new Blob([pngBytes], { type: "image/png" });
const results = await reader.readBarcodesFromImageFile(file, { formats: ["Code39"] });
const texts = results.map((r) => String(r.text || r.rawValue || "").replace(/\*/g, ""));
const hit = texts.find((t) => t.includes(vin) || t === vin);

if (!hit) {
  throw new Error(`Code 39 decode missed VIN. texts=${JSON.stringify(texts)}`);
}

// Exercise free path a second time to catch glue/binary skew.
const results2 = await reader.readBarcodesFromImageFile(file, { formats: ["Code39"] });
if (!Array.isArray(results2)) {
  throw new Error("second decode did not return an array");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      zxingWasm: zxingPkg.version,
      sha256: depHash,
      publicMatch: true,
      free: typeof mod._free,
      decoded: hit,
      decodeCount: results.length
    },
    null,
    2
  )
);
