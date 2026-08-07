type StatusCardProps = {
  readonly title: string;
  readonly description: string;
  readonly tone?: "neutral" | "success" | "warning" | "danger";
};

const TONE_CLASSES: Record<NonNullable<StatusCardProps["tone"]>, { border: string; bg: string; text: string }> = {
  success: { border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-900" },
  warning: { border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-900" },
  danger: { border: "border-red-200", bg: "bg-red-50", text: "text-red-900" },
  neutral: { border: "border-slate-200", bg: "bg-white", text: "text-slate-900" },
};

export function StatusCard({ title, description, tone = "neutral" }: StatusCardProps) {
  const classes = TONE_CLASSES[tone];
  return (
    <div className={`ll-card border ${classes.border} ${classes.bg}`}>
      <p className={`font-semibold ${classes.text}`}>{title}</p>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
    </div>
  );
}
