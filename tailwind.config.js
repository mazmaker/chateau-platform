/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#f8fafc",
        foreground: "#0f172a",
        card: "#ffffff",
        "card-foreground": "#0f172a",
        popover: "#ffffff",
        "popover-foreground": "#0f172a",
        primary: "#4f46e5",
        "primary-foreground": "#ffffff",
        secondary: "#f1f5f9",
        "secondary-foreground": "#0f172a",
        muted: "#f1f5f9",
        "muted-foreground": "#64748b",
        accent: "#e0e7ff",
        "accent-foreground": "#0f172a",
        destructive: "#ef4444",
        "destructive-foreground": "#ffffff",
        border: "#e2e8f0",
        input: "#e2e8f0",
        ring: "#4f46e5",
        "chart-1": "#4f46e5",
        "chart-2": "#7c3aed",
        "chart-3": "#a21caf",
        "chart-4": "#be185d",
        "chart-5": "#dc2626",
      },
      borderRadius: {
        lg: "0.875rem",
        md: "0.75rem",
        sm: "0.5rem",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.5s ease-out both",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
}