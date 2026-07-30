import * as fs from "node:fs/promises";

import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from "@nestjs/common";
import type { MechanicOrderPart, MechanicPartAiSuggestion } from "@prisma/client";

import { PrismaService } from "../identity-access/prisma.service";
import { StorageService } from "../storage/storage.service";

export type AiConfidence = "HIGH" | "MEDIUM" | "LOW";

export type AiSuggestionResult = {
  suggestedName: string;
  suggestedPartNumber: string | null;
  confidence: AiConfidence;
  rawResponse: string | null;
  errorMessage: string | null;
};

type CacheEntry = {
  result: AiSuggestionResult;
  expiresAt: number;
};

const CACHE_TTL_MS = 60_000;
const OPENAI_TIMEOUT_MS = 25_000;
const ALLOWED_CONFIDENCE: AiConfidence[] = ["HIGH", "MEDIUM", "LOW"];

@Injectable()
export class AiPartIdService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StorageService) private readonly storageService: StorageService
  ) {}

  async identifyPart(opts: {
    partId: string;
    companyId: string;
    vin: string;
    photoId: string;
  }): Promise<MechanicPartAiSuggestion> {
    const part = await this.prisma.mechanicOrderPart.findFirst({
      where: { id: opts.partId, companyId: opts.companyId }
    });
    if (!part) {
      throw new NotFoundException("Part not found for this company.");
    }

    const photo = await this.prisma.vehiclePhoto.findFirst({
      where: {
        id: opts.photoId,
        companyId: opts.companyId,
        deletedAt: null
      }
    });
    if (!photo) {
      throw new NotFoundException("Photo not found for this company.");
    }

    const cacheKey = `${opts.vin}:${opts.photoId}`;
    let result = this.getCached(cacheKey);

    if (!result) {
      result = await this.callOpenAI({ photo, vin: opts.vin });
      if (!result.errorMessage) {
        this.setCache(cacheKey, result);
      }
    }

    return this.prisma.mechanicPartAiSuggestion.upsert({
      where: { partId: part.id },
      create: {
        partId: part.id,
        vin: opts.vin,
        photoId: opts.photoId,
        suggestedName: result.suggestedName,
        suggestedPartNumber: result.suggestedPartNumber,
        confidence: result.confidence,
        rawResponse: result.rawResponse,
        errorMessage: result.errorMessage
      },
      update: {
        vin: opts.vin,
        photoId: opts.photoId,
        suggestedName: result.suggestedName,
        suggestedPartNumber: result.suggestedPartNumber,
        confidence: result.confidence,
        rawResponse: result.rawResponse,
        errorMessage: result.errorMessage,
        appliedByEmployee: false
      }
    });
  }

  async applySuggestion(opts: {
    partId: string;
    companyId: string;
  }): Promise<MechanicOrderPart> {
    const part = await this.prisma.mechanicOrderPart.findFirst({
      where: { id: opts.partId, companyId: opts.companyId }
    });
    if (!part) {
      throw new NotFoundException("Part not found for this company.");
    }

    const suggestion = await this.prisma.mechanicPartAiSuggestion.findUnique({
      where: { partId: part.id }
    });
    if (!suggestion || suggestion.errorMessage) {
      throw new UnprocessableEntityException("No valid AI suggestion to apply");
    }
    if (!suggestion.suggestedName.trim()) {
      throw new UnprocessableEntityException("AI suggestion is empty");
    }

    const updatedPart = await this.prisma.mechanicOrderPart.update({
      where: { id: part.id },
      data: { name: suggestion.suggestedName }
    });

    await this.prisma.mechanicPartAiSuggestion.update({
      where: { partId: part.id },
      data: { appliedByEmployee: true }
    });

    return updatedPart;
  }

  private async callOpenAI(input: {
    photo: { filePath: string; mimeType: string };
    vin: string;
  }): Promise<AiSuggestionResult> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return this.emptyResult(
        "OpenAI disabled (OPENAI_API_KEY missing at runtime). Enter the name manually."
      );
    }

    const model = process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o";

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

    const systemPrompt = `You are an automotive parts identification assistant.
The user will provide a vehicle VIN and a photo of a damaged or worn part.
Respond ONLY with a valid JSON object, no markdown, no commentary.
JSON schema:
{
  "suggestedName": "string (common part name in English)",
  "suggestedPartNumber": "string or null (OEM or aftermarket part number if identifiable)",
  "confidence": "HIGH | MEDIUM | LOW"
}
If you cannot identify the part, return confidence LOW with your best guess for suggestedName.`;

    const userPrompt = `VIN: ${input.vin}
Identify the automotive part shown in this image.`;

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
          max_tokens: 200,
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
        return this.emptyResult(`OpenAI API error: ${response.status} ${errorBody.slice(0, 200)}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const raw = data.choices?.[0]?.message?.content ?? "";
      const cleaned = raw.replace(/```json|```/g, "").trim();

      let parsed: { suggestedName?: string; suggestedPartNumber?: string | null; confidence?: string };
      try {
        parsed = JSON.parse(cleaned) as typeof parsed;
      } catch {
        return {
          suggestedName: "",
          suggestedPartNumber: null,
          confidence: "LOW",
          rawResponse: raw,
          errorMessage: "OpenAI returned unparsable JSON"
        };
      }

      const confidence: AiConfidence = ALLOWED_CONFIDENCE.includes(
        parsed.confidence as AiConfidence
      )
        ? (parsed.confidence as AiConfidence)
        : "LOW";

      return {
        suggestedName: parsed.suggestedName?.trim() || "Unknown part",
        suggestedPartNumber: parsed.suggestedPartNumber?.trim() || null,
        confidence,
        rawResponse: raw,
        errorMessage: null
      };
    } catch (err) {
      clearTimeout(timeoutHandle);
      return this.emptyResult(err instanceof Error ? err.message : "OpenAI request failed");
    }
  }

  private emptyResult(errorMessage: string): AiSuggestionResult {
    return {
      suggestedName: "",
      suggestedPartNumber: null,
      confidence: "LOW",
      rawResponse: null,
      errorMessage
    };
  }

  private getCached(key: string): AiSuggestionResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.result;
  }

  private setCache(key: string, result: AiSuggestionResult): void {
    this.cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
  }
}
