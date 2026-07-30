import type { ReactNode } from "react";

type EmptyStateProps = {
  readonly title: string;
  readonly description: string;
  readonly action?: ReactNode;
  readonly icon?: ReactNode;
};

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-stitch border border-dashed border-outline-variant-30 bg-surface-container-low-40 px-6 py-14 text-center">
      {icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-on-surface-variant shadow-luminous ring-1 ring-outline-variant-20">
          {icon}
        </div>
      ) : null}
      <h3 className="font-display text-base font-semibold text-on-surface">{title}</h3>
      <p className="mt-2 max-w-md text-body-sm leading-relaxed text-on-surface-variant">{description}</p>
      {action ? <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}
