type SkeletonCardProps = {
  readonly lines?: number;
};

export function SkeletonCard({ lines = 3 }: SkeletonCardProps) {
  return (
    <div className="ll-card">
      <div className="space-y-3">
        <div className="ll-skeleton h-4 w-3/4" />
        {lines > 1 && <div className="ll-skeleton h-4 w-1/2" />}
        {lines > 2 && <div className="ll-skeleton h-4 w-5/6" />}
      </div>
    </div>
  );
}
