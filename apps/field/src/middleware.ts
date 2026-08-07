import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
    name: "field-login",
    methods: ["POST"],
    paths: ["/api/field/login"],
    windowMs: 5 * 60 * 1000,
    max: 10
  },
  {
    name: "field-actions",
    methods: ["POST", "PATCH"],
    paths: [
      "/api/field/break/",
      "/api/field/clock/",
      "/api/field/jobs/",
      "/api/field/labor-work/",
      "/api/kiosk/",
      "/api/worker/"
    ],
    windowMs: 60 * 1000,
    max: 120
  }
];

function clientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const forwardedIp = forwardedFor?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return forwardedIp || realIp || "unknown";
}

function findRateLimitRule(request: NextRequest): RateLimitRule | null {
  const method = request.method.toUpperCase();
  const path = request.nextUrl.pathname;

  return (
    RATE_LIMIT_RULES.find(
      (rule) =>
        rule.methods.includes(method) &&
        rule.paths.some((rulePath) => path === rulePath || path.startsWith(rulePath))
    ) ?? null
  );
}

function applySecurityHeaders(response: NextResponse) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Permissions-Policy", "microphone=(), geolocation=()");
}

function enforceRateLimit(request: NextRequest): NextResponse | null {
  const rule = findRateLimitRule(request);
  if (!rule) {
    return null;
  }

  const now = Date.now();
  const key = `${rule.name}:${clientIp(request)}`;
  const current = rateLimitBuckets.get(key);
  const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + rule.windowMs };

  bucket.count += 1;
  rateLimitBuckets.set(key, bucket);

  if (bucket.count <= rule.max) {
    return null;
  }

  const response = NextResponse.json(
    { message: "Too many requests. Please wait and try again." },
    { status: 429 }
  );
  response.headers.set("RateLimit-Limit", String(rule.max));
  response.headers.set("RateLimit-Remaining", "0");
  response.headers.set("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));
  return response;
}

export function middleware(request: NextRequest) {
  const limitedResponse = enforceRateLimit(request);
  const response = limitedResponse ?? NextResponse.next();
  applySecurityHeaders(response);
  return response;
}

export const config = {
  matcher: ["/api/:path*", "/field/:path*"]
};
