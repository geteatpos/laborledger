import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./modules/app.module";

type ApiRequest = {
  readonly method?: string;
  readonly path?: string;
  readonly url?: string;
  readonly ip?: string;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly socket?: { readonly remoteAddress?: string };
};

type ApiResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): { json(body: Record<string, unknown>): void };
};

type NextHandler = () => void;

type RateLimitRule = {
  readonly name: string;
  readonly methods: readonly string[];
  readonly paths: readonly string[];
  readonly windowMs: number;
  readonly max: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();
const RATE_LIMIT_RULES: readonly RateLimitRule[] = [
  {
    name: "auth-login",
    methods: ["POST"],
    paths: ["/auth/login"],
    windowMs: 5 * 60 * 1000,
    max: 10
  },
  {
    name: "password-reset",
    methods: ["POST"],
    paths: ["/auth/password-reset/request", "/auth/password-reset/confirm"],
    windowMs: 15 * 60 * 1000,
    max: 8
  },
  {
    name: "field-pin",
    methods: ["POST"],
    paths: ["/worker/lookup"],
    windowMs: 5 * 60 * 1000,
    max: 120
  },
  {
    name: "field-actions",
    methods: ["POST", "PATCH"],
    paths: ["/kiosk/", "/worker/", "/field/labor-work/"],
    windowMs: 60 * 1000,
    max: 120
  }
];

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function requestPath(request: ApiRequest): string {
  const rawPath = request.path ?? request.url ?? "/";
  return rawPath.split("?")[0] || "/";
}

function clientIp(request: ApiRequest): string {
  const forwardedFor = firstHeaderValue(request.headers["x-forwarded-for"]);
  const forwardedIp = forwardedFor?.split(",")[0]?.trim();
  return forwardedIp || request.ip || request.socket?.remoteAddress || "unknown";
}

function findRateLimitRule(request: ApiRequest): RateLimitRule | null {
  const method = (request.method ?? "GET").toUpperCase();
  const path = requestPath(request);

  return (
    RATE_LIMIT_RULES.find(
      (rule) =>
        rule.methods.includes(method) &&
        rule.paths.some((rulePath) => path === rulePath || path.startsWith(rulePath))
    ) ?? null
  );
}

function applySecurityHeaders(response: ApiResponse) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
}

function enforceRateLimit(request: ApiRequest, response: ApiResponse): boolean {
  const rule = findRateLimitRule(request);
  if (!rule) {
    return true;
  }

  const now = Date.now();
  const key = `${rule.name}:${clientIp(request)}`;
  const current = rateLimitBuckets.get(key);
  const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + rule.windowMs };

  bucket.count += 1;
  rateLimitBuckets.set(key, bucket);

  response.setHeader("RateLimit-Limit", String(rule.max));
  response.setHeader("RateLimit-Remaining", String(Math.max(rule.max - bucket.count, 0)));
  response.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

  if (bucket.count <= rule.max) {
    return true;
  }

  response.status(429).json({ message: "Too many requests. Please wait and try again." });
  return false;
}

function securityMiddleware(request: ApiRequest, response: ApiResponse, next: NextHandler) {
  applySecurityHeaders(response);

  if (!enforceRateLimit(request, response)) {
    return;
  }

  next();
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(securityMiddleware);
  await app.listen(process.env.PORT ?? 4000);
}

void bootstrap();
