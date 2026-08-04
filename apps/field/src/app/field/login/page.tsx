import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { FieldShell } from "@/components/shared/FieldShell";
import { FieldLoginPanel } from "@/components/employee/FieldLoginPanel";
import { resolveFieldBootstrap } from "@/lib/field-bootstrap";
import { readFieldSession } from "@/lib/field-session";

export default async function FieldLoginPage() {
  const existingSession = await readFieldSession();
  if (existingSession) {
    redirect("/field/home");
  }

  const host = (await headers()).get("x-forwarded-host") ?? (await headers()).get("host");
  const bootstrap = await resolveFieldBootstrap({ hostname: host });

  return (
    <FieldShell title="LaborLedger Field" showHomeLink={false}>
      <FieldLoginPanel
        pinLoginReady={bootstrap.pinLoginReady}
        companyName={bootstrap.company?.name ?? null}
        locationName={bootstrap.location?.name ?? null}
      />
    </FieldShell>
  );
}
