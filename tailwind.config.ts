import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      // Exact color tokens from DESIGN.md "Tonal Atmosphere"
      colors: {
        background: "#060e20",
        "on-background": "#dee5ff",

        // Surface hierarchy — layered frosted-glass sheets
        surface: "#060e20",
        "surface-dim": "#060e20",
        "surface-bright": "#172b54",
        "surface-container-lowest": "#000000",
        "surface-container-low": "#081329",
        "surface-container": "#0c1934",
        "surface-container-high": "#101e3e",
        "surface-container-highest": "#142449",
        "surface-variant": "#142449",
        "surface-tint": "#9093ff",
        "on-surface": "#dee5ff",
        "on-surface-variant": "#9baad6",
        "inverse-surface": "#faf8ff",
        "inverse-on-surface": "#4d556b",

        // Primary — the "Intelligent Blue"
        primary: "#9093ff",
        "primary-dim": "#6063ee",
        "primary-fixed": "#babbff",
        "primary-fixed-dim": "#aaacff",
        "primary-container": "#7073ff",
        "on-primary": "#080079",
        "on-primary-container": "#000000",
        "on-primary-fixed": "#0c0090",
        "on-primary-fixed-variant": "#2d2cbd",
        "inverse-primary": "#494bd7",

        // Secondary — "Soft Purple"
        secondary: "#ddb7ff",
        "secondary-dim": "#9c48ea",
        "secondary-fixed": "#f0dbff",
        "secondary-fixed-dim": "#e7c9ff",
        "secondary-container": "#3a0068",
        "on-secondary": "#5f00a4",
        "on-secondary-container": "#c589ff",
        "on-secondary-fixed": "#5e00a2",
        "on-secondary-fixed-variant": "#8126cf",

        // Tertiary — cyan "highlighter" per DESIGN.md §6
        tertiary: "#7bd0ff",
        "tertiary-dim": "#05a9e3",
        "tertiary-fixed": "#47c4ff",
        "tertiary-fixed-dim": "#2db7f2",
        "tertiary-container": "#47c4ff",
        "on-tertiary": "#004560",
        "on-tertiary-container": "#003b52",
        "on-tertiary-fixed": "#002433",
        "on-tertiary-fixed-variant": "#00455f",

        // Error — warm coral so it doesn't clash with the blue palette
        error: "#fd6f85",
        "error-dim": "#c8475d",
        "error-container": "#8a1632",
        "on-error": "#490013",
        "on-error-container": "#ff97a3",

        // Outlines (used only as "ghost borders" at ≤15% opacity)
        outline: "#65759e",
        "outline-variant": "#38476d",
      },

      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "1.5rem", // DESIGN.md buttons: "xl roundedness (1.5rem)"
        full: "9999px",
      },

      fontFamily: {
        headline: ["Manrope", "sans-serif"], // display + headlines
        body: ["Inter", "sans-serif"], // body + functional
        label: ["Inter", "sans-serif"],
        sans: ["Inter", "sans-serif"],
      },

      fontSize: {
        // Editorial scale — dramatic jump between display and body
        "display-lg": ["3.5rem", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "800" }],
        "display-md": ["2.75rem", { lineHeight: "1.15", letterSpacing: "-0.02em", fontWeight: "800" }],
        "display-sm": ["2.25rem", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "800" }],
        "headline-lg": ["2rem", { lineHeight: "1.25", fontWeight: "700" }],
        "headline-md": ["1.5rem", { lineHeight: "1.3", fontWeight: "700" }],
        "headline-sm": ["1.25rem", { lineHeight: "1.35", fontWeight: "700" }],
        "title-lg": ["1.125rem", { lineHeight: "1.4", fontWeight: "600" }],
        "title-md": ["1rem", { lineHeight: "1.45", fontWeight: "600" }],
        "title-sm": ["0.875rem", { lineHeight: "1.5", fontWeight: "600" }],
        "body-lg": ["1rem", { lineHeight: "1.6", fontWeight: "400" }],
        "body-md": ["0.9375rem", { lineHeight: "1.6", fontWeight: "400" }],
        "body-sm": ["0.8125rem", { lineHeight: "1.5", fontWeight: "400" }],
        "label-lg": ["0.875rem", { lineHeight: "1.4", fontWeight: "500" }],
        "label-md": ["0.75rem", { lineHeight: "1.4", fontWeight: "500" }],
        "label-sm": ["0.6875rem", { lineHeight: "1.3", fontWeight: "500" }],
      },

      backgroundImage: {
        // DESIGN.md §2: "Main CTAs should use a linear gradient: primary to primary-dim at 135deg"
        "cta-gradient": "linear-gradient(135deg, #9093ff 0%, #6063ee 100%)",
      },

      boxShadow: {
        // Ambient shadow per DESIGN.md §4
        ambient: "0 0 40px 0 rgba(222, 229, 255, 0.06)",
        // Primary glow for focused inputs (20% opacity per §5)
        glow: "0 0 0 4px rgba(144, 147, 255, 0.2)",
      },

      backdropBlur: {
        glass: "20px",
      },
    },
  },
  plugins: [],
};

export default config;
