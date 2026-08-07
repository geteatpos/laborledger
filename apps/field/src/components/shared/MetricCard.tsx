type MetricCardProps = {
  readonly label: string;
  readonly value: string | number;
  readonly change?: string;
  readonly changeType?: "positive" | "negative" | "neutral";
  readonly icon?: React.ReactNode;
};

export function MetricCard({ label, value, change, changeType = "neutral", icon }: MetricCardProps) {
  return (
    <div className="ll-metric-card">
      <div className="flex items-start justify-between">
        <p className="ll-metric-label">{label}</p>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>
      <p className="ll-metric-value">{value}</p>
      {change && (
        <p
          className={
            changeType === "positive"
              ? "ll-metric-change-positive"
              : changeType === "negative"
                ? "ll-metric-change-negative"
                : "ll-metric-change text-slate-500"
          }
        >
          {change}
        </p>
      )}
    </div>
  );
}
