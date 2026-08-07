type EmptyStateProps = {
  readonly title: string;
  readonly description?: string;
  readonly action?: React.ReactNode;
  readonly icon?: React.ReactNode;
};

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="ll-empty-state">
      {icon && <div className="ll-empty-state-icon">{icon}</div>}
      <p className="ll-empty-state-title">{title}</p>
      {description && <p className="ll-empty-state-description">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
