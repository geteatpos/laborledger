import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        page: "#F8FAFC",
        surface: "#FFFFFF",
        "primary-text": "#0F172A",
        "secondary-text": "#64748B",
        border: "#E2E8F0",
        "primary-action": "#2563EB",
        "primary-hover": "#1D4ED8",
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
        },
        primary: "#2563EB",
        "primary-10": "rgb(37 99 235 / 0.1)",
        "primary-20": "rgb(37 99 235 / 0.2)",
        "primary-30": "rgb(37 99 235 / 0.3)",
        secondary: "#64748B",
        "on-surface": "#0F172A",
        "on-surface-variant": "#64748B",
        "surface-variant": "#F1F5F9",
        "surface-variant-30": "rgb(241 245 249 / 0.3)",
        "surface-container-low": "#F8FAFC",
        "surface-container-low-40": "rgb(248 250 252 / 0.4)",
        "surface-container": "#FFFFFF",
        "primary-container": "#EFF6FF",
        "primary-container-10": "rgb(239 246 255 / 0.1)",
        "primary-container-20": "rgb(239 246 255 / 0.2)",
        "secondary-container": "#FEF3C7",
        "secondary-container-10": "rgb(254 243 199 / 0.1)",
        "secondary-container-20": "rgb(254 243 199 / 0.2)",
        "outline-variant": "#E2E8F0",
        "outline-variant-20": "rgb(226 232 240 / 0.2)",
        "outline-variant-30": "rgb(226 232 240 / 0.3)"
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
        gutter: "24px",
        "margin-mobile": "16px",
        "margin-desktop": "32px"
      },
      borderRadius: {
        stitch: "0.75rem"
      },
      boxShadow: {
        subtle: "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
      }
    }
  },
  plugins: []
};

export default config;
