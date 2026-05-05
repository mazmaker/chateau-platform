/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Noto Sans Thai', 'Noto Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'sans-serif'],
        serif: ['Noto Sans Thai', 'Noto Sans', 'Georgia', 'serif'],
        display: ['Noto Sans Thai', 'Noto Sans', 'sans-serif'],
        body: ['Noto Sans Thai', 'Noto Sans', 'sans-serif'],
        thai: ['Noto Sans Thai', 'sans-serif'],
      },
      fontWeight: {
        thin: '100',
        extralight: '200',
        light: '300',
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        extrabold: '800',
        black: '900',
      },
      colors: {
        // Luxury Design System Colors
        background: "#F9FAFB",
        foreground: "#1c1917",
        card: "#FFFFFF",
        "card-foreground": "#1c1917",
        popover: "#FFFFFF",
        "popover-foreground": "#1c1917",
        primary: "#e60023",
        "primary-foreground": "#FFFFFF",
        secondary: "#4B5563",
        "secondary-foreground": "#FFFFFF",
        muted: "#F9FAFB",
        "muted-foreground": "#6B7280",
        accent: "#fff1f2",
        "accent-foreground": "#e60023",
        destructive: "#ef4444",
        "destructive-foreground": "#FFFFFF",
        border: "#e5e7eb",
        input: "#e5e7eb",
        ring: "#e60023",
        "chart-1": "#e60023",
        "chart-2": "#f97316",
        "chart-3": "#10b981",
        "chart-4": "#3b82f6",
        "chart-5": "#8b5cf6",

        // Luxury Palette
        "luxury-white": "#FFFFFF",
        "luxury-gray": "#6B7280",
        "luxury-gray-dark": "#4B5563",
        "royal-gold": "#ca8a04",
        "royal-gold-light": "#d97706",
        "charcoal": "#1c1917",
        "charcoal-light": "#292524",
        "warm-brown": "#8b5a2b",

        // Purple palette (primary)
        purple: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },

        // Chateau primary color (Kids Kingdom red)
        chateau: {
          DEFAULT: '#e60023',
          50: '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fca5b2',
          400: '#fb7185',
          500: '#e60023',
          600: '#b30019',
          700: '#8a0014',
          800: '#6b000f',
          900: '#4c0009',
        },

        // Sky blue palette (muted-foreground)
        sky: {
          50: '#F0F9FF',
          100: '#E0F2FE',
          200: '#BAE6FD',
          300: '#7DD3FC',
          400: '#38BCFF',
          500: '#38B6FF',
          600: '#0284C7',
          700: '#0369A1',
          800: '#075985',
          900: '#0C4A6E',
        },

        // Blue palette
        blue: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },

        // Green palette
        green: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },

        // Orange palette
        orange: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },

        // Red palette
        red: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },

        // Status colors
        success: '#22c55e',
        destructive: '#ef4444',

        // KPI card colors
        'kpi-pink': '#ec4899',
        'kpi-orange': '#f97316',
        'kpi-green': '#22c55e',
        'kpi-purple': '#7c3aed',
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
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
      boxShadow: {
        "soft": "0 2px 8px rgba(0, 0, 0, 0.04)",
        "soft-lg": "0 8px 24px rgba(0, 0, 0, 0.08)",
      },
    },
  },
  plugins: [],
}
