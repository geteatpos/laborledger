import { redirect } from "next/navigation";

import { FieldShell } from "@/components/shared/FieldShell";
import { EmployeeHelpCard } from "@/components/employee/EmployeeHelpCard";
import { MyShiftsPanel } from "@/components/employee/MyShiftsPanel";
import { readFieldSession } from "@/lib/field-session";

export default async function FieldShiftsPage() {
  const session = await readFieldSession();
  if (!session) {
    redirect("/field/login");
  }

  return (
    <FieldShell
      title="My Shifts"
      subtitle="View your scheduled shifts and clock history."
    >
      <div className="space-y-4">
        <MyShiftsPanel />
        <EmployeeHelpCard />
      </div>
    </FieldShell>
  );
}
