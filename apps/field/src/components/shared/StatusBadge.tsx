type StatusBadgeProps = {
  readonly label: string;
  readonly tone?: "success" | "warning" | "danger" | "info" | "neutral";
};

const TONE_CLASSES: Record<NonNullable<StatusBadgeProps["tone"]>, string> = {
  success: "ll-badge-success",
  warning: "ll-badge-warning",
  danger: "ll-badge-danger",
  info: "ll-badge-info",
  neutral: "ll-badge-neutral",
};

export function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
  return (
    <span className={`ll-badge ${TONE_CLASSES[tone]}`}>
      {label}
    </span>
  );
}
