type DashboardMetricCardProps = {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
  readonly tone?: "default" | "accent" | "warning";
};

const TONE_CLASSES = {
  default: "stitch-card",
  accent: "stitch-card border-primary/30",
  warning: "stitch-card border-warning/30"
} as const;

const VALUE_TONE_CLASSES = {
  default: "text-on-surface",
  accent: "text-primary",
  warning: "text-warning"
} as const;

export function DashboardMetricCard({
  label,
  value,
  hint,
  tone = "default"
}: DashboardMetricCardProps) {
  return (
    <article className={`rounded-xl p-5 ${TONE_CLASSES[tone]}`}>
      <p className="stitch-label">{label}</p>
      <p className={`mt-3 font-display text-3xl font-semibold tracking-tight ${VALUE_TONE_CLASSES[tone]}`}>
        {value}
      </p>
      {hint ? <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">{hint}</p> : null}
    </article>
  );
}
