type MaterialIconProps = {
  readonly name: string;
  readonly className?: string;
  readonly filled?: boolean;
};

export function MaterialIcon({ name, className = "", filled = false }: MaterialIconProps) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`
      }}
      aria-hidden
    >
      {name}
    </span>
  );
}
