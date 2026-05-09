import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      screens: {
        xs: "420px",
      },
      colors: {
        // Surfaces
        canvas: {
          DEFAULT: "#F0F4F7", // page background, light mode
          dark: "#0B1220",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          dark: "#111827",
        },
        muted: {
          DEFAULT: "#E2E8F0",
          dark: "#1E293B",
        },
        // Borders (used at 0.5px equivalent via `border` + opacity)
        border: {
          subtle: "rgba(15, 23, 42, 0.10)",
          subtleDark: "rgba(255, 255, 255, 0.08)",
        },
        // Text
        ink: {
          primary: "#0F172A",
          secondary: "#475569",
          tertiary: "#64748B",
          // Dark mode
          primaryDark: "#F1F5F9",
          secondaryDark: "#94A3B8",
          tertiaryDark: "#64748B",
        },
        // Accent — reserved for primary CTAs (Download button).
        accent: {
          DEFAULT: "#2563EB",
          dark: "#3B82F6",
          fg: "#FFFFFF",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-fraunces)", "ui-serif", "Georgia", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        // Slight overrides for tighter editorial feel
        "display": ["2.5rem", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "500" }],
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        md: "0.625rem",
        lg: "0.875rem",
        xl: "1rem",
      },
      boxShadow: {
        ring: "0 0 0 4px rgba(0,0,0,0.04)",
        ringDark: "0 0 0 4px rgba(255,255,255,0.04)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
