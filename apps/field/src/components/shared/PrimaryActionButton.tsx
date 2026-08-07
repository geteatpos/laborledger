"use client";

import type { ButtonHTMLAttributes } from "react";

type PrimaryActionButtonProps = {
  readonly label: string;
  readonly onClick?: () => void | Promise<void>;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly variant?: "primary" | "secondary" | "kiosk";
  readonly fullWidth?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick">;

export function PrimaryActionButton({
  label,
  onClick,
  disabled,
  loading,
  variant = "primary",
  fullWidth,
  className = "",
  ...props
}: PrimaryActionButtonProps) {
  const baseStyles = "ll-touch-target inline-flex items-center justify-center gap-2 font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
  
  const variantStyles = {
    primary: "ll-btn-primary",
    secondary: "ll-btn-secondary text-sm",
    kiosk: "ll-btn-primary text-base",
  };

  const widthStyle = fullWidth ? "w-full" : "";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseStyles} ${variantStyles[variant]} ${widthStyle} ${className}`}
      {...props}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {label}
    </button>
  );
}
