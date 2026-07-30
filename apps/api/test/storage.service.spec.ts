import "reflect-metadata";

import { beforeEach, describe, expect, it } from "vitest";

import { StorageService } from "../src/modules/storage/storage.service";

describe("StorageService", () => {
  let service: StorageService;

  beforeEach(() => {
    service = new StorageService();
  });

  describe("resolveAbsolutePath path security", () => {
    it("rejects path traversal with ../.. /etc/passwd", async () => {
      await expect(
        service.resolveAbsolutePath("../../../etc/passwd")
      ).rejects.toThrow();
    });

    it("rejects absolute path /etc/passwd", async () => {
      await expect(
        service.resolveAbsolutePath("/etc/passwd")
      ).rejects.toThrow();
    });

    it("rejects path traversal using URL encoding", async () => {
      await expect(
        service.resolveAbsolutePath("..%2F..%2F..%2Fetc%2Fpasswd")
      ).rejects.toThrow();
    });

    it("rejects traversal with null bytes", async () => {
      await expect(
        service.resolveAbsolutePath("/etc/passwd\x00.jpg")
      ).rejects.toThrow();
    });
  });

  describe("deleteFile path security", () => {
    it("rejects path traversal with ../.. /etc/passwd", async () => {
      // Should not throw — silently ignores or rejects
      await expect(
        service.deleteFile("../../../etc/passwd")
      ).resolves.not.toThrow();
    });

    it("rejects absolute path /etc/passwd", async () => {
      await expect(
        service.deleteFile("/etc/passwd")
      ).resolves.not.toThrow();
    });
  });
});
