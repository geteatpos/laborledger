import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import * as fs from "fs/promises";
import * as path from "path";

export type SaveFileInput = {
  groupId: string;
  companyId: string;
  vehicleId: string;
  category: string;
  originalFilename: string;
  buffer: Buffer;
  mimeType: string;
};

export type SaveFileResult = {
  filePath: string;
  sizeBytes: number;
};

const ALLOWED_CATEGORIES = new Set([
  "reception",
  "exterior",
  "interior",
  "damage",
  "part"
]);

@Injectable()
export class StorageService {
  private readonly storageRoot: string;

  constructor() {
    this.storageRoot =
      process.env["STORAGE_ROOT"] ?? "/var/lib/laborledger/uploads";
  }

  async saveFile(input: SaveFileInput): Promise<SaveFileResult> {
    const category = input.category?.toLowerCase() ?? "";
    if (!ALLOWED_CATEGORIES.has(category)) {
      throw new InternalServerErrorException(
        `Invalid photo category: ${input.category}`
      );
    }

    const ext = path.extname(input.originalFilename) || ".jpg";
    const safeExt = ext.toLowerCase().replace(/[^.a-z0-9]/g, "");
    const filename = `photo-${randomBytes(12).toString("hex")}${safeExt || ".jpg"}`;
    const relativePath = path.join(
      input.groupId,
      input.companyId,
      input.vehicleId,
      category,
      filename
    );
    const absolutePath = path.join(this.storageRoot, relativePath);

    try {
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, input.buffer);
    } catch {
      throw new InternalServerErrorException("Failed to save file to storage");
    }

    return { filePath: relativePath, sizeBytes: input.buffer.byteLength };
  }

  async resolveAbsolutePath(filePath: string): Promise<string> {
    const absolutePath = path.join(this.storageRoot, filePath);
    // Prevent path traversal: ensure resolved path is still within storageRoot
    if (!absolutePath.startsWith(this.storageRoot)) {
      throw new Error("Invalid file path.");
    }
    try {
      await fs.access(absolutePath);
    } catch {
      throw new Error("File not found on disk");
    }
    return absolutePath;
  }

  async deleteFile(filePath: string): Promise<void> {
    const absolutePath = path.join(this.storageRoot, filePath);
    // Prevent path traversal
    if (!absolutePath.startsWith(this.storageRoot)) {
      return; // Silently reject for delete — same as "file not found"
    }
    try {
      await fs.unlink(absolutePath);
    } catch {
      // ignore missing files
    }
  }
}
