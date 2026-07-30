import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "laborledger.sid";
const PUBLIC_PATHS = ["/login", "/choose-company", "/forgot-password", "/reset-password", "/accept-invite"];

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
    name: "admin-login",
    methods: ["POST"],
    paths: ["/api/auth/login"],
    windowMs: 5 * 60 * 1000,
    max: 10
  },
  {
    name: "admin-password-reset",
    methods: ["POST"],
    paths: ["/api/auth/password-reset/request", "/api/auth/password-reset/confirm"],
    windowMs: 15 * 60 * 1000,
    max: 8
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

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Permissions-Policy", "microphone=(), geolocation=()");
  return response;
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
  const { pathname } = request.nextUrl;

  const limitedResponse = enforceRateLimit(request);
  if (limitedResponse) {
    return applySecurityHeaders(limitedResponse);
  }

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/") ||
    pathname === "/favicon.ico"
  ) {
    return applySecurityHeaders(NextResponse.next());
  }

  if (PUBLIC_PATHS.includes(pathname)) {
    return applySecurityHeaders(NextResponse.next());
  }

  if (!request.cookies.has(SESSION_COOKIE_NAME)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";

    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname);
    }

    return applySecurityHeaders(NextResponse.redirect(loginUrl));
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"]
};
