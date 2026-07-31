type EmployeesKpiStripProps = {
  readonly totalEmployees: number;
  readonly activeEmployees: number;
  readonly supervisors: number;
  readonly inactiveEmployees: number;
};

const KPI_ITEMS = [
  { key: "totalEmployees", label: "Total employees" },
  { key: "activeEmployees", label: "Active employees" },
  { key: "supervisors", label: "Supervisors" },
  { key: "inactiveEmployees", label: "Inactive employees" }
] as const;

export function EmployeesKpiStrip({
  totalEmployees,
  activeEmployees,
  supervisors,
  inactiveEmployees
}: EmployeesKpiStripProps) {
  const values = {
    totalEmployees,
    activeEmployees,
    supervisors,
    inactiveEmployees
  };

  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {KPI_ITEMS.map((item) => (
        <article
          key={item.key}
          className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/30"
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">{item.label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{values[item.key]}</p>
        </article>
      ))}
    </div>
  );
}
