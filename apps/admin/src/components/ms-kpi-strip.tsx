type MsKpi = {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
  readonly tone?: "default" | "accent" | "warning" | "danger";
};

const TONE: Record<NonNullable<MsKpi["tone"]>, string> = {
  default: "stitch-card",
  accent: "stitch-card border-secondary/35",
  warning: "stitch-card border-warning/35",
  danger: "stitch-card border-error/35 bg-error-container/30"
};

const VALUE_TONE: Record<NonNullable<MsKpi["tone"]>, string> = {
  default: "text-on-surface",
  accent: "text-secondary",
  warning: "text-warning",
  danger: "text-on-error-container"
};

type MsKpiStripProps = {
  readonly items: readonly MsKpi[];
};

export function MsKpiStrip({ items }: MsKpiStripProps) {
  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const tone = item.tone ?? "default";
        return (
          <article key={item.label} className={TONE[tone]}>
            <p className="stitch-label">{item.label}</p>
            <p className={`mt-2 font-display text-[28px] font-bold tracking-tight ${VALUE_TONE[tone]}`}>
              {item.value}
            </p>
            {item.hint ? (
              <p className="mt-1 text-xs text-on-surface-variant">{item.hint}</p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
