import { NextResponse } from "next/server";

import { resolveFieldBootstrap } from "@/lib/field-bootstrap";

export async function GET(request: Request) {
  const bootstrap = await resolveFieldBootstrap({ request });

  return NextResponse.json({
    ready: bootstrap.ready,
    pinLoginReady: bootstrap.pinLoginReady,
    clockAvailable: bootstrap.clockAvailable,
    resolutionSource: bootstrap.source,
    company: bootstrap.company,
    location: bootstrap.location,
    branding: {
      appTitle: "LaborLedger Field",
      subtitle: bootstrap.location?.name ?? null
    },
    features: {
      clockEnabled: bootstrap.clockAvailable,
      vehicleIntakeEnabled: bootstrap.ready,
      laborWorkEnabled: bootstrap.ready
    },
    clock: {
      available: bootstrap.clockAvailable
    },
    employeeLogin: {
      mode: "pin",
      pinLength: 6
    },
    message: bootstrap.message
  });
}
