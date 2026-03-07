/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./stores/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // -- Primitive Palettes ------------------------------------------------
        gray: {
          0: "rgb(var(--color-gray-0) / <alpha-value>)",
          5: "rgb(var(--color-gray-5) / <alpha-value>)",
          10: "rgb(var(--color-gray-10) / <alpha-value>)",
          20: "rgb(var(--color-gray-20) / <alpha-value>)",
          30: "rgb(var(--color-gray-30) / <alpha-value>)",
          40: "rgb(var(--color-gray-40) / <alpha-value>)",
          50: "rgb(var(--color-gray-50) / <alpha-value>)",
          60: "rgb(var(--color-gray-60) / <alpha-value>)",
          70: "rgb(var(--color-gray-70) / <alpha-value>)",
          80: "rgb(var(--color-gray-80) / <alpha-value>)",
          90: "rgb(var(--color-gray-90) / <alpha-value>)",
          100: "rgb(var(--color-gray-100) / <alpha-value>)",
        },
        brand: {
          5: "rgb(var(--color-brand-5) / <alpha-value>)",
          10: "rgb(var(--color-brand-10) / <alpha-value>)",
          20: "rgb(var(--color-brand-20) / <alpha-value>)",
          30: "rgb(var(--color-brand-30) / <alpha-value>)",
          40: "rgb(var(--color-brand-40) / <alpha-value>)",
          50: "rgb(var(--color-brand-50) / <alpha-value>)",
          60: "rgb(var(--color-brand-60) / <alpha-value>)",
          70: "rgb(var(--color-brand-70) / <alpha-value>)",
          80: "rgb(var(--color-brand-80) / <alpha-value>)",
          90: "rgb(var(--color-brand-90) / <alpha-value>)",
          subtle: "rgb(var(--color-brand-subtle) / <alpha-value>)",
          muted: "rgb(var(--color-brand-muted) / <alpha-value>)",
          DEFAULT: "rgb(var(--color-brand-default) / <alpha-value>)",
          hover: "rgb(var(--color-brand-hover) / <alpha-value>)",
          active: "rgb(var(--color-brand-active) / <alpha-value>)",
          text: "rgb(var(--color-brand-text) / <alpha-value>)",
        },
        destructive: {
          5: "rgb(var(--color-destructive-5) / <alpha-value>)",
          10: "rgb(var(--color-destructive-10) / <alpha-value>)",
          20: "rgb(var(--color-destructive-20) / <alpha-value>)",
          30: "rgb(var(--color-destructive-30) / <alpha-value>)",
          40: "rgb(var(--color-destructive-40) / <alpha-value>)",
          50: "rgb(var(--color-destructive-50) / <alpha-value>)",
          60: "rgb(var(--color-destructive-60) / <alpha-value>)",
          70: "rgb(var(--color-destructive-70) / <alpha-value>)",
          80: "rgb(var(--color-destructive-80) / <alpha-value>)",
          90: "rgb(var(--color-destructive-90) / <alpha-value>)",
        },
        warning: {
          5: "rgb(var(--color-warning-5) / <alpha-value>)",
          10: "rgb(var(--color-warning-10) / <alpha-value>)",
          20: "rgb(var(--color-warning-20) / <alpha-value>)",
          30: "rgb(var(--color-warning-30) / <alpha-value>)",
          40: "rgb(var(--color-warning-40) / <alpha-value>)",
          50: "rgb(var(--color-warning-50) / <alpha-value>)",
          60: "rgb(var(--color-warning-60) / <alpha-value>)",
          70: "rgb(var(--color-warning-70) / <alpha-value>)",
          80: "rgb(var(--color-warning-80) / <alpha-value>)",
          90: "rgb(var(--color-warning-90) / <alpha-value>)",
        },
        success: {
          5: "rgb(var(--color-success-5) / <alpha-value>)",
          10: "rgb(var(--color-success-10) / <alpha-value>)",
          20: "rgb(var(--color-success-20) / <alpha-value>)",
          30: "rgb(var(--color-success-30) / <alpha-value>)",
          40: "rgb(var(--color-success-40) / <alpha-value>)",
          50: "rgb(var(--color-success-50) / <alpha-value>)",
          60: "rgb(var(--color-success-60) / <alpha-value>)",
          70: "rgb(var(--color-success-70) / <alpha-value>)",
          80: "rgb(var(--color-success-80) / <alpha-value>)",
          90: "rgb(var(--color-success-90) / <alpha-value>)",
        },
        blue: {
          5: "rgb(var(--color-blue-5) / <alpha-value>)",
          10: "rgb(var(--color-blue-10) / <alpha-value>)",
          20: "rgb(var(--color-blue-20) / <alpha-value>)",
          30: "rgb(var(--color-blue-30) / <alpha-value>)",
          40: "rgb(var(--color-blue-40) / <alpha-value>)",
          50: "rgb(var(--color-blue-50) / <alpha-value>)",
          60: "rgb(var(--color-blue-60) / <alpha-value>)",
          70: "rgb(var(--color-blue-70) / <alpha-value>)",
          80: "rgb(var(--color-blue-80) / <alpha-value>)",
          90: "rgb(var(--color-blue-90) / <alpha-value>)",
        },
        indigo: {
          5: "rgb(var(--color-indigo-5) / <alpha-value>)",
          10: "rgb(var(--color-indigo-10) / <alpha-value>)",
          20: "rgb(var(--color-indigo-20) / <alpha-value>)",
          30: "rgb(var(--color-indigo-30) / <alpha-value>)",
          40: "rgb(var(--color-indigo-40) / <alpha-value>)",
          50: "rgb(var(--color-indigo-50) / <alpha-value>)",
          60: "rgb(var(--color-indigo-60) / <alpha-value>)",
          70: "rgb(var(--color-indigo-70) / <alpha-value>)",
          80: "rgb(var(--color-indigo-80) / <alpha-value>)",
          90: "rgb(var(--color-indigo-90) / <alpha-value>)",
        },
        purple: {
          5: "rgb(var(--color-purple-5) / <alpha-value>)",
          10: "rgb(var(--color-purple-10) / <alpha-value>)",
          20: "rgb(var(--color-purple-20) / <alpha-value>)",
          30: "rgb(var(--color-purple-30) / <alpha-value>)",
          40: "rgb(var(--color-purple-40) / <alpha-value>)",
          50: "rgb(var(--color-purple-50) / <alpha-value>)",
          60: "rgb(var(--color-purple-60) / <alpha-value>)",
          70: "rgb(var(--color-purple-70) / <alpha-value>)",
          80: "rgb(var(--color-purple-80) / <alpha-value>)",
          90: "rgb(var(--color-purple-90) / <alpha-value>)",
        },
        orange: {
          5: "rgb(var(--color-orange-5) / <alpha-value>)",
          10: "rgb(var(--color-orange-10) / <alpha-value>)",
          20: "rgb(var(--color-orange-20) / <alpha-value>)",
          30: "rgb(var(--color-orange-30) / <alpha-value>)",
          40: "rgb(var(--color-orange-40) / <alpha-value>)",
          50: "rgb(var(--color-orange-50) / <alpha-value>)",
          60: "rgb(var(--color-orange-60) / <alpha-value>)",
          70: "rgb(var(--color-orange-70) / <alpha-value>)",
          80: "rgb(var(--color-orange-80) / <alpha-value>)",
          90: "rgb(var(--color-orange-90) / <alpha-value>)",
        },

        // -- Semantic: Background ---------------------------------------------
        background: {
          primary: "rgb(var(--color-background-primary) / <alpha-value>)",
          secondary: "rgb(var(--color-background-secondary) / <alpha-value>)",
          tertiary: "rgb(var(--color-background-tertiary) / <alpha-value>)",
          inverse: "rgb(var(--color-background-inverse) / <alpha-value>)",
        },

        // -- Semantic: Surface ------------------------------------------------
        surface: {
          DEFAULT: "rgb(var(--color-surface-default) / <alpha-value>)",
          raised: "rgb(var(--color-surface-raised) / <alpha-value>)",
          sunken: "rgb(var(--color-surface-sunken) / <alpha-value>)",
        },

        // -- Semantic: Text ---------------------------------------------------
        text: {
          primary: "rgb(var(--color-text-primary) / <alpha-value>)",
          secondary: "rgb(var(--color-text-secondary) / <alpha-value>)",
          tertiary: "rgb(var(--color-text-tertiary) / <alpha-value>)",
          disabled: "rgb(var(--color-text-disabled) / <alpha-value>)",
          inverse: "rgb(var(--color-text-inverse) / <alpha-value>)",
          brand: "rgb(var(--color-text-brand) / <alpha-value>)",
          success: "rgb(var(--color-text-success) / <alpha-value>)",
          warning: "rgb(var(--color-text-warning) / <alpha-value>)",
          error: "rgb(var(--color-text-error) / <alpha-value>)",
        },

        // -- Semantic: Border -------------------------------------------------
        border: {
          DEFAULT: "rgb(var(--color-border-default) / <alpha-value>)",
          strong: "rgb(var(--color-border-strong) / <alpha-value>)",
          focus: "rgb(var(--color-border-focus) / <alpha-value>)",
          error: "rgb(var(--color-border-error) / <alpha-value>)",
        },

        // -- Semantic: Status -------------------------------------------------
        status: {
          success: {
            subtle: "rgb(var(--color-status-success-subtle) / <alpha-value>)",
            muted: "rgb(var(--color-status-success-muted) / <alpha-value>)",
            DEFAULT: "rgb(var(--color-status-success-default) / <alpha-value>)",
            text: "rgb(var(--color-status-success-text) / <alpha-value>)",
          },
          warning: {
            subtle: "rgb(var(--color-status-warning-subtle) / <alpha-value>)",
            muted: "rgb(var(--color-status-warning-muted) / <alpha-value>)",
            DEFAULT: "rgb(var(--color-status-warning-default) / <alpha-value>)",
            text: "rgb(var(--color-status-warning-text) / <alpha-value>)",
          },
          error: {
            subtle: "rgb(var(--color-status-error-subtle) / <alpha-value>)",
            muted: "rgb(var(--color-status-error-muted) / <alpha-value>)",
            DEFAULT: "rgb(var(--color-status-error-default) / <alpha-value>)",
            text: "rgb(var(--color-status-error-text) / <alpha-value>)",
          },
          info: {
            subtle: "rgb(var(--color-status-info-subtle) / <alpha-value>)",
            muted: "rgb(var(--color-status-info-muted) / <alpha-value>)",
            DEFAULT: "rgb(var(--color-status-info-default) / <alpha-value>)",
            text: "rgb(var(--color-status-info-text) / <alpha-value>)",
          },
        },

        // -- Banking-Specific -------------------------------------------------
        money: {
          positive: "rgb(var(--color-money-positive) / <alpha-value>)",
          negative: "rgb(var(--color-money-negative) / <alpha-value>)",
          pending: "rgb(var(--color-money-pending) / <alpha-value>)",
        },
        ai: {
          bubble: {
            assistant: "rgb(var(--color-ai-bubble-assistant) / <alpha-value>)",
            user: "rgb(var(--color-ai-bubble-user) / <alpha-value>)",
          },
          avatar: {
            bg: "rgb(var(--color-ai-avatar-bg) / <alpha-value>)",
            icon: "rgb(var(--color-ai-avatar-icon) / <alpha-value>)",
          },
        },
        card: {
          confirmation: {
            border: "rgb(var(--color-card-confirmation-border) / <alpha-value>)",
          },
          success: {
            border: "rgb(var(--color-card-success-border) / <alpha-value>)",
          },
        },
        score: {
          poor: "rgb(var(--color-score-poor) / <alpha-value>)",
          fair: "rgb(var(--color-score-fair) / <alpha-value>)",
          good: "rgb(var(--color-score-good) / <alpha-value>)",
          excellent: "rgb(var(--color-score-excellent) / <alpha-value>)",
        },
        overlay: "rgb(var(--color-overlay) / <alpha-value>)",
      },

      // -- Spacing -----------------------------------------------------------
      spacing: {
        "4xs": "2px",
        "3xs": "4px",
        "2xs": "6px",
        xs: "8px",
        sm: "12px",
        md: "16px",
        lg: "20px",
        xl: "24px",
        "2xl": "32px",
        "3xl": "40px",
        "4xl": "48px",
        "5xl": "64px",
        "6xl": "80px",
      },

      // -- Border Radius -----------------------------------------------------
      borderRadius: {
        "3xs": "1px",
        "2xs": "2px",
        xs: "4px",
        sm: "6px",
        md: "8px",
        lg: "16px",
        xl: "24px",
        "2xl": "32px",
        "3xl": "48px",
        "4xl": "64px",
      },

      // -- Font Size ---------------------------------------------------------
      fontSize: {
        "2xs": "10px",
        xs: "12px",
        sm: "14px",
        md: "16px",
        lg: "18px",
        xl: "20px",
        "2xl": "24px",
        "3xl": "30px",
        "4xl": "36px",
        "5xl": "48px",
      },

      // -- Shadows -----------------------------------------------------------
      // NativeWind v4 translates Tailwind's default shadow utilities
      // (shadow-sm, shadow, shadow-md, shadow-lg, shadow-xl, shadow-2xl)
      // into React Native shadow properties automatically.
      // Do NOT define custom boxShadow values here -- CSS box-shadow syntax
      // does not work in React Native. Use the built-in utilities only.

      // -- Font Family -------------------------------------------------------
      fontFamily: {
        sans: ["Inter"],
        mono: ["SpaceMono"],
      },
    },
  },
  plugins: [],
};
