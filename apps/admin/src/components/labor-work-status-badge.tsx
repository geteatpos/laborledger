type LaborWorkStatusBadgeProps = {
  readonly status: string;
};

export function LaborWorkStatusBadge({ status }: LaborWorkStatusBadgeProps) {
  const label = status.replaceAll("_", " ");

  if (status === "COMPLETED") {
    return (
      <span className="inline-flex items-center rounded-md border border-emerald-200/80 bg-emerald-50/80 px-2 py-0.5 text-xs font-medium text-emerald-800">
        {label}
      </span>
    );
  }

  if (status === "BLOCKED") {
    return (
      <span className="inline-flex items-center rounded-md border border-red-200/80 bg-red-50/80 px-2 py-0.5 text-xs font-medium text-red-800">
        {label}
      </span>
    );
  }

  if (status === "IN_PROGRESS") {
    return (
      <span className="inline-flex items-center rounded-md border border-brand-200/80 bg-brand-50/80 px-2 py-0.5 text-xs font-medium text-brand-800">
        {label}
      </span>
    );
  }

  if (status === "CANCELLED") {
    return (
      <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
        {label}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
      {label}
    </span>
  );
}
