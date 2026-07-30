import "reflect-metadata";

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { NhtsaVpicVinDecoderService } from "../src/modules/vin-decode/nhtsa-vpic-vin-decoder.service";
import { VinDecodeService } from "../src/modules/vin-decode/vin-decode.service";
import { StubVinDecoderService } from "../src/modules/vin-decode/stub-vin-decoder.service";
import { mapNhtsaVpicResponse } from "../src/modules/vin-decode/nhtsa-vpic-mapper";

const TEST_VIN = "1HGCM82633A004352";

describe("VIN Decoder Unit Tests", () => {
  describe("NhtsaVpicVinDecoderService", () => {
    describe("successful decode", () => {
      it("returns decoded result with all fields on clean NHTSA response", async () => {
        const cleanResponse = {
          Results: [
            {
              "Model Year": "2003",
              Make: "HONDA",
              Model: "Accord",
              Trim: "EX",
              "Body Class": "Coupe",
              "Vehicle Type": "PASSENGER CAR",
              "Fuel Type - Primary": "Gasoline",
              "Engine Number of Cylinders": "4",
              "Displacement (L)": "2.4",
              "Manufacturer Name": "AMERICAN HONDA MOTOR CO., INC.",
              "Plant Country": "UNITED STATES (USA)",
              ErrorCode: "0",
              "Error Text": "0 - VIN decoded clean."
            }
          ]
        };

        const mockFetch = vi.fn().mockResolvedValue(
          new Response(JSON.stringify(cleanResponse), {
            status: 200,
            headers: { "content-type": "application/json" }
          })
        );

        const decoder = new NhtsaVpicVinDecoderService(mockFetch);
        const result = await decoder.decode(TEST_VIN);

        expect(result.source).toBe("NHTSA_VPIC");
        expect(result.make).toBe("HONDA");
        expect(result.model).toBe("Accord");
        expect(result.year).toBe(2003);
        expect(result.errorCode).toBe("0");
        expect(result.rawPayload).toEqual(cleanResponse);
      });

      it("throws when NHTSA cannot decode any vehicle fields", async () => {
        const emptyResponse = {
          Results: [
            {
              ErrorCode: "2",
              "Error Text": "Not decoded."
            }
          ]
        };

        const mockFetch = vi.fn().mockResolvedValue(
          new Response(JSON.stringify(emptyResponse), {
            status: 200,
            headers: { "content-type": "application/json" }
          })
        );

        const decoder = new NhtsaVpicVinDecoderService(mockFetch);
        await expect(decoder.decode(TEST_VIN)).rejects.toThrow(/not decoded/i);
      });
    });

    describe("timeout handling", () => {
      it("throws ServiceUnavailableException on timeout", async () => {
        const mockFetch = vi.fn().mockImplementation(
          () =>
            new Promise((_, reject) => {
              setTimeout(() => reject(new Error("timeout")), 100);
            })
        );

        const decoder = new NhtsaVpicVinDecoderService(mockFetch as typeof fetch);

        await expect(decoder.decode(TEST_VIN, { modelYear: 2003 })).rejects.toThrow(
          /timed out|failed/i
        );
      });
    });

    describe("HTTP error handling", () => {
      it("throws ServiceUnavailableException on HTTP 500", async () => {
        const mockFetch = vi.fn().mockResolvedValue(
          new Response("Internal Server Error", { status: 500 })
        );

        const decoder = new NhtsaVpicVinDecoderService(mockFetch);

        await expect(decoder.decode(TEST_VIN)).rejects.toThrow(/unavailable right now/i);
      });

      it("throws ServiceUnavailableException on HTTP 404", async () => {
        const mockFetch = vi.fn().mockResolvedValue(
          new Response("Not Found", { status: 404 })
        );

        const decoder = new NhtsaVpicVinDecoderService(mockFetch);

        await expect(decoder.decode(TEST_VIN)).rejects.toThrow(/unavailable right now/i);
      });

      it("does not retry transient HTTP 502 errors", async () => {
        const mockFetch = vi
          .fn()
          .mockResolvedValueOnce(new Response("Bad Gateway", { status: 502 }))
          .mockResolvedValueOnce(
            new Response(
              JSON.stringify({
                Results: [{ ErrorCode: "0", Make: "HONDA", Model: "Accord" }]
              }),
              { status: 200, headers: { "content-type": "application/json" } }
            )
          );

        const decoder = new NhtsaVpicVinDecoderService(mockFetch);
        await expect(decoder.decode(TEST_VIN)).rejects.toThrow(/unavailable right now/i);
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });
    });

    describe("rawPayload JSON serialization", () => {
      it("rawPayload is a valid JSON-serializable object", async () => {
        const response = {
          Results: [
            {
              "Model Year": "2003",
              Make: "HONDA",
              Model: "Accord",
              ErrorCode: "0"
            }
          ]
        };

        const mockFetch = vi.fn().mockResolvedValue(
          new Response(JSON.stringify(response), {
            status: 200,
            headers: { "content-type": "application/json" }
          })
        );

        const decoder = new NhtsaVpicVinDecoderService(mockFetch);
        const result = await decoder.decode(TEST_VIN);

        const serialized = JSON.stringify(result.rawPayload);
        const deserialized = JSON.parse(serialized);

        expect(deserialized).toEqual(response);
        expect(deserialized.Results[0].Make).toBe("HONDA");
      });

      it("maps valid response with all expected JSON properties", async () => {
        const response = {
          Results: [
            {
              "Model Year": "2003",
              Make: "HONDA",
              Model: "Accord",
              ErrorCode: "0"
            }
          ]
        };

        const mockFetch = vi.fn().mockResolvedValue(
          new Response(JSON.stringify(response), {
            status: 200,
            headers: { "content-type": "application/json" }
          })
        );

        const decoder = new NhtsaVpicVinDecoderService(mockFetch);
        const result = await decoder.decode(TEST_VIN);

        expect(() => JSON.stringify(result.rawPayload)).not.toThrow();
        expect(result.rawPayload).toBeTruthy();
      });
    });
  });

  describe("VinDecodeService decoder selection", () => {
    let originalDecoder: string | undefined;

    beforeEach(() => {
      originalDecoder = process.env.VIN_DECODER;
    });

    afterEach(() => {
      process.env.VIN_DECODER = originalDecoder;
      vi.restoreAllMocks();
    });

    it("uses stub by default", () => {
      delete process.env.VIN_DECODER;

      const nhtsaDecoder = new NhtsaVpicVinDecoderService();
      const stubDecoder = new StubVinDecoderService();
      const service = new VinDecodeService(stubDecoder, nhtsaDecoder);

      expect((service as unknown as { resolveDecoder: () => { constructor: { name: string } } }).resolveDecoder?.()?.constructor?.name).toBe("StubVinDecoderService");
    });

    it("uses stub only when VIN_DECODER=stub is explicitly set", () => {
      process.env.VIN_DECODER = "stub";

      const nhtsaDecoder = new NhtsaVpicVinDecoderService();
      const stubDecoder = new StubVinDecoderService();
      const service = new VinDecodeService(stubDecoder, nhtsaDecoder);

      expect((service as unknown as { resolveDecoder: () => { constructor: { name: string } } }).resolveDecoder?.()?.constructor?.name).toBe("StubVinDecoderService");
    });

    it("does NOT silently fall back to stub when NHTSA is unavailable", async () => {
      process.env.VIN_DECODER = "nhtsa";

      const failingFetch = vi.fn().mockRejectedValue(new Error("Network failure"));
      const nhtsaDecoder = new NhtsaVpicVinDecoderService(failingFetch);
      const stubDecoder = new StubVinDecoderService();
      const service = new VinDecodeService(stubDecoder, nhtsaDecoder);

      await expect(service.decodeVin(TEST_VIN)).rejects.toThrow(/timed out|failed/i);
    });
  });

  describe("StubVinDecoderService", () => {
    it("returns deterministic stub data for known VINs", async () => {
      const decoder = new StubVinDecoderService();
      const result = await decoder.decode("1HGBH41JXMN109186");

      expect(result.source).toBe("STUB");
      expect(result.make).toBe("Honda");
      expect(result.model).toBe("Civic");
      expect(result.rawPayload).toEqual({
        vin: "1HGBH41JXMN109186",
        provider: "stub-known",
        mapped: true
      });
    });

    it("returns derived data for unknown VINs", async () => {
      const decoder = new StubVinDecoderService();
      const result = await decoder.decode("1HGBH41JXMN999999");

      expect(result.source).toBe("STUB");
      expect(result.make).toBe("Stub Make");
      expect(result.model).toBe("Stub Model");
      expect(result.rawPayload.provider).toBe("stub-derived");
    });

    it("rawPayload is valid JSON for Prisma storage", async () => {
      const decoder = new StubVinDecoderService();
      const result = await decoder.decode("1HGBH41JXMN109186");

      const serialized = JSON.stringify(result.rawPayload);
      const deserialized = JSON.parse(serialized);

      expect(deserialized).toEqual({
        vin: "1HGBH41JXMN109186",
        provider: "stub-known",
        mapped: true
      });
    });
  });

  describe("mapNhtsaVpicResponse", () => {
    it("maps ErrorCode != 0 without falling back to stub data", () => {
      const payload = {
        Results: [
          {
            Make: null,
            Model: null,
            ErrorCode: "2",
            "Error Text": "Not decoded."
          }
        ]
      };

      const result = mapNhtsaVpicResponse(TEST_VIN, payload, new Date().toISOString());

      expect(result.source).toBe("NHTSA_VPIC");
      expect(result.make).toBeNull();
      expect(result.errorCode).toBe("2");
      expect(result.rawPayload).toEqual(payload);
    });
  });
});
