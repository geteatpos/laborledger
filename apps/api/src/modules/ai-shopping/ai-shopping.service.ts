import * as fs from "node:fs/promises";

import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException
} from "@nestjs/common";
import type { MechanicOrderPart, VehiclePhoto } from "@prisma/client";

import { PrismaService } from "../identity-access/prisma.service";
import { PriceScraperService } from "../price-scraper/price-scraper.service";
import { StorageService } from "../storage/storage.service";

export type AiShoppingConfidence = "HIGH" | "MEDIUM" | "LOW";

export type AiShoppingResult = {
  identifiedName: string;
  identifiedPartNumber: string | null;
  confidence: AiShoppingConfidence;
  suggestedQuery: string;
  rawResponse: string | null;
  errorMessage: string | null;
};

export type StoreSearchLink = {
  store: string;
  url: string;
  price: number | null;
};

const ALLOWED_CONFIDENCE: AiShoppingConfidence[] = ["HIGH", "MEDIUM", "LOW"];
const OPENAI_TIMEOUT_MS = 25_000;
const CACHE_TTL_MS = 60_000;

type CacheEntry = {
  result: AiShoppingResult;
  expiresAt: number;
};

type VehicleContext = {
  year: number | null;
  make: string | null;
  model: string | null;
};

@Injectable()
export class AiShoppingService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StorageService) private readonly storageService: StorageService,
    @Inject(PriceScraperService) private readonly priceScraper: PriceScraperService
  ) {}

  async identifyAndPersist(opts: {
    partId: string;
    companyId: string;
    workOrderId: string;
    vin?: string;
    photoId?: string;
  }): Promise<MechanicOrderPart> {
    const part = await this.prisma.mechanicOrderPart.findFirst({
      where: {
        id: opts.partId,
        companyId: opts.companyId,
        workOrderId: opts.workOrderId
      }
    });

    if (!part) {
      throw new NotFoundException("Part not found for this work order and company.");
    }

    const photoId = opts.photoId?.trim() || part.photoId;
    if (!photoId) {
      throw new BadRequestException(
        "This part has no photo. AI identification requires a photo or VIN context."
      );
    }

    const photo = await this.prisma.vehiclePhoto.findFirst({
      where: { id: photoId, companyId: opts.companyId, deletedAt: null }
    });

    if (!photo) {
      throw new NotFoundException("Photo not found for this company.");
    }

    const vehicle = await this.loadVehicleContext(opts.workOrderId, opts.companyId);

    const cacheKey = `${opts.partId}:${photo.id}`;
    let result = this.getCached(cacheKey);

    if (!result) {
      result = await this.callOpenAiVision({ photo, vin: opts.vin, vehicle });
      if (!result.errorMessage) {
        this.setCache(cacheKey, result);
      }
    }

    if (result.errorMessage) {
      throw new UnprocessableEntityException(result.errorMessage);
    }

    return this.prisma.mechanicOrderPart.update({
      where: { id: part.id },
      data: {
        identifiedName: result.identifiedName,
        identifiedPartNumber: result.identifiedPartNumber,
        identifiedAt: new Date()
      }
    });
  }

  async buildShoppingLinksForPart(opts: {
    companyId: string;
    workOrderId: string;
    partId: string;
  }): Promise<StoreSearchLink[]> {
    const part = await this.prisma.mechanicOrderPart.findFirst({
      where: {
        id: opts.partId,
        companyId: opts.companyId,
        workOrderId: opts.workOrderId
      }
    });

    if (!part) {
      throw new NotFoundException("Part not found.");
    }

    const vehicle = await this.loadVehicleContext(opts.workOrderId, opts.companyId);

    const querySource = part.identifiedName?.trim() || part.name.trim();
    if (!querySource) {
      return [];
    }

    const query = this.buildSearchQuery(querySource, vehicle);
    const baseLinks = this.buildStoreLinks(query, querySource);

    const withTimeout = Promise.race<Record<string, { price: number | null }>>([
      this.priceScraper.scrapeAll(query) as Promise<Record<string, { price: number | null }>>,
      new Promise((resolve) =>
        setTimeout(
          () => resolve({} as Record<string, { price: number | null }>),
          20_000
        )
      )
    ]);

    let scraped: Record<string, { price: number | null }> = {};
    try {
      scraped = await withTimeout;
    } catch {
      scraped = {};
    }

    const priceByStore: Record<string, number | null> = {
      Amazon: scraped.Amazon?.price ?? null,
      RockAuto: scraped.RockAuto?.price ?? null,
      AutoZone: scraped.AutoZone?.price ?? null,
      NAPA: scraped.NAPA?.price ?? null,
      "O'Reilly Auto Parts": scraped.OReilly?.price ?? null,
      "Advance Auto Parts": scraped.Advance?.price ?? null,
      "eBay Motors": scraped.EbayMotors?.price ?? null
    };

    return baseLinks
      .map((link) => ({ ...link, price: priceByStore[link.store] ?? null }))
      .sort((a, b) => {
        if (a.price != null && b.price != null) return a.price - b.price;
        if (a.price != null) return -1;
        if (b.price != null) return 1;
        return 0;
      });
  }

  private async loadVehicleContext(
    workOrderId: string,
    companyId: string
  ): Promise<VehicleContext> {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, companyId },
      include: { vehicle: true }
    });

    if (!workOrder) {
      return { year: null, make: null, model: null };
    }

    return {
      year: workOrder.vehicle?.year ?? null,
      make: workOrder.vehicle?.make ?? null,
      model: workOrder.vehicle?.model ?? null
    };
  }

  private buildSearchQuery(partName: string, vehicle: VehicleContext): string {
    const vehiclePrefix = [vehicle.year, vehicle.make, vehicle.model]
      .filter(Boolean)
      .join(" ")
      .trim();

    return vehiclePrefix ? `${vehiclePrefix} ${partName}`.trim() : partName.trim();
  }

  private buildStoreLinks(query: string, originalName: string): StoreSearchLink[] {
    const encoded = encodeURIComponent(query);
    const encodedOriginal = encodeURIComponent(originalName);

    return [
      {
        store: "Amazon",
        url: `https://www.amazon.com/s?k=${encoded}`,
        price: null
      },
      {
        store: "RockAuto",
        url: `https://www.rockauto.com/en/partsearch/?q=${encoded}`,
        price: null
      },
      {
        store: "AutoZone",
        url: `https://www.autozone.com/searchresult?searchText=${encoded}`,
        price: null
      },
      {
        store: "NAPA",
        url: `https://www.napaonline.com/en/search?q=${encoded}`,
        price: null
      },
      {
        store: "O'Reilly Auto Parts",
        url: `https://www.oreillyauto.com/search?q=${encoded}`,
        price: null
      },
      {
        store: "Advance Auto Parts",
        url: `https://shop.advanceautoparts.com/web/SearchResults?searchTerm=${encoded}`,
        price: null
      },
      {
        store: "eBay Motors",
        url: `https://www.ebay.com/sch/i.html?_nkw=${encodedOriginal}&_sacat=6028`,
        price: null
      }
    ];
  }

  private async callOpenAiVision(input: {
    photo: Pick<VehiclePhoto, "filePath" | "mimeType">;
    vin?: string;
    vehicle: VehicleContext;
  }): Promise<AiShoppingResult> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return this.emptyResult(
        "AI shopping is disabled (OPENAI_API_KEY missing at runtime). Use the part name to search manually."
      );
    }

    const model = process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o-mini";

    let base64: string;
    try {
      const absolutePath = await this.storageService.resolveAbsolutePath(input.photo.filePath);
      const buffer = await fs.readFile(absolutePath);
      base64 = buffer.toString("base64");
    } catch (err) {
      return this.emptyResult(
        err instanceof Error ? err.message : "Could not read photo file"
      );
    }

    const vehicleContext = [input.vehicle.year, input.vehicle.make, input.vehicle.model]
      .filter(Boolean)
      .join(" ");

    const systemPrompt = `You are an automotive parts identification assistant.
The user will provide a vehicle VIN, vehicle context, and a photo of an automotive part.
Identify the part as precisely as possible in English.
Respond ONLY with a valid JSON object, no markdown, no commentary.
JSON schema:
{
  "identifiedName": "string (precise part name in English, e.g. 'Front brake pads — Akebono Pro-ACT ceramic')",
  "identifiedPartNumber": "string or null (OEM or aftermarket part number if identifiable)",
  "confidence": "HIGH | MEDIUM | LOW"
}
If you cannot identify the part, return confidence LOW with your best guess for identifiedName.`;

    const userPrompt = [
      input.vin?.trim() ? `VIN: ${input.vin.trim()}` : null,
      vehicleContext ? `Vehicle: ${vehicleContext}` : null,
      "Identify the automotive part shown in this image."
    ]
      .filter(Boolean)
      .join("\n");

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          max_tokens: 300,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: userPrompt },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${input.photo.mimeType};base64,${base64}`,
                    detail: "low"
                  }
                }
              ]
            }
          ]
        })
      });

      clearTimeout(timeoutHandle);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        return this.emptyResult(
          `OpenAI API error: ${response.status} ${errorBody.slice(0, 200)}`
        );
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const raw = data.choices?.[0]?.message?.content ?? "";

      let parsed: {
        identifiedName?: string;
        identifiedPartNumber?: string | null;
        confidence?: string;
      };
      try {
        parsed = JSON.parse(raw) as typeof parsed;
      } catch {
        const cleaned = raw.replace(/```json|```/g, "").trim();
        try {
          parsed = JSON.parse(cleaned) as typeof parsed;
        } catch {
          return {
            identifiedName: "",
            identifiedPartNumber: null,
            confidence: "LOW",
            suggestedQuery: "",
            rawResponse: raw,
            errorMessage: "OpenAI returned unparsable JSON"
          };
        }
      }

      const identifiedName = parsed.identifiedName?.trim() || "";
      const identifiedPartNumber = parsed.identifiedPartNumber?.trim() || null;
      const confidence: AiShoppingConfidence = ALLOWED_CONFIDENCE.includes(
        parsed.confidence as AiShoppingConfidence
      )
        ? (parsed.confidence as AiShoppingConfidence)
        : "LOW";

      return {
        identifiedName: identifiedName || "Unknown part",
        identifiedPartNumber,
        confidence,
        suggestedQuery: this.buildSearchQuery(identifiedName || "Unknown part", input.vehicle),
        rawResponse: raw,
        errorMessage: null
      };
    } catch (err) {
      clearTimeout(timeoutHandle);
      if (err instanceof Error && err.name === "AbortError") {
        throw new ServiceUnavailableException("AI service timed out. Please try again.");
      }
      return this.emptyResult(err instanceof Error ? err.message : "OpenAI request failed");
    }
  }

  private emptyResult(errorMessage: string): AiShoppingResult {
    return {
      identifiedName: "",
      identifiedPartNumber: null,
      confidence: "LOW",
      suggestedQuery: "",
      rawResponse: null,
      errorMessage
    };
  }

  private getCached(key: string): AiShoppingResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.result;
  }

  private setCache(key: string, result: AiShoppingResult): void {
    this.cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
  }
}
