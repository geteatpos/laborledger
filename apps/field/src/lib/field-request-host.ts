/** Extract the public hostname from an incoming Field request. */

export function readFieldRequestHostname(request?: Request, fallbackHost?: string | null): string {
  if (request) {
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const host = request.headers.get("host")?.trim();
    if (forwardedHost) {
      return forwardedHost;
    }
    if (host) {
      return host;
    }
  }

  return fallbackHost?.trim() ?? "";
}
