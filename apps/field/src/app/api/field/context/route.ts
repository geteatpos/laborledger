import { NextResponse } from "next/server";

import { resolveFieldBootstrap } from "@/lib/field-bootstrap";

export async function GET(request: Request) {
  const bootstrap = await resolveFieldBootstrap({ request });

  return NextResponse.json({
    ready: bootstrap.ready,
    pinLoginReady: bootstrap.pinLoginReady,
    clockAvailable: bootstrap.clockAvailable,
    source: bootstrap.source,
    company: bootstrap.company,
    location: bootstrap.location,
    message: bootstrap.message
  });
}

export async function HEAD(request: Request) {
  const bootstrap = await resolveFieldBootstrap({ request });
  return new NextResponse(null, {
    status: bootstrap.pinLoginReady ? 200 : 503
  });
}
