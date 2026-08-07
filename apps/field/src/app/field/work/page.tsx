import { redirect } from "next/navigation";

import { FieldShell } from "@/components/shared/FieldShell";
import { EmployeeHelpCard } from "@/components/employee/EmployeeHelpCard";
import { EmployeeWorkExecutionPanel } from "@/components/employee/EmployeeWorkExecutionPanel";
import { readFieldSession } from "@/lib/field-session";

export default async function FieldWorkPage() {
  const session = await readFieldSession();
  if (!session) {
    redirect("/field/login");
  }

  return (
    <FieldShell
      title="My Work"
      subtitle="Start assigned work, track progress, and complete services when finished."
      showHomeLink
    >
      <div className="space-y-4">
        <EmployeeWorkExecutionPanel />
        <EmployeeHelpCard />
      </div>
    </FieldShell>
  );
}
