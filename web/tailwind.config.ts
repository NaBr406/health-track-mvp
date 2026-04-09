import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        border: "#1e293b",
        input: "#0f172a",
        ring: "#38bdf8",
        background: "#020617",
        foreground: "#e2e8f0",
        primary: {
          DEFAULT: "#22c55e",
          foreground: "#052e16"
        },
        secondary: {
          DEFAULT: "#1e293b",
          foreground: "#e2e8f0"
        },
        muted: {
          DEFAULT: "#0f172a",
          foreground: "#94a3b8"
        },
        card: {
          DEFAULT: "#0f172a",
          foreground: "#e2e8f0"
        }
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(148, 163, 184, 0.08), 0 20px 45px rgba(15, 23, 42, 0.35)"
      }
    }
  },
  plugins: []
};

export default config;

