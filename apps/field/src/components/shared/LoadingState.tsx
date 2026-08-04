type LoadingStateProps = {
  readonly message?: string;
};

export function LoadingState({ message = "Cargando..." }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
      <p className="mt-4 text-sm text-slate-500">{message}</p>
    </div>
  );
}
