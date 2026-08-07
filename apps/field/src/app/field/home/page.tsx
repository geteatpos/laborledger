import { redirect } from "next/navigation";

import { FieldShell } from "@/components/shared/FieldShell";
import { EmployeeHelpCard } from "@/components/employee/EmployeeHelpCard";
import { FieldHomePanel } from "@/components/employee/FieldHomePanel";
import { readFieldSession } from "@/lib/field-session";

export default async function FieldHomePage() {
  const session = await readFieldSession();
  if (!session) {
    redirect("/field/login");
  }

  return (
    <FieldShell
      title="Inicio"
      subtitle="Reloj, recibir vehículos o revisar trabajo."
      showHomeLink={false}
    >
      <FieldHomePanel />
      <EmployeeHelpCard />
    </FieldShell>
  );
}
