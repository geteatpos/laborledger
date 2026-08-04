type ErrorStateProps = {
  readonly message: string;
  readonly onRetry?: () => void;
};

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="ll-alert-error flex items-center justify-between gap-4" role="alert">
      <span className="flex items-center gap-2">
        <svg className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
            clipRule="evenodd"
          />
        </svg>
        {message}
      </span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 text-xs font-semibold underline hover:no-underline"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
