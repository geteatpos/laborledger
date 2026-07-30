import { Injectable, InternalServerErrorException, BadRequestException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import * as fs from "fs/promises";
import * as path from "path";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export type SaveEmployeePhotoInput = {
  groupId: string;
  companyId: string;
  employeeId: string;
  originalFilename: string;
  buffer: Buffer;
  mimeType: string;
};

export type SaveEmployeePhotoResult = {
  filePath: string;
  sizeBytes: number;
};

@Injectable()
export class EmployeePhotoStorageService {
  private readonly storageRoot: string;

  constructor() {
    this.storageRoot =
      process.env["STORAGE_ROOT"] ?? "/var/lib/laborledger/uploads";
  }

  async savePhoto(input: SaveEmployeePhotoInput): Promise<SaveEmployeePhotoResult> {
    const mimeType = input.mimeType?.toLowerCase() ?? "";
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException(
        `Invalid file type: ${input.mimeType}. Allowed: JPEG, PNG, WebP.`
      );
    }

    const sizeBytes = input.buffer.byteLength;
    if (sizeBytes > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `File too large: ${sizeBytes} bytes. Maximum allowed: ${MAX_FILE_SIZE_BYTES} bytes.`
      );
    }

    const ext = this.getExtensionForMimeType(mimeType);
    const filename = `photo-${randomBytes(12).toString("hex")}${ext}`;
    const relativePath = path.join(
      input.groupId,
      input.companyId,
      "employee",
      input.employeeId,
      "photo",
      filename
    );
    const absolutePath = path.join(this.storageRoot, relativePath);

    // Validate no path traversal
    if (!absolutePath.startsWith(this.storageRoot)) {
      throw new InternalServerErrorException("Invalid file path.");
    }

    try {
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, input.buffer);
    } catch {
      throw new InternalServerErrorException("Failed to save photo to storage.");
    }

    return { filePath: relativePath, sizeBytes };
  }

  async resolveAbsolutePath(filePath: string): Promise<string> {
    const absolutePath = path.join(this.storageRoot, filePath);
    // Ensure no path traversal
    if (!absolutePath.startsWith(this.storageRoot)) {
      throw new InternalServerErrorException("Invalid file path.");
    }
    try {
      await fs.access(absolutePath);
    } catch {
      throw new Error("Photo file not found on disk.");
    }
    return absolutePath;
  }

  async deletePhoto(filePath: string): Promise<void> {
    const absolutePath = path.join(this.storageRoot, filePath);
    // Ensure no path traversal
    if (!absolutePath.startsWith(this.storageRoot)) {
      throw new InternalServerErrorException("Invalid file path.");
    }
    try {
      await fs.unlink(absolutePath);
    } catch {
      // ignore missing files
    }
  }

  private getExtensionForMimeType(mimeType: string): string {
    switch (mimeType) {
      case "image/jpeg":
        return ".jpg";
      case "image/png":
        return ".png";
      case "image/webp":
        return ".webp";
      default:
        return ".jpg";
    }
  }
}
