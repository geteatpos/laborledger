import { StatusCard } from "@/components/shared/StatusCard";

type WorkerStatusCardProps = {
  readonly configured: boolean;
};

export function WorkerStatusCard({ configured }: WorkerStatusCardProps) {
  if (configured) {
    return (
      <StatusCard
        title="Sign-in ready"
        description="Your workplace is configured on this device. Sign in with your 6-digit PIN."
        tone="success"
      />
    );
  }

  return (
    <StatusCard
      title="Sign-in not configured"
      description="This location is not ready yet. Ask a manager to finish Field setup in Admin (hostname + location)."
      tone="warning"
    />
  );
}
