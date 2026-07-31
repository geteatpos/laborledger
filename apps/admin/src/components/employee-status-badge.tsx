type EmployeeStatusBadgeProps = {
  readonly archivedAt: string | null;
};

export function EmployeeStatusBadge({ archivedAt }: EmployeeStatusBadgeProps) {
  if (archivedAt) {
    return (
      <span className="stitch-badge-neutral">
        Inactivo
      </span>
    );
  }

  return (
    <span className="stitch-badge-success">
      Activo
    </span>
  );
}
