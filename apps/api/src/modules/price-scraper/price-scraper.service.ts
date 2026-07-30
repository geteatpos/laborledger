import { Injectable, Logger } from "@nestjs/common";
import { load } from "cheerio";
import { gunzipSync, inflateSync, brotliDecompressSync } from "node:zlib";

export type ScraperResult = {
  price: number | null;
  raw: string | null;
};

type StoreKey = "Amazon" | "RockAuto" | "AutoZone" | "NAPA" | "OReilly" | "Advance" | "EbayMotors";

type CacheEntry = {
  result: ScraperResult;
  expiresAt: number;
};

const CACHE_TTL_MS = 30 * 60 * 1000;
const PER_STORE_MIN_INTERVAL_MS = 1200;
const PER_REQUEST_TIMEOUT_MS = 10_000;

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const COMMON_HEADERS: Record<string, string> = {
  "User-Agent": USER_AGENT,
  "Accept-Language": "en-US,en;q=0.9",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Encoding": "identity"
};

@Injectable()
export class PriceScraperService {
  private readonly logger = new Logger(PriceScraperService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly lastRequestAt = new Map<StoreKey, number>();

  async scrapePrice(store: StoreKey, query: string): Promise<ScraperResult> {
    const normalized = query.trim();
    if (!normalized) return { price: null, raw: null };

    const cacheKey = `${store}::${normalized.toLowerCase()}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    await this.throttle(store);

    let result: ScraperResult;
    try {
      result = await this.dispatch(store, normalized);
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown";
      this.logger.warn(`[${store}] scrape failed: ${message.slice(0, 120)}`);
      result = { price: null, raw: null };
    }

    this.setCache(cacheKey, result);
    return result;
  }

  async scrapeAll(query: string): Promise<Record<StoreKey, ScraperResult>> {
    const stores: StoreKey[] = [
      "Amazon",
      "RockAuto",
      "AutoZone",
      "NAPA",
      "OReilly",
      "Advance",
      "EbayMotors"
    ];

    const settled = await Promise.allSettled(
      stores.map((store) => this.scrapePrice(store, query))
    );

    const out = {} as Record<StoreKey, ScraperResult>;
    stores.forEach((store, idx) => {
      const r = settled[idx];
      out[store] = r.status === "fulfilled" ? r.value : { price: null, raw: null };
    });
    return out;
  }

  private async dispatch(store: StoreKey, query: string): Promise<ScraperResult> {
    switch (store) {
      case "Amazon":
        return this.scrapeAmazon(query);
      default:
        return { price: null, raw: null };
    }
  }

  private async fetchHtml(url: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PER_REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: COMMON_HEADERS
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      const encoding = (res.headers.get("content-encoding") ?? "").toLowerCase();
      if (encoding.includes("br")) {
        return brotliDecompressSync(buffer).toString("utf-8");
      }
      if (encoding.includes("gzip")) {
        return gunzipSync(buffer).toString("utf-8");
      }
      if (encoding.includes("deflate")) {
        return inflateSync(buffer).toString("utf-8");
      }
      return buffer.toString("utf-8");
    } finally {
      clearTimeout(timer);
    }
  }

  private parsePriceLoose(text: string | null | undefined): number | null {
    if (!text) return null;
    const cleaned = text.replace(/[^\d.,]/g, "").trim();
    if (!cleaned) return null;
    const normalized = cleaned.includes(",") && cleaned.includes(".")
      ? cleaned.replace(/,/g, "")
      : cleaned.replace(/,/g, "");
    const num = Number(normalized);
    if (!Number.isFinite(num) || num <= 0) return null;
    if (num > 1_000_000) return null;
    return Math.round(num * 100) / 100;
  }

  private async scrapeAmazon(query: string): Promise<ScraperResult> {
    const url = `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
    const html = await this.fetchHtml(url);
    const $ = load(html);

    const candidates: number[] = [];
    $("span.a-offscreen").each((_, el) => {
      const txt = $(el).text();
      const p = this.parsePriceLoose(txt);
      if (p != null) candidates.push(p);
    });

    if (candidates.length === 0) {
      return { price: null, raw: null };
    }

    candidates.sort((a, b) => a - b);
    const lowest = candidates[0];
    return { price: lowest, raw: `$${lowest.toFixed(2)}` };
  }

  private async throttle(store: StoreKey): Promise<void> {
    const last = this.lastRequestAt.get(store) ?? 0;
    const elapsed = Date.now() - last;
    if (elapsed < PER_STORE_MIN_INTERVAL_MS) {
      await new Promise((r) =>
        setTimeout(r, PER_STORE_MIN_INTERVAL_MS - elapsed)
      );
    }
    this.lastRequestAt.set(store, Date.now());
  }

  private getCached(key: string): ScraperResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.result;
  }

  private setCache(key: string, result: ScraperResult): void {
    this.cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    if (this.cache.size > 500) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
  }
}
