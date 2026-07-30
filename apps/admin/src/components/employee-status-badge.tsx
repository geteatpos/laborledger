type EmployeeStatusBadgeProps = {
  readonly archivedAt: string | null;
};

export function EmployeeStatusBadge({ archivedAt }: EmployeeStatusBadgeProps) {
  if (archivedAt) {
    return (
      <span className="inline-flex items-center rounded-md border border-outline-variant bg-surface-variant px-2 py-0.5 text-xs font-medium text-on-surface-variant">
        Inactive
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-md border border-primary/30 bg-primary-container px-2 py-0.5 text-xs font-medium text-primary">
      Active
    </span>
  );
}
