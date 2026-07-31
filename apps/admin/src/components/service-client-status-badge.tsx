type ServiceClientStatusBadgeProps = {
  readonly archivedAt: string | null;
};

export function ServiceClientStatusBadge({ archivedAt }: ServiceClientStatusBadgeProps) {
  if (archivedAt) {
    return <span className="stitch-badge stitch-badge-neutral">Inactive</span>;
  }

  return <span className="stitch-badge stitch-badge-success">Active</span>;
}
