import { redirect } from "next/navigation";

import { FieldShell } from "@/components/shared/FieldShell";
import { ReceiveVehiclePanel } from "@/components/employee/ReceiveVehiclePanel";
import { EmployeeHelpCard } from "@/components/employee/EmployeeHelpCard";
import { readFieldSession } from "@/lib/field-session";

export default async function FieldJobsNewPage() {
  const session = await readFieldSession();
  if (!session) {
    redirect("/field/login");
  }

  return (
    <FieldShell
      title="Receive Vehicle"
      subtitle="Scan a VIN or enter it manually, then confirm the job details."
    >
      <div className="space-y-4">
        <ReceiveVehiclePanel />
        <EmployeeHelpCard />
      </div>
    </FieldShell>
  );
}
