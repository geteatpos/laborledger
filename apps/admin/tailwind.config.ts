import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Page/background
        page: "#F8FAFC",
        background: "#f8f9fa",
        "on-background": "#191c1d",

        // Surface tokens (Material Design 3)
        surface: "#f8f9fa",
        "surface-dim": "#d9dadb",
        "surface-bright": "#f8f9fa",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f3f4f5",
        "surface-container": "#edeeef",
        "surface-container-high": "#e7e8e9",
        "surface-container-highest": "#e1e3e4",

        // On surface
        "on-surface": "#191c1d",
        "on-surface-variant": "#434655",

        // Primary (updated from Stitch)
        "primary-action": "#004ac6",
        "primary-hover": "#003d9f",
        primary: "#004ac6",
        "on-primary": "#ffffff",
        "primary-container": "#2563eb",
        "on-primary-container": "#eeefff",
        "primary-10": "rgb(0 74 198 / 0.1)",
        "primary-20": "rgb(0 74 198 / 0.2)",
        "primary-30": "rgb(0 74 198 / 0.3)",

        // Secondary
        secondary: "#575e70",
        "secondary-container": "#d9dff5",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#5c6274",

        // Tertiary
        tertiary: "#4c5664",
        "tertiary-container": "#646e7d",
        "on-tertiary": "#ffffff",
        "on-tertiary-container": "#e9f1ff",

        // Error
        error: "#ba1a1a",
        "error-container": "#ffdad6",
        "on-error": "#ffffff",
        "on-error-container": "#93000a",

        // Text colors
        "primary-text": "#191c1d",
        "secondary-text": "#434655",

        // Borders & outlines
        border: "#e2e8f0",
        outline: "#737686",
        "outline-variant": "#c3c6d7",
        "outline-variant-20": "rgb(195 198 215 / 0.2)",
        "outline-variant-30": "rgb(195 198 215 / 0.3)",

        // Inverse
        "inverse-surface": "#2e3132",
        "inverse-on-surface": "#f0f1f2",
        "inverse-primary": "#b4c5ff",

        // Surface variant (legacy support)
        "surface-variant": "#f1f5f9",
        "surface-variant-30": "rgb(241 245 249 / 0.3)",

        // Container colors (legacy support)
        "primary-container-10": "rgb(37 99 235 / 0.1)",
        "primary-container-20": "rgb(37 99 235 / 0.2)",
        "secondary-container-10": "rgb(217 223 245 / 0.1)",
        "secondary-container-20": "rgb(217 223 245 / 0.2)",

        // Semantic colors (preserved)
        success: "#16A34A",
        warning: "#D97706",
        danger: "#DC2626",
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          500: "#2563eb",
          600: "#1d4ed8",
          700: "#1e40af",
          800: "#1e3a8a"
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-hanken)", "var(--font-inter)", "system-ui", "sans-serif"],
        label: ["var(--font-geist)", "var(--font-inter)", "system-ui", "sans-serif"]
      },
      fontSize: {
        "display-lg": ["48px", { lineHeight: "56px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-lg": ["32px", { lineHeight: "40px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "headline-md": ["24px", { lineHeight: "32px", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "28px", fontWeight: "400" }],
        "body-md": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "body-sm": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "label-md": ["14px", { lineHeight: "16px", letterSpacing: "0.05em", fontWeight: "500" }],
        "label-sm": ["12px", { lineHeight: "14px", letterSpacing: "0.05em", fontWeight: "500" }]
      },
      spacing: {
        gutter: "20px",
        "margin-mobile": "16px",
        "margin-desktop": "48px"
      },
      borderRadius: {
        stitch: "0.75rem",
        "radius-sm": "0.25rem",
        "radius-md": "0.5rem",
        "radius-lg": "0.75rem",
        "radius-xl": "1rem",
        "radius-full": "9999px"
      },
      boxShadow: {
        subtle: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        "level-2": "0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)",
        "level-3": "0 20px 25px -5px rgba(0,0,0,0.1)"
      }
    }
  },
  plugins: []
};

export default config;
